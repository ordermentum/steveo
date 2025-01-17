import merge from 'lodash.merge';
import {
  KafkaConsumerConfig,
  KafkaProducerConfig,
  KafkaConfiguration,
  SQSConfiguration,
  RedisConfiguration,
  Configuration,
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

export const getConfig = (
  config: KafkaConfiguration | RedisConfiguration | SQSConfiguration
) => {
  const baseConfig: Configuration = {
    engine: config.engine,
    shuffleQueue: !!config.shuffleQueue,
    workerConfig: config.workerConfig ?? {},
    queuePrefix: config.queuePrefix ?? '',
    upperCaseNames: config.upperCaseNames ?? true,
    middleware: config.middleware ?? [],
    terminationWaitCount: config.terminationWaitCount ?? 180,
    tasksPath: config.tasksPath,
  };

  if (baseConfig.engine === 'sqs') {
    const sqsConfig = config as SQSConfiguration;
    return {
      ...baseConfig,
      engine: 'sqs' as const,
      region: sqsConfig.region,
      apiVersion: sqsConfig.apiVersion,
      messageRetentionPeriod: sqsConfig.messageRetentionPeriod,
      receiveMessageWaitTimeSeconds: sqsConfig.receiveMessageWaitTimeSeconds,
      credentials: sqsConfig.credentials,
      maxNumberOfMessages: sqsConfig.maxNumberOfMessages,
      visibilityTimeout: sqsConfig.visibilityTimeout,
      waitTimeSeconds: sqsConfig.waitTimeSeconds,
      endpoint: sqsConfig.endpoint,
      httpOptions: sqsConfig.httpOptions,
      consumerPollInterval: sqsConfig.consumerPollInterval || 1000,
    } as SQSConfiguration;
  }

  if (baseConfig.engine === 'kafka') {
    const kafkaConfig = config as KafkaConfiguration;
    return {
      ...baseConfig,
      engine: 'kafka' as const,
      bootstrapServers: kafkaConfig.bootstrapServers,
      securityProtocol: kafkaConfig.securityProtocol ?? 'ssl',
      connectionTimeout: kafkaConfig.connectionTimeout ?? 30000, // 30 seconds
      waitToCommit: kafkaConfig.waitToCommit ?? true,
      consumer: merge({}, KafkaConsumerDefault, {
        ...(kafkaConfig.consumer ?? {}),
      }),
      producer: merge({}, KafkaProducerDefault, {
        ...(kafkaConfig.producer ?? {}),
      }),
      admin: kafkaConfig.admin ?? {},
      defaultTopicPartitions: kafkaConfig.defaultTopicPartitions ?? 6,
      defaultTopicReplicationFactor:
        kafkaConfig.defaultTopicReplicationFactor ?? 3,
    } as KafkaConfiguration;
  }

  if (baseConfig.engine === 'redis') {
    const redisConfig = config as RedisConfiguration;
    return {
      ...baseConfig,
      engine: 'redis' as const,
      redisHost: redisConfig.redisHost,
      redisPort: redisConfig.redisPort,
      visibilityTimeout: redisConfig.visibilityTimeout || 604800,
      redisMessageMaxsize: redisConfig.redisMessageMaxsize || 65536,
      consumerPollInterval: redisConfig.consumerPollInterval || 1000,
    } as RedisConfiguration;
  }

  throw new Error('Invalid engine');
};

export default getConfig;
