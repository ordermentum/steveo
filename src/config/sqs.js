// @flow
import bluebird from 'bluebird';
import type { Configuration } from '../../types';

const sqs = (config: Configuration) => {
  const AWS = require('aws-sdk'); //eslint-disable-line
  const instance: Object = () => new AWS.SQS({
    region: config.region,
    apiVersion: config.apiVersion,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    maxNumberOfMessages: config.maxNumberOfMessages,
    visibilityTimeout: config.visibilityTimeout,
    waitTimeSeconds: config.waitTimeSeconds,
  });
  return bluebird.promisifyAll(instance);
};

export default {
  sqs,
};
