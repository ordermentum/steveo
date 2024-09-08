import { load } from 'ts-dotenv';
import Steveo from 'steveo/src/index';
import { SQSConfiguration,  } from 'steveo/lib/common';
import bunyan from 'bunyan';

export const logger = bunyan.createLogger({ name: 'workflow-test' });

const env = load({
  AWS_REGION: String,
  AWS_ACCESS_KEY: String,
  AWS_SECRET_ACCESS_KEY: String,
});

const sqsConfig: SQSConfiguration = {
  region: env.AWS_REGION,
  apiVersion: '2012-11-05',
  receiveMessageWaitTimeSeconds: '20',
  messageRetentionPeriod: '604800',
  engine: 'sqs',
  accessKeyId: env.AWS_ACCESS_KEY,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  maxNumberOfMessages: 1,
  visibilityTimeout: 180,
  waitTimeSeconds: 20,
};

export const steveo = Steveo(sqsConfig, logger);




