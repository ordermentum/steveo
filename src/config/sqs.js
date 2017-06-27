// @flow

import AWS from 'aws-sdk';
import type { Configuration } from '../../types';

const sqs = (config: Configuration) => {
  const instance: Object = new AWS.SQS({
    region: config.region,
    apiVersion: config.apiVersion,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    maxNumberOfMessages: config.maxNumberOfMessages,
    visibilityTimeout: config.visibilityTimeout,
    waitTimeSeconds: config.waitTimeSeconds,
  });
  return instance;
};

export default sqs;
