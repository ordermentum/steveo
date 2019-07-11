import { Configuration } from './common';
import { kafkaCompression } from './producer/kafka';

export const getConfig = (config: Configuration): Configuration => {
  const parameters: any = {};
  parameters.engine = config.engine || 'kafka';
  parameters.shuffleQueue = false || config.shuffleQueue;
  parameters.workerConfig = {} || config.workerConfig;

  if (parameters.engine === 'kafka') {
    parameters.kafkaConnection = config.kafkaConnection;
    parameters.clientId = config.clientId;
    parameters.kafkaGroupId = config.kafkaGroupId || 'STEVEO_TASKS';
    parameters.kafkaCodec = config.kafkaCodec || kafkaCompression.GZIP;
    parameters.logLevel = config.logLevel || 5;
    parameters.kafkaSendAttempts = config.kafkaSendAttempts || 2;
    parameters.kafkaSendDelayMin = config.kafkaSendDelayMin || 100;
    parameters.kafkaSendDelayMax = config.kafkaSendDelayMax || 300;
    parameters.consumerPollInterval = config.consumerPollInterval || 1000;
  } else if (parameters.engine === 'sqs') {
    parameters.region = config.region;
    parameters.apiVersion = config.apiVersion;
    parameters.messageRetentionPeriod = config.messageRetentionPeriod;
    parameters.receiveMessageWaitTimeSeconds = config.receiveMessageWaitTimeSeconds;
    parameters.accessKeyId = config.accessKeyId;
    parameters.secretAccessKey = config.secretAccessKey;
    parameters.maxNumberOfMessages = config.maxNumberOfMessages;
    parameters.visibilityTimeout = config.visibilityTimeout;
    parameters.waitTimeSeconds = config.waitTimeSeconds;
  } else if (parameters.engine === 'redis') {
    parameters.redisHost = config.redisHost;
    parameters.redisPort = config.redisPort;
    parameters.visibilityTimeout = config.visibilityTimeout || 604800;
    parameters.redisMessageMaxsize = config.redisMessageMaxsize || 65536;
    parameters.consumerPollInterval = config.consumerPollInterval || 1000;
  }
  return parameters;
};

export default getConfig;