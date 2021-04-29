import {
  Configuration,
  KafkaConsumerConfig,
  KafkaProducerConfig,
  KafkaConfiguration,
} from './common';

const KafkaConsumerDefault: KafkaConsumerConfig = {
  global: {
    'socket.keepalive.enable': true,
    'enable.auto.commit': false,
    'group.id': "123"
  },
  topic: {},
};

const KafkaProducerDefault: KafkaProducerConfig = {
  global: {},
  topic: {},
};

export const getConfig = (config: Configuration): Configuration => {
  const parameters: any = {};
  parameters.engine = config.engine || 'kafka';
  parameters.shuffleQueue = false || config.shuffleQueue;
  parameters.workerConfig = {} || config.workerConfig;

  if (parameters.engine === 'kafka') {
    const kafkaConfig = config as KafkaConfiguration;
    parameters.bootstrapServers = kafkaConfig.bootstrapServers;
    parameters.connectionTimeout = kafkaConfig.connectionTimeout ?? 30000; // 30 seconds
    parameters.waitToCommit = kafkaConfig.waitToCommit ?? true;
    parameters.consumer = {
      ...KafkaConsumerDefault,
      ...(kafkaConfig.consumer ?? {}),
    };
    parameters.producer = {
      ...KafkaProducerDefault,
      ...(kafkaConfig.producer ?? {}),
    };
    parameters.admin = kafkaConfig.admin ?? {};
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
