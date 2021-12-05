import path from 'path';
import Steveo from '../../src';
import logger from './logger';

const steveo = Steveo(
  {
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    apiVersion: '2012-11-05',
    receiveMessageWaitTimeSeconds: '20',
    messageRetentionPeriod: '604800',
    engine: 'sqs',
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    maxNumberOfMessages: 1,
    visibilityTimeout: 180,
    waitTimeSeconds: 20,
    tasksPath: path.join(__dirname, 'tasks'),
    childProcesses: {
      instancePath: path.join(__dirname, 'steveo'),
      args: ['-r', 'ts-node/register'],
    },
  },
  logger
);

export default steveo;
