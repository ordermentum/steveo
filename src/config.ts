import { Configuration } from './common';

export const getConfig = (config: Configuration): Configuration => {
  const parameters: any = {};
  parameters.engine = config.engine || 'kafka';
  parameters.shuffleQueue = false || config.shuffleQueue;
  parameters.workerConfig = {} || config.workerConfig;

  if (parameters.engine === 'kafka') {
    parameters.groupdId = config.groupdId ?? '';
    parameters.bootstrapServers = config.bootstrapServers;
    parameters.compressionCodec = config.compressionCodec ?? 'gzip';
    parameters.connectionTimeout = config.connectionTimeout ?? 30000; // 30 seconds
    parameters.waitToCommit = config.waitToCommit ?? true;
    parameters.producerAcks = config.producerAcks ?? -1;
  } else if (parameters.engine === 'sqs') {
    parameters.region = config.region;
    parameters.apiVersion = config.apiVersion;
    parameters.messageRetentionPeriod = config.messageRetentionPeriod;
    parameters.receiveMessageWaitTimeSeconds =
      config.receiveMessageWaitTimeSeconds;
    parameters.accessKeyId = config.accessKeyId;
    parameters.secretAccessKey = config.secretAccessKey;
    parameters.maxNumberOfMessages = config.maxNumberOfMessages;
    parameters.visibilityTimeout = config.visibilityTimeout;
    parameters.waitTimeSeconds = config.waitTimeSeconds;
    parameters.endpoint = config.endpoint;
    parameters.httpOptions = config.httpOptions;
    parameters.consumerPollInterval = config.consumerPollInterval || 1000;
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
