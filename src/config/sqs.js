// @flow
import type { Configuration } from '../../types';

const sqs = (config: Configuration) => {
  const AWS = require('aws-sdk'); //eslint-disable-line
  const instance: Object = new AWS.SQS({
    region: config.region,
    apiVersion: config.apiVersion,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    maxNumberOfMessages: config.maxNumberOfMessages,
    visibilityTimeout: config.visibilityTimeout,
    waitTimeSeconds: config.waitTimeSeconds,
  });

  const createQueue = instance.createQueue.bind(instance);
  const sendMessage = instance.sendMessage.bind(instance);
  const getQueueUrl = instance.getQueueUrl.bind(instance);
  const receiveMessage = instance.receiveMessage.bind(instance);
  const deleteMessage = instance.deleteMessage.bind(instance);

  instance.createQueueAsync = (...args) => createQueue(...args).promise();
  instance.sendMessageAsync = (...args) => sendMessage(...args).promise();
  instance.receiveMessageAsync = (...args) => receiveMessage(...args).promise();
  instance.getQueueUrlAsync = (...args) => getQueueUrl(...args).promise();
  instance.deleteMessageAsync = (...args) => deleteMessage(...args).promise();

  return instance;
};

export default {
  sqs,
};
