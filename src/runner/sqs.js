// @flow
import BaseRunner from '../base/base_runner';
import sqsConf from '../config/sqs';
import type { IRunner, Configuration, Logger, Consumer, IRegistry, CreateSqsTopic } from '../../types';

/* istanbul ignore next */
const getUrl = (instance, topic) => {
  const params = {
    QueueName: topic,
  };

  return instance.getQueueUrlAsync(params).then(data => data && data.QueueUrl);
};

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

  constructor(config: Configuration, registry: IRegistry, logger: Logger) {
    super();
    this.config = config;
    this.registry = registry;
    this.logger = logger;
    this.sqsUrls = {};
    this.sqs = sqsConf.sqs(config);
  }

  receive = async (messages: Array<Object>, topic: string) => {
    for (const m of messages) { // eslint-disable-line no-restricted-syntax
      let params = null;
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
    }
  }
  /* istanbul ignore next */
  iterateOnQueue = async (params: Object, topic: string) => {
    const data = await this.sqs.receiveMessageAsync(params);
    try {
      await this.receive(data.Messages, topic);
      await this.iterateOnQueue(params, topic);
    } catch (ex) {
      await this.iterateOnQueue(params, topic);
    }
  };

  process(topics: Array<string>) {
    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.info('initializing consumer', subscriptions);
    return Promise.all(subscriptions.map(async (topic) => {
      const queueURL = await getUrl(this.sqs, topic);
      this.sqsUrls[topic] = queueURL;
      this.logger.info(`queueURL for topic ${topic} is ${queueURL}`);

      const params = {
        MaxNumberOfMessages: this.config.maxNumberOfMessages,
        QueueUrl: queueURL,
        VisibilityTimeout: this.config.visibilityTimeout,
        WaitTimeSeconds: this.config.waitTimeSeconds,
      };
      this.logger.info('initializing consumer', topic, params);
      return this.iterateOnQueue(params, topic);
    }));
  }

  async createQueue({ topic, receiveMessageWaitTimeSeconds = '20', messageRetentionPeriod = '604800' }: CreateSqsTopic) {
    const queues = await this.sqs.listQueuesAsync();
    if (!queues) {
      const params = {
        QueueName: topic,
        Attributes: {
          ReceiveMessageWaitTimeSeconds: receiveMessageWaitTimeSeconds,
          MessageRetentionPeriod: messageRetentionPeriod,
        },
      };
      return this.sqs.createQueueAsync(params);
    }
    return true;
  }
}

export default SqsRunner;
