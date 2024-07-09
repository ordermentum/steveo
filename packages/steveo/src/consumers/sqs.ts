import { SQS } from 'aws-sdk';
import bluebird from 'bluebird';
import nullLogger from 'null-logger';
import { CreateQueueRequest, QueueAttributeMap } from 'aws-sdk/clients/sqs';
import BaseRunner from './base';
import { safeParseInt } from '../lib/utils';
import { getContext } from '../lib/context';
import { getSqsInstance } from '../config/sqs';

import { IRunner, Pool, Logger, SQSConfiguration } from '../common';
import { Steveo } from '..';
import { Resource } from '../lib/pool';

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
    this.config = steveo?.config as SQSConfiguration;
    this.logger = steveo?.logger ?? nullLogger;
    this.sqsUrls = {};
    this.sqs = getSqsInstance(steveo.config);
    this.pool = steveo.pool;
    this.concurrency = safeParseInt(steveo.config.workerConfig?.max ?? 1, 1);
    this.logger.info('SQS Runner started');
  }

  async receive(messages: SQS.MessageList, topic: string): Promise<any> {
    this.registry.emit('runner_messages', topic, messages);

    return bluebird.map(
      messages,
      async message => {
        this.logger.info(message, `Message received for task: ${topic}`);
        const params = JSON.parse(message.Body as string);
        await this.wrap({ topic, payload: params }, async c => {
          this.logger.info(message, `Message received for task: ${c.topic}`);
          let resource: Resource | null = null;
          const { _meta: messageContext, ...data } = c.payload;
          const runnerContext = {
            ...getContext(c.payload),
            ...messageContext,
          };
          try {
            resource = await this.pool.acquire();

            this.registry.emit(
              'runner_receive',
              c.topic,
              c.payload,
              runnerContext
            );

            const task = this.registry.getTask(topic);
            const waitToCommit =
              (task?.options?.waitToCommit || this.config?.waitToCommit) ??
              false;

            if (!waitToCommit) {
              await this.deleteMessage(c.topic, message);
            }

            if (!task) {
              this.logger.error(`Unknown Task ${c.topic}`);
              return;
            }

            this.logger.info(
              { context: runnerContext, params },
              `Start Subscribe to ${task.name}`
            );

            await task.subscribe(data, runnerContext);
            this.logger.debug('Completed subscribe', c.topic, c.payload);
            const completedContext = getContext(c.payload);

            if (waitToCommit) {
              await this.deleteMessage(c.topic, message);
            }

            this.registry.emit(
              'runner_complete',
              topic,
              params,
              completedContext
            );
          } catch (ex) {
            this.logger.error('Error while executing consumer callback ', {
              params,
              topic,
              error: ex,
            });
            this.registry.emit('runner_failure', topic, ex, params);
          }
          if (resource) await this.pool.release(resource);
        });
      },
      { concurrency: this.concurrency }
    );
  }

  async deleteMessage(topic: string, message: SQS.Message) {
    if (!message.ReceiptHandle) {
      return false;
    }

    const sqsTopic = this.getTopic(topic);
    const deleteParams = {
      QueueUrl: this.sqsUrls[sqsTopic],
      ReceiptHandle: message.ReceiptHandle,
    };

    try {
      this.logger.debug('Deleting Message from Queue URL', deleteParams);
      const data = await this.sqs.deleteMessage(deleteParams).promise();
      this.logger.debug('returned data', data);
      return true;
    } catch (ex) {
      this.logger.error('sqs deletion error', ex, topic, message);
      throw ex;
    }
  }

  async dequeue(params: SQS.ReceiveMessageRequest) {
    const data = await this.sqs
      .receiveMessage(params)
      .promise()
      .catch(e => {
        this.logger.error('Error while receiving message from queue', e);
        return null;
      });

    this.logger.debug('Message from sqs', data);
    return data?.Messages;
  }

  poll(topics?: string[]) {
    this.logger.debug(`looping ${this.manager.state}`);
    if (this.manager.state === 'terminating') {
      this.manager.state = 'terminated';
      this.logger.debug(`terminating sqs consumer ${this.state}`);
      return;
    }
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    this.currentTimeout = setTimeout(
      this.process.bind(this, topics),
      this.config.consumerPollInterval ?? 1000
    );
  }

  async process(topics?: string[]) {
    if (this.state === 'paused') {
      this.logger.debug(`paused processing`);
      this.poll(topics);
      return;
    }

    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.debug(
      `Polling for messages (name: ${this.name}) (state: ${
        this.manager.state
      }) (${topics ? topics.join(',') : 'all'})`
    );

    await bluebird.map(
      subscriptions,
      async topic => {
        const queueURL = await this.getQueueUrl(topic);
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

    await this.sqs.getQueueUrl({ QueueName: item }).promise();
  };

  async getQueueUrl(topic: string) {
    const sqsTopic = this.getTopic(topic);
    if (!this.sqsUrls[sqsTopic]) {
      this.logger.debug(`url not cached for ${sqsTopic}`);
      const url = await this.getUrl(sqsTopic);
      if (url) {
        this.sqsUrls[sqsTopic] = url;
      }
    }

    return this.sqsUrls[sqsTopic];
  }

  getTopic(topic: string) {
    const task = this.registry.getTask(topic);
    const fifo = !!task?.options?.fifo;
    return fifo ? `${topic}.fifo` : topic;
  }

  getUrl(topic: string) {
    return this.sqs
      .getQueueUrl({ QueueName: topic })
      .promise()
      .then(data => data && data?.QueueUrl)
      .catch(e => {
        this.logger.error(e);
        return null;
      });
  }

  async getDeadLetterQueuePolicy(
    queueName: string
  ): Promise<QueueAttributeMap | null> {
    const task = this.registry.getTask(queueName);

    if (!task?.options?.deadLetterQueue) {
      return null;
    }

    const dlQueueName = `${queueName}_DLQ`;
    // try to fetch if there is an existing queueURL for QLQ
    const queueResult = await this.sqs
      .getQueueUrl({ QueueName: dlQueueName })
      .promise()
      .catch(_ => undefined);

    let dlQueueUrl = queueResult?.QueueUrl;

    // if we don't have existing DLQ, create one
    if (!dlQueueUrl) {
      const params = {
        QueueName: dlQueueName,
        Attributes: {
          ReceiveMessageWaitTimeSeconds:
            this.config.receiveMessageWaitTimeSeconds ?? '20',
          MessageRetentionPeriod:
            this.config.messageRetentionPeriod ?? '604800',
        },
      };

      this.logger.debug(`Creating DLQ for orginal queue ${queueName}`, params);

      const res = await this.sqs
        .createQueue(params)
        .promise()
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
    const getQueueAttributesParams = {
      QueueUrl: dlQueueUrl,
      AttributeNames: ['QueueArn'],
    };

    const attributesResult = await this.sqs
      .getQueueAttributes(getQueueAttributesParams)
      .promise()
      .catch(err => {
        throw new Error(`Failed to call SQS getQueueAttributes: ${err}`);
      });

    const dlQueueArn = attributesResult.Attributes?.QueueArn;

    if (!dlQueueArn) {
      throw new Error('Failed to retrieve the DLQ ARN');
    }

    return {
      deadLetterTargetArn: dlQueueArn,
      maxReceiveCount: (task?.options.maxReceiveCount ?? 5).toString(),
    };
  }

  async createQueue(topic: string) {
    this.logger.info(`creating SQS queue ${topic}`);

    const params: CreateQueueRequest = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds:
          this.config.receiveMessageWaitTimeSeconds,
        MessageRetentionPeriod: this.config.messageRetentionPeriod,
      },
    };

    const task = this.registry.getTask(topic);

    // Append FIFO attributes if it's enabled
    if (task?.options?.fifo) {
      params.QueueName = `${topic}.fifo`;
      params.Attributes = {
        ...params.Attributes,
        FifoQueue: 'true',
        ContentBasedDeduplication: 'true',
      };
    }

    // Check if queue supports DLQ on the task config
    const redrivePolicy: QueueAttributeMap | null =
      await this.getDeadLetterQueuePolicy(params.QueueName);

    // Append RedrivePolicy if supported
    if (redrivePolicy) {
      params.Attributes = {
        ...params.Attributes,
        RedrivePolicy: JSON.stringify(redrivePolicy),
      };
    }

    await this.sqs.createQueue(params).promise();
    return true;
  }
}

export default SqsRunner;
