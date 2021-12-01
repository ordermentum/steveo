import * as AWS from 'aws-sdk';
import { Configuration, SQSConfiguration } from '../common';

const sqs = (config: Configuration): AWS.SQS => {
  const sqsConfig = config as SQSConfiguration;
  if (sqsConfig.httpOptions) {
    AWS.config.update({
      httpOptions: sqsConfig.httpOptions,
    });
  }
  const instance = new AWS.SQS({
    region: sqsConfig.region,
    apiVersion: sqsConfig.apiVersion,
    accessKeyId: sqsConfig.accessKeyId,
    secretAccessKey: sqsConfig.secretAccessKey,
    endpoint: sqsConfig.endpoint,
  });

  return instance;
};

export default {
  sqs,
};
