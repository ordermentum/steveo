import { load } from 'ts-dotenv';
import Steveo, { SQSConfiguration } from 'steveo';
import { postgresFactory, PostgresStorageConfig } from '@steveojs/store-postgres';
import bunyan from 'bunyan';

export const logger = bunyan.createLogger({ name: 'workflow-test' });

// Parse and validate the environment to the defined schema
const env = load({
  AWS_REGION: String,
  AWS_ENDPOINT: {
    type: String,
    optional: true,
  },
  AWS_ACCESS_KEY: {
    type: String,
    optional: true,
  },
  AWS_SECRET_ACCESS_KEY: {
    type: String,
    optional: true,
  },
  DATASOURCE_URL: String,
});

const sqsConfig: SQSConfiguration = {
  region: env.AWS_REGION,
  apiVersion: '2012-11-05',
  receiveMessageWaitTimeSeconds: '20',
  messageRetentionPeriod: '604800',
  engine: 'sqs',
  endpoint: env.AWS_ENDPOINT,
  accessKeyId: env.AWS_ACCESS_KEY,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  maxNumberOfMessages: 1,
  visibilityTimeout: 180,
  waitTimeSeconds: 20,
};

// Instantiate the concrete implementation of the postgres storage
const postgresConfig: PostgresStorageConfig = {
  datasourceUrl: env.DATASOURCE_URL,
};

const storage = postgresFactory(postgresConfig, logger);

// Create steveo instance with messaging config and storage instance
export const steveo = Steveo(sqsConfig, logger, storage);
