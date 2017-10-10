// @flow
import nullLogger from 'null-logger';

import BaseRunner from '../base/base_runner';
import sqsConf from '../config/sqs';
import type { IRunner, Configuration, Pool, Logger, Consumer, IRegistry, CreateSqsTopic } from '../../types';

type DeleteMessage = {
  instance: Object,
  topic: string,
  message: Object,
  sqsUrls: Object,
  logger: Logger
};

/* istanbul ignore next */
const deleteMessage = async ({
  instance,
  topic,
  message,
  sqsUrls,
  logger,
}: DeleteMessage) => {
  const deleteParams = {
    QueueUrl: sqsUrls[topic],
    ReceiptHandle: message.ReceiptHandle,
  };
  try {
    const data = await instance.deleteMessageAsync(deleteParams);
    return data;
  } catch (ex) {
    logger.info('sqs deletion error', ex, topic, message);
    throw ex;
  }
};

class SqsRunner extends BaseRunner implements IRunner {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  consumer: Consumer;
  sqsUrls: Object;
  sqs: Object;
  pool: Pool;

  constructor(config: Configuration, registry: IRegistry, pool: Pool, logger: Logger = nullLogger) {
    super();
    this.config = config;
    this.registry = registry;
    this.logger = logger;
    this.sqsUrls = {};
    this.sqs = sqsConf.sqs(config);
    this.pool = pool;
  }

  async receive(messages: Array<Object>, topic: string): Promise<any> {
    return Promise.all(messages.map(async (m) => {
      let params = null;
      const resource = await this.pool.acquire();
      try {
        params = JSON.parse(m.Body);
        this.registry.events.emit('runner_receive', topic, params);
        this.logger.info('Deleting message', topic, params);
        await deleteMessage({ // eslint-disable-line
          instance: this.sqs,
          topic,
          message: m,
          sqsUrls: this.sqsUrls,
          logger: this.logger,
        });
        const task = this.registry.getTask(topic);
        this.logger.info('Start subscribe', topic, params);
        await task.subscribe(params); // eslint-disable-line
        this.registry.events.emit('runner_complete', topic, params);
      } catch (ex) {
        this.logger.error('Error while executing consumer callback ', { params, topic, error: ex });
        this.registry.events.emit('runner_failure', topic, ex, params);
      }
      this.pool.release(resource);
    }));
  }

  async dequeue(topic: string, params: Object) {
    const data = await this.sqs.receiveMessageAsync(params);

    if (data.Messages) {
      this.logger.info('Message from sqs', data);
      try {
        await this.receive(data.Messages, topic);
      } catch (ex) {
        this.logger.error('Error while invoking receive', ex);
      }
    }
  }

  async process(topics: ?Array<string> = null) {
    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.debug(`starting poll for messages ${topics ? topics.join(',') : 'all'}`);

    await Promise.all(subscriptions.map(async (topic) => {
      const queueURL = await this.getQueueUrl(topic);
      if (queueURL) {
        this.logger.info(`starting processing of ${topic} with ${queueURL}`);
        const params = {
          MaxNumberOfMessages: this.config.maxNumberOfMessages,
          QueueUrl: queueURL,
          VisibilityTimeout: this.config.visibilityTimeout,
          WaitTimeSeconds: this.config.waitTimeSeconds,
        };
        await this.dequeue(topic, params);
      } else {
        this.logger.error(`Queue URL ${topic} not found`);
      }
    }));
    setTimeout(this.process.bind(this, topics), this.config.consumerPollInterval);
  }

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
    return this.sqs.getQueueUrlAsync({ QueueName: topic })
                 .then(data => data && data.QueueUrl)
                 .catch((e) => {
                   this.logger.error(e);
                   return null;
                 });
  }

  async createQueue({ topic, receiveMessageWaitTimeSeconds = '20', messageRetentionPeriod = '604800' }: CreateSqsTopic) {
    const params = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds: receiveMessageWaitTimeSeconds,
        MessageRetentionPeriod: messageRetentionPeriod,
      },
    };
    return this.sqs.createQueueAsync(params);
  }
}

export default SqsRunner;
