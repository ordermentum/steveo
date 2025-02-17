import {
  CreateQueueCommandInput,
  CreateQueueCommandOutput,
  GetQueueUrlCommandOutput,
  DeleteMessageCommandInput,
  DeleteMessageCommandOutput,
  GetQueueAttributesCommandInput,
  GetQueueAttributesCommandOutput,
  Message,
  ReceiveMessageCommandInput,
  ReceiveMessageCommandOutput,
  SQS,
} from '@aws-sdk/client-sqs';
import bluebird from 'bluebird';
import nullLogger from 'null-logger';
import BaseRunner from './base';
import { safeParseInt } from '../lib/utils';
import { getContext } from '../lib/context';
import { getSqsInstance } from '../config/sqs';

import { IRunner, Pool, SQSConfiguration } from '../common';
import { Logger } from '../lib/logger';
import { Steveo } from '..';

class SqsRunner extends BaseRunner implements IRunner {
  config: SQSConfiguration;

  logger: Logger;

  sqsUrls: { [key: string]: string };

  sqs: SQS;

  pool: Pool<any>;

  concurrency: number;

  currentTimeout?: ReturnType<typeof setTimeout>;

  constructor(steveo: Steveo) {
    super(steveo);
    this.config = steveo.config as SQSConfiguration;
    this.logger = steveo.logger ?? nullLogger;
    this.sqsUrls = {};
    this.sqs = getSqsInstance(steveo.config);
    this.pool = steveo.pool;
    this.concurrency = safeParseInt(steveo.config.workerConfig?.max ?? 1, 1);
    this.logger.info('SQS Runner started');
  }

  /**
   * Process the given array of received messages.
   * Each message will be processed with regard to the middleware pipeline.
   */
  async receive(messages: Array<Message>, topic: string): Promise<any> {
    this.registry.emit('runner_messages', topic, messages);

    return bluebird.map(
      messages,
      async message => {
        const payload = JSON.parse(message.Body as string);

        this.logger.trace({ message }, 'Message content');

        await this.wrap({ topic, payload }, async context => {
          this.logger.info(
            { topic: context.topic },
            `Message received for task ${context.topic}`
          );

          this.logger.trace({ payload }, 'Message parsed payload');

          await this.processMessage(
            message,
            context.topic,
            context.payload,
            this.logger.child({ topic })
          );
        });
      },
      { concurrency: this.concurrency }
    );
  }

  /**
   * Process an individual message via the middleware pipeline
   */
  private async processMessage<PayLoad extends { _meta: object }>(
    message: Message,
    topic: string,
    payload: PayLoad,
    logger: Logger
  ): Promise<void> {
    const resource = await this.pool.acquire();
    const { _meta: _, ...data } = payload;

    try {
      const runnerContext = getContext(payload);

      this.registry.emit('runner_receive', topic, payload, runnerContext);

      const task = this.registry.getTask(topic);
      const waitToCommit =
        (task?.options?.waitToCommit || this.config.waitToCommit) ?? false;

      if (!waitToCommit) {
        await this.deleteMessage(topic, message);
      }

      if (!task) {
        logger.error(`Unknown Task ${topic}`);
        return;
      }

      logger.debug(
        {
          taskName: task.name,
          context: runnerContext,
        },
        `Start Subscribe with task ${task.name}`
      );

      // Process the message data with the concrete task runner
      await task.subscribe(data, runnerContext);

      logger.debug('Completed subscribe');

      if (waitToCommit) {
        await this.deleteMessage(topic, message);
      }

      this.registry.emit(
        'runner_complete',
        topic,
        payload,
        getContext(payload)
      );
    } catch (error) {
      logger.error(
        {
          payload,
          error,
        },
        'Error while executing consumer callback'
      );

      this.registry.emit('runner_failure', topic, error, payload);
    } finally {
      if (resource) {
        await this.pool.release(resource);
      }
    }
  }

  private async deleteMessage(
    topic: string,
    message: Message
  ): Promise<boolean> {
    if (!message.ReceiptHandle) {
      return false;
    }

    const sqsTopic: string = this.getTopic(topic);
    const deleteParams: DeleteMessageCommandInput = {
      QueueUrl: this.sqsUrls[sqsTopic],
      ReceiptHandle: message.ReceiptHandle,
    };
    try {
      this.logger.debug('Deleting Message from Queue URL', deleteParams);
      const data: DeleteMessageCommandOutput = await this.sqs.deleteMessage(
        deleteParams
      );
      this.logger.debug({ data }, 'returned data');
      return true;
    } catch (ex) {
      this.logger.error({ ex, topic, message }, 'sqs deletion error');
      throw ex;
    }
  }

  private async dequeue(
    params: ReceiveMessageCommandInput
  ): Promise<Message[] | undefined> {
    const data: ReceiveMessageCommandOutput | undefined = await this.sqs
      .receiveMessage(params)
      .catch(e => {
        this.logger.error(
          { error: e },
          'Error while receiving message from queue'
        );
        return undefined;
      });

    this.logger.debug('Message from sqs', data);
    return data?.Messages;
  }

  private poll(topics?: string[]) {
    this.logger.debug(`looping ${this.manager.state}`);
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    if (this.manager.shouldTerminate) {
      this.manager.terminate();
      this.logger.debug(`terminating sqs consumer ${this.state}`);
      return;
    }
    this.currentTimeout = setTimeout(
      this.process.bind(this, topics),
      this.config.consumerPollInterval ?? 1000
    );
  }

  async process(topics?: string[]): Promise<void> {
    if (this.state === 'paused') {
      this.logger.debug(`paused processing`);
      this.poll(topics);
      return;
    }

    /**
     * If the consumer is supposed to terminate,
     * do not process any more messages
     */
    if (this.manager.shouldTerminate) {
      this.poll(topics);
      return;
    }

    const subscriptions: string[] = this.getActiveSubsciptions(topics);
    this.logger.debug(
      `Polling for messages (name: ${this.name}) (state: ${
        this.manager.state
      }) (${topics ? topics.join(',') : 'all'})`
    );

    await bluebird.map(
      subscriptions,
      async topic => {
        // If the consumer is supposed to terminate
        // do not process any more messages
        if (this.manager.shouldTerminate) return;
        const queueURL: string = await this.getQueueUrl(topic);
        if (queueURL) {
          this.logger.debug(`starting processing of ${topic} with ${queueURL}`);

          const params = {
            MaxNumberOfMessages: this.config.maxNumberOfMessages,
            QueueUrl: queueURL,
            VisibilityTimeout: this.config.visibilityTimeout,
            WaitTimeSeconds: this.config.waitTimeSeconds,
          };
          const messages = await this.dequeue(params);
          if (!messages) {
            return;
          }

          try {
            await this.receive(messages, topic);
          } catch (ex) {
            console.log('$$$$$$$$$$$', ex);
            this.logger.error('Error while invoking receive', {
              error: ex,
              topic,
              messages,
            });
          }
        } else {
          this.logger.error(`Queue URL ${topic} not found`);
        }
      },
      { concurrency: this.concurrency }
    );

    this.poll(topics);
  }

  healthCheck = async function () {
    // get a random registered queue
    const items = this.registry.getTopics();
    const item = items[Math.floor(Math.random() * items.length)];

    if (!item) {
      throw new Error('No queues registered');
    }

    await this.sqs.getQueueUrl({ QueueName: item });
  };

  async getQueueUrl(topic: string) {
    const sqsTopic: string = this.getTopic(topic);
    if (!this.sqsUrls[sqsTopic]) {
      this.logger.debug(`url not cached for ${sqsTopic}`);
      const url = await this.getUrl(sqsTopic);
      if (url) {
        this.sqsUrls[sqsTopic] = url;
      }
    }

    return this.sqsUrls[sqsTopic];
  }

  private getTopic(topic: string): string {
    const task = this.registry.getTask(topic);
    const fifo: boolean = !!task?.options?.fifo;
    return fifo ? `${topic}.fifo` : topic;
  }

  private getUrl(topic: string): Promise<string | null | undefined> {
    return this.sqs
      .getQueueUrl({ QueueName: topic })
      .then((data: GetQueueUrlCommandOutput) => data.QueueUrl)
      .catch(e => {
        this.logger.error(e);
        return null;
      });
  }

  private async getDeadLetterQueuePolicy(
    queueName: string
  ): Promise<Record<string, string> | null> {
    const task = this.registry.getTask(queueName);

    if (!task?.options?.deadLetterQueue) {
      return null;
    }

    const dlQueueName = `${queueName}_DLQ`;
    // try to fetch if there is an existing queueURL for QLQ
    const queueResult: GetQueueUrlCommandOutput | undefined = await this.sqs
      .getQueueUrl({ QueueName: dlQueueName })
      .catch(_ => undefined);

    let dlQueueUrl = queueResult?.QueueUrl;

    // if we don't have existing DLQ, create one
    if (!dlQueueUrl) {
      const params: CreateQueueCommandInput = {
        QueueName: dlQueueName,
        Attributes: {
          ReceiveMessageWaitTimeSeconds:
            this.config.receiveMessageWaitTimeSeconds ?? '20',
          MessageRetentionPeriod:
            this.config.messageRetentionPeriod ?? '604800',
        },
      };

      this.logger.debug(`Creating DLQ for orginal queue ${queueName}`, params);

      const res: CreateQueueCommandOutput = await this.sqs
        .createQueue(params)
        .catch(err => {
          throw new Error(`Failed to call SQS createQueue: ${err}`);
        });

      if (!res.QueueUrl) {
        throw new Error(
          'SQS createQueue response does not contain a queue name'
        );
      }

      dlQueueUrl = res.QueueUrl;
    }

    // get the ARN of the DQL
    const getQueueAttributesParams: GetQueueAttributesCommandInput = {
      QueueUrl: dlQueueUrl,
      AttributeNames: ['QueueArn'],
    };

    const attributesResult: GetQueueAttributesCommandOutput = await this.sqs
      .getQueueAttributes(getQueueAttributesParams)
      .catch(err => {
        throw new Error(`Failed to call SQS getQueueAttributes: ${err}`);
      });

    const dlQueueArn = attributesResult.Attributes?.QueueArn;

    if (!dlQueueArn) {
      throw new Error('Failed to retrieve the DLQ ARN');
    }

    return {
      deadLetterTargetArn: dlQueueArn,
      maxReceiveCount: (task.options.maxReceiveCount ?? 5).toString(),
    };
  }

  async createQueue(topic: string): Promise<boolean> {
    this.logger.info(`creating SQS queue ${topic}`);

    let queueName: string = topic;
    const commandAttributes: Record<string, string> = {
      ReceiveMessageWaitTimeSeconds: this.config.receiveMessageWaitTimeSeconds,
      MessageRetentionPeriod: this.config.messageRetentionPeriod,
    };

    const task = this.registry.getTask(topic);
    const isFifoTask: boolean = task?.options?.fifo ?? false;
    if (isFifoTask) {
      queueName = `${queueName}.fifo`;
      commandAttributes.FifoQueue = 'true';
      commandAttributes.ContentBasedDeduplication = 'true';
    }

    const redrivePolicy: Record<string, string> | null =
      await this.getDeadLetterQueuePolicy(topic);
    if (redrivePolicy) {
      commandAttributes.RedrivePolicy = JSON.stringify(redrivePolicy);
    }

    const params: CreateQueueCommandInput = {
      QueueName: queueName,
      Attributes: commandAttributes,
    };
    await this.sqs.createQueue(params);
    return true;
  }
}

export default SqsRunner;
