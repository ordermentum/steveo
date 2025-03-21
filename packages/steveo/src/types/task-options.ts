import { ReceiveMessageRequest } from '@aws-sdk/client-sqs';
import { DefaultJobOptions } from 'bullmq';
import { ConsumerTopicConfig } from 'node-rdkafka';

export type Attribute = {
  name: string;
  dataType: string;
  value: string;
};

export type KafkaTaskOptions =
  | ConsumerTopicConfig
  | {
      // num_partitions and replication_factor are used for kafka
      replication_factor?: number;
      num_partitions?: number;
    };

export type SQSTaskOptions =
  | ReceiveMessageRequest
  | {
      attributes?: Attribute[];
      fifo?: boolean;
      deadLetterQueue?: boolean;
      maxReceiveCount?: number;
    };

export type RedisTaskOptions = DefaultJobOptions;

type BaseTaskOptions = {
  waitToCommit?: boolean;
  queueName?: string;
};

export type TaskOptions = {
  sqs: SQSTaskOptions & BaseTaskOptions;
  kafka: KafkaTaskOptions & BaseTaskOptions;
  redis: RedisTaskOptions & BaseTaskOptions;
  dummy: BaseTaskOptions;
};
