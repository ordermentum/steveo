import { SQS, SQSClientConfig } from '@aws-sdk/client-sqs';
// import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Configuration, SQSConfiguration } from '../common';

export const getSqsInstance = (config: Configuration): SQS => {
  const sqsConfig: SQSConfiguration = config as SQSConfiguration;
  const conf: SQSClientConfig = {
    region: sqsConfig.region,
    credentials: sqsConfig.credentials,
    endpoint: sqsConfig.endpoint,
  };
  // This is set as https by default in AWS SDK 3
  // if (sqsConfig.httpOptions) {
  //   conf.requestHandler = sqsConfig.httpOptions as NodeHttpHandler;
  // }
  return new SQS(conf);
};
