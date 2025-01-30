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
    /**
     * See: https://www.confluent.io/blog/incremental-cooperative-rebalancing-in-kafka/
     * This is a new feature in Kafka 2.4.0 that allows consumers to join and leave the group
     * without triggering a full rebalance. This can be useful for scaling out consumers in a
     * consumer group without causing a rebalance of the entire group.
     * The default value is 'eager' which means that the consumer will trigger a rebalance
     * when it joins or leaves the group, which is STOP THE WORLD behavior.
     */
    'partition.assignment.strategy': 'cooperative-sticky',
  },
  topic: {
    'auto.offset.reset': 'latest',
  },
};

const KafkaProducerDefault: KafkaProducerConfig = {
  global: {},
  topic: {},
};

export const getConfig = (config: Configuration) => {
  const parameters: any = {};
  parameters.engine = config.engine ?? 'kafka';
  parameters.shuffleQueue = !!config.shuffleQueue;
  parameters.workerConfig = config.workerConfig ?? {};
  parameters.queuePrefix = config.queuePrefix ?? '';
  parameters.upperCaseNames = config.upperCaseNames ?? true;
  parameters.middleware = config.middleware ?? [];
  parameters.terminationWaitCount = config.terminationWaitCount ?? 180;
  parameters.tasksPath = config.tasksPath;

  if (parameters.engine === 'kafka') {
    const kafkaConfig = config as KafkaConfiguration;
    parameters.bootstrapServers = kafkaConfig.bootstrapServers;
    parameters.securityProtocol = kafkaConfig.securityProtocol ?? 'ssl';
    parameters.connectionTimeout = kafkaConfig.connectionTimeout ?? 30000; // 30 seconds
    parameters.waitToCommit = kafkaConfig.waitToCommit ?? true;
    parameters.consumer = merge({}, KafkaConsumerDefault, {
      ...(kafkaConfig.consumer ?? {}),
    });
    parameters.producer = merge({}, KafkaProducerDefault, {
      ...(kafkaConfig.producer ?? {}),
    });
    parameters.admin = kafkaConfig.admin ?? {};
    parameters.defaultTopicPartitions = kafkaConfig.defaultTopicPartitions ?? 6;
    parameters.defaultTopicReplicationFactor =
      kafkaConfig.defaultTopicReplicationFactor ?? 3;
  } else if (parameters.engine === 'sqs') {
    const sqsConfig = config as SQSConfiguration;
    parameters.region = sqsConfig.region;
    parameters.apiVersion = sqsConfig.apiVersion;
    parameters.messageRetentionPeriod = sqsConfig.messageRetentionPeriod;
    parameters.receiveMessageWaitTimeSeconds =
      sqsConfig.receiveMessageWaitTimeSeconds;
    parameters.credentials = sqsConfig.credentials;
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
