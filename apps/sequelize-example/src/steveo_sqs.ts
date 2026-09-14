import path from 'node:path';
import config from 'config';
import { Steveo, SQSConfiguration } from 'steveo';
import logger from './logger.js';

const workerCount = config.get<number>('steveoWorkerCount');
const steveoPollInterval = config.get<number>('steveoPollInterval');
const nodeEnv = config.get('nodeEnv');
const awsAccessKey = config.has('awsAccessKey')
  ? config.get<string>('awsAccessKey')
  : undefined;
const awsSecretKey = config.has('awsSecretKey')
  ? config.get<string>('awsSecretKey')
  : undefined;
const awsRegion = config.get<string>('awsRegion');
const sandbox = config.get('sandbox');
const sqsEndpoint = config.has('sqsEndpoint')
  ? config.get<string>('sqsEndpoint')
  : undefined;

const steveoConfig: SQSConfiguration = {
  region: awsRegion,
  apiVersion: '2012-11-05',
  receiveMessageWaitTimeSeconds: '20',
  messageRetentionPeriod: '604800',
  engine: 'sqs',
  queuePrefix: sandbox ? 'testing' : `${nodeEnv}`,
  // Omitted entirely when unset so the SDK falls back to the default
  // credential chain (instance role, shared config, env vars).
  ...(awsAccessKey && awsSecretKey
    ? {
        credentials: {
          accessKeyId: awsAccessKey,
          secretAccessKey: awsSecretKey,
        },
      }
    : {}),
  shuffleQueue: false,
  endpoint: sqsEndpoint,
  maxNumberOfMessages: 1,
  workerConfig: {
    max: workerCount,
  },
  visibilityTimeout: 180,
  waitTimeSeconds: 2,
  consumerPollInterval: steveoPollInterval,
  tasksPath: path.resolve(import.meta.dirname, './tasks'),
  upperCaseNames: true,
};

const steveo = new Steveo<'sqs'>(steveoConfig, logger);

steveo.events.on(
  'runner_failure',
  async (topic: string, ex: Error, params: any) => {
    logger.error({ err: ex, tags: { topic }, params }, 'runner failure');
  }
);

export default steveo;
