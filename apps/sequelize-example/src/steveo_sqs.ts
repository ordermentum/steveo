import Steveo, { SQSConfiguration } from 'steveo';
import https from 'https';
import config from 'config';
import path from 'path';
import logger from './logger';

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
  accessKeyId: awsAccessKey,
  secretAccessKey: awsSecretKey,
  shuffleQueue: false,
  endpoint: sqsEndpoint,
  maxNumberOfMessages: 1,
  workerConfig: {
    max: workerCount,
  },
  visibilityTimeout: 180,
  waitTimeSeconds: 2,
  consumerPollInterval: steveoPollInterval,
  httpOptions:
    nodeEnv === 'development'
      ? {
          agent: new https.Agent({
            rejectUnauthorized: false,
          }),
        }
      : undefined,
  // Paul - Commented due to compilation error it caused
  // childProcesses: {
  //   instancePath: __filename,
  //   args: nodeEnv === 'production' ? [] : ['-r', 'ts-node/register'],
  // },
  tasksPath: path.resolve(__dirname, '../tasks'),
  upperCaseNames: true,
};

const steveo = Steveo(steveoConfig, logger);

steveo.events.on(
  'runner_failure',
  async (topic: string, ex: Error, params: any) => {
    logger.error(ex, { tags: { topic }, params });
  }
);

export default steveo;
