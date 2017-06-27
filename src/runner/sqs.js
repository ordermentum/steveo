// @flow
import SqsConf from '../config/sqs';
import type { IRunner, Configuration, Logger, Consumer, IRegistry } from '../../types';

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

class SqsRunner implements IRunner {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  consumer: Consumer;
  sqsUrls: Object;
  sqs: Object;

  constructor(config: Configuration, registry: IRegistry, logger: Logger) {
    this.config = config;
    this.registry = registry;
    this.logger = logger;
    this.sqsUrls = {};
    this.sqs = SqsConf.sqs(config);
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

  iterateOnQueue = async (params: Object, topic: string) => {
    const data = await this.sqs.receiveMessageAsync(params);
    try {
      await this.receive(data.Messages, topic);
      this.iterateOnQueue(params, topic);
    } catch (ex) {
      this.iterateOnQueue(params, topic);
    }
  };

  process() {
    const subscriptions = this.registry.getTopics();
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
}

export default SqsRunner;
