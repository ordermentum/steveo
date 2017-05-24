// @flow
import { sqs } from '../config';
import type { Config, Reg } from '../types';

const querySqsUrl = (topic, logger) => {
  return new Promise((resolve, reject) => {
    const params = {
      QueueName: topic,
    };

    sqs.getQueueUrl(params, function(err, data) {
      if (err) return reject(err);
      resolve(data.QueueUrl);
    });
  });
};

const Runner = (config: Config, registry: Reg, logger: Object) => {
  const sqsUrls = {};

  const deleteMessage = (topic, message) => {
    return new Promise((resolve, reject) => {
      var deleteParams = {
        QueueUrl: sqsUrls[topic],
        ReceiptHandle: message.ReceiptHandle
      };
      sqs.deleteMessage(deleteParams, function(err, data) {
        if (err) {
          logger.info("sqs deletion error", err, topic, message);
          return reject(err);
        }
        return resolve();
      });
    });
  };

  const receive = async (messages: Array<Object>, topic: string) => {
    // This says "Here are some messages. You should process them"
    for (const m of messages) { // eslint-disable-line
      let params = null;
      try {
        // commit offset
        params = JSON.parse(m.Body);
        registry.events.emit('runner_receive', topic, params);
        logger.info('Deleting message', topic, params);
        await deleteMessage(topic, m);
        const task = registry.getTask(topic);
        logger.info('Start subscribe', topic, params);
        await task.subscribe(params); // eslint-disable-line
        logger.info('Finish subscribe', topic, params);
        registry.events.emit('runner_complete', topic, params);
      } catch (ex) {
        logger.error('Error while executing consumer callback ', { params, topic, error: ex });
        registry.events.emit('runner_failure', topic, ex, params);
      }
    }
  };

  const iterateOnQueue = (params, topic) => {
    return new Promise((resolve, reject) => {
      sqs.receiveMessage(params, function(err, data) {
        if (err) {
          return reject(err);
        }
        resolve(receive(data.Messages, topic)
        .catch(() => iterateOnQueue(params, topic))
        .then(() => iterateOnQueue(params, topic)))
      });
    });
  };

  const process = async () => {
    // This says "Start listening for tasks and running them when they come in"
    const subscriptions = registry.getTopics();

    await Promise.all(subscriptions.map(async topic => {
      logger.info(`beginning to process topic: ${topic}`);
      const queueURL = await querySqsUrl(topic, logger);
      sqsUrls[topic] = queueURL;
      logger.info(`queueURL for topic ${topic} is ${queueURL}`);

      const params = {
        MaxNumberOfMessages: 1,
        QueueUrl: queueURL,
        VisibilityTimeout: 180,
        WaitTimeSeconds: 20,
      };

      logger.info('initializing consumer', topic, params);

      return iterateOnQueue(params, topic);

    }));
  };

  return {
    sqs,
    process,
    receive,
  };
};

export default Runner;
