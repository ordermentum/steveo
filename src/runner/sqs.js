// @flow
import sqs from '../config/sqs';
import type { IRunner, Configuration, Logger, Consumer, IRegistry } from '../../types';

const getUrl = (instance, topic) => (
  new Promise((resolve, reject) => {
    const params = {
      QueueName: topic,
    };

    instance.getQueueUrl(params, (err, data) => {
      if (err) return reject(err);
      return resolve(data && data.QueueUrl);
    });
  })
);

type DeleteMessage = {
  instance: Object,
  topic: string,
  message: Object,
  sqsUrls: Object,
  logger: Logger
};

const deleteMessage = ({
  instance,
  topic,
  message,
  sqsUrls,
  logger,
}: DeleteMessage) => (
  new Promise((resolve, reject) => {
    const deleteParams = {
      QueueUrl: sqsUrls[topic],
      ReceiptHandle: message.ReceiptHandle,
    };
    instance.deleteMessage(deleteParams, (err, data) => {
      if (err) {
        logger.info('sqs deletion error', err, topic, message);
        return reject(err);
      }
      return resolve(data);
    });
  })
);

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
    this.sqs = sqs(config);
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

  iterateOnQueue = (params: Object, topic: string) => (
    new Promise((resolve, reject) => {
      this.sqs.receiveMessage(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(this.receive(data.Messages, topic)
        .catch(() => this.iterateOnQueue(params, topic))
        .then(() => this.iterateOnQueue(params, topic)));
      });
    })
  );

  process() {
    const subscriptions = this.registry.getTopics();
    this.logger.info('initializing consumer', subscriptions);
    return Promise.all(subscriptions.map(async (topic) => {
      const queueURL = await getUrl(this.sqs, topic);
      this.sqsUrls[topic] = queueURL;
      this.logger.info(`queueURL for topic ${topic} is ${queueURL}`);

      const params = {
        MaxNumberOfMessages: 1,
        QueueUrl: queueURL,
        VisibilityTimeout: 180,
        WaitTimeSeconds: 20,
      };
      this.logger.info('initializing consumer', topic, params);

      return this.iterateOnQueue(params, topic);
    }));
  }
}

export default SqsRunner;
