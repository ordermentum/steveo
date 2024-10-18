import { SQS, SQSClientConfig } from '@aws-sdk/client-sqs';
import { Configuration, SQSConfiguration } from '../common';

export const getSqsInstance = (config: Configuration): SQS => {
  const sqsConfig: SQSConfiguration = config as SQSConfiguration;
  const conf: SQSClientConfig = {
    region: sqsConfig.region,
  };

  return new SQS(conf);
};
