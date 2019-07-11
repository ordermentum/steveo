import * as AWS from 'aws-sdk';
import { Configuration } from '../common';

const sqs = (config: Configuration) => {
  const instance = new AWS.SQS({
    region: config.region,
    apiVersion: config.apiVersion,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });

  const createQueue = instance.createQueue.bind(instance);
  const sendMessage = instance.sendMessage.bind(instance);
  const getQueueUrl = instance.getQueueUrl.bind(instance);
  const receiveMessage = instance.receiveMessage.bind(instance);
  const deleteMessage = instance.deleteMessage.bind(instance);
  const dummy = {
    createQueueAsync: (...args) => createQueue(...args).promise(),
    sendMessageAsync: (...args) => sendMessage(...args).promise(),
    receiveMessageAsync: (...args) => receiveMessage(...args).promise(),
    getQueueUrlAsync: (...args) => getQueueUrl(...args).promise(),
    deleteMessageAsync: (...args) => deleteMessage(...args).promise(),
  };
  return Object.assign(instance, dummy);
};

export default {
  sqs,
};
