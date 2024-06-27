import { SQS } from 'aws-sdk';
import bluebird from 'bluebird';
import nullLogger from 'null-logger';
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
        const params = JSON.parse(message.Body as string);
        await this.wrap({ topic, payload: params }, async c => {
          this.logger.info(message, `Message received for task: ${c.topic}`);
          let resource: Resource | null = null;
          // Not sure whether runnerContext still necessary.
          const runnerContext = getContext(c.payload);
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

            const { context = {} } = c.payload;

            this.logger.info(
              { context, params },
              `Start Subscribe to ${task.name}`
            );

            await task.subscribe(params, { ...context, ...runnerContext });
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

    const deleteParams = {
      QueueUrl: this.sqsUrls[topic],
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
    if (!this.sqsUrls[topic]) {
      this.logger.debug(`url not cached for ${topic}`);
      const url = await this.getUrl(topic);
      if (url) {
        this.sqsUrls[topic] = url;
      }
    }

    return this.sqsUrls[topic];
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

  async createQueue(topic: string) {
    this.logger.info(`creating SQS queue ${topic}`);

    const params = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds:
          this.config.receiveMessageWaitTimeSeconds,
        MessageRetentionPeriod: this.config.messageRetentionPeriod,
      },
    };
    await this.sqs.createQueue(params).promise();
    return true;
  }
}

export default SqsRunner;
