import merge from 'lodash.merge';
import {
  Configuration,
  KafkaConsumerConfig,
  KafkaProducerConfig,
  KafkaConfiguration,
  SQSConfiguration,
  RedisConfiguration,
} from './common';

const KafkaConsumerDefault: KafkaConsumerConfig = {
  global: {
    'socket.keepalive.enable': true,
    'enable.auto.commit': false,
    'group.id': 'KAFKA_CONSUMERS',
  },
  topic: {
    'auto.offset.reset': 'latest',
  },
};

const KafkaProducerDefault: KafkaProducerConfig = {
  global: {},
  topic: {},
};

export const getConfig = (config: Configuration): Configuration => {
  const parameters: any = {};
  parameters.engine = config.engine ?? 'kafka';
  parameters.shuffleQueue = !!config.shuffleQueue;
  parameters.workerConfig = config.workerConfig ?? {};
  parameters.queuePrefix = config.queuePrefix ?? '';
  parameters.upperCaseNames = config.upperCaseNames ?? true;

  if (parameters.engine === 'kafka') {
    const kafkaConfig = config as KafkaConfiguration;
    parameters.bootstrapServers = kafkaConfig.bootstrapServers;
    parameters.securityProtocol = kafkaConfig.securityProtocol ?? 'ssl';
    parameters.connectionTimeout = kafkaConfig.connectionTimeout ?? 30000; // 30 seconds
    parameters.waitToCommit = kafkaConfig.waitToCommit ?? true;
    parameters.consumer = merge(KafkaConsumerDefault, {
      ...(kafkaConfig.consumer ?? {}),
    });
    parameters.producer = merge(KafkaProducerDefault, {
      ...(kafkaConfig.producer ?? {}),
    });
    parameters.admin = kafkaConfig.admin ?? {};
    parameters.defaultTopicParitions = kafkaConfig.defaultTopicParitions ?? 6;
    parameters.defaultTopicReplicationFactor =
      kafkaConfig.defaultTopicReplicationFactor ?? 3;
    // A sensible default of minimum number of brokers available in msk (basic cluster)
    if(parameters.defaultTopicReplicationFactor < 3) {
      throw new Error("Replication factor cannot be less than the number of brokers");
    }
  } else if (parameters.engine === 'sqs') {
    const sqsConfig = config as SQSConfiguration;
    parameters.region = sqsConfig.region;
    parameters.apiVersion = sqsConfig.apiVersion;
    parameters.messageRetentionPeriod = sqsConfig.messageRetentionPeriod;
    parameters.receiveMessageWaitTimeSeconds =
      sqsConfig.receiveMessageWaitTimeSeconds;
    parameters.accessKeyId = sqsConfig.accessKeyId;
    parameters.secretAccessKey = sqsConfig.secretAccessKey;
    parameters.maxNumberOfMessages = sqsConfig.maxNumberOfMessages;
    parameters.visibilityTimeout = sqsConfig.visibilityTimeout;
    parameters.waitTimeSeconds = sqsConfig.waitTimeSeconds;
    parameters.endpoint = sqsConfig.endpoint;
    parameters.httpOptions = sqsConfig.httpOptions;
    parameters.consumerPollInterval = sqsConfig.consumerPollInterval || 1000;
  } else if (parameters.engine === 'redis') {
    const redisConfig = config as RedisConfiguration;
    parameters.redisHost = redisConfig.redisHost;
    parameters.redisPort = redisConfig.redisPort;
    parameters.visibilityTimeout = redisConfig.visibilityTimeout || 604800;
    parameters.redisMessageMaxsize = redisConfig.redisMessageMaxsize || 65536;
    parameters.consumerPollInterval = redisConfig.consumerPollInterval || 1000;
  }
  return parameters;
};

export default getConfig;
