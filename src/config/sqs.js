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

  instance.createQueueAsync = () => createQueue(...arguments).promise();
  instance.sendMessageAsync = () => sendMessage(...arguments).promise();
  instance.receiveMessageAsync = () => receiveMessage(...arguments).promise();
  instance.getQueueUrlAsync = () => getQueueUrl(...arguments).promise();
  instance.deleteMessageAsync = () => deleteMessage(...arguments).promise();

  return instance;
};

export default {
  sqs,
};
