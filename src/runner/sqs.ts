import nullLogger from 'null-logger';

import BaseRunner from '../base/base_runner';
import sqsConf from '../config/sqs';
import {
  Hooks,
  IRunner,
  Configuration,
  Pool,
  Logger,
  IRegistry,
  CreateSqsTopic,
} from '../common';

type DeleteMessage = {
  instance: any;
  topic: string;
  message: any;
  sqsUrls: any;
  logger: Logger;
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
    logger.debug('Deleting Message from Queue URL', deleteParams);
    const data = await instance.deleteMessageAsync(deleteParams);
    logger.debug('returned data', data);
    return data;
  } catch (ex) {
    logger.error('sqs deletion error', ex, topic, message);
    throw ex;
  }
};

class SqsRunner extends BaseRunner implements IRunner {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  sqsUrls: any;

  sqs: any;

  pool: Pool;

  constructor(
    config: Configuration,
    registry: IRegistry,
    pool: Pool,
    logger: Logger = nullLogger,
    hooks: Hooks = {}
  ) {
    super(hooks);
    this.config = config || {};
    this.registry = registry;
    this.logger = logger;
    this.sqsUrls = {};
    this.sqs = sqsConf.sqs(config);
    this.pool = pool;
  }

  async receive(messages: any[], topic: string): Promise<any> {
    return Promise.all(
      messages.map(async m => {
        let params = null;
        const resource = await this.pool.acquire();
        try {
          params = JSON.parse(m.Body);
          this.registry.events.emit('runner_receive', topic, params);
          this.logger.debug('Deleting message', topic, params);
        await deleteMessage({ // eslint-disable-line
            instance: this.sqs,
            topic,
            message: m,
            sqsUrls: this.sqsUrls,
            logger: this.logger,
          });
          this.logger.debug('Message Deleted', topic, params);
          const task = this.registry.getTask(topic);
          this.logger.debug('Start subscribe', topic, params);
        await task.subscribe(params); // eslint-disable-line
          this.logger.debug('Completed subscribe', topic, params);
          this.registry.events.emit('runner_complete', topic, params);
        } catch (ex) {
          this.logger.error('Error while executing consumer callback ', {
            params,
            topic,
            error: ex,
          });
          this.registry.events.emit('runner_failure', topic, ex, params);
        }
        this.pool.release(resource);
      })
    );
  }

  async dequeue(topic: string, params: any) {
    const data = await this.sqs.receiveMessageAsync(params);

    if (data.Messages) {
      this.logger.debug('Message from sqs', data);
      try {
        await this.receive(data.Messages, topic);
      } catch (ex) {
        this.logger.error('Error while invoking receive', ex);
      }
    }
  }

  async process(topics?: string[]) {
    const loop = () =>
      setTimeout(
        this.process.bind(this, topics),
        this.config.consumerPollInterval
      );
    await this.checks(loop);

    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.debug(
      `Polling for messages (${topics ? topics.join(',') : 'all'})`
    );

    await Promise.all(
      subscriptions.map(async topic => {
        const queueURL = await this.getQueueUrl(topic);
        if (queueURL) {
          this.logger.debug(`starting processing of ${topic} with ${queueURL}`);
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
      })
    );
    loop();
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
    return this.sqs
      .getQueueUrlAsync({ QueueName: topic })
      .then(data => data && data.QueueUrl)
      .catch(e => {
        this.logger.error(e);
        return null;
      });
  }

  async createQueue({
    topic,
    receiveMessageWaitTimeSeconds = '20',
    messageRetentionPeriod = '604800',
  }: CreateSqsTopic) {
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
