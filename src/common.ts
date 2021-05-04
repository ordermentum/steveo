import { HTTPOptions } from 'aws-sdk';
import {Pool as GenericPool, Options} from 'generic-pool';
import {
  ConsumerGlobalConfig,
  ConsumerTopicConfig,
  GlobalConfig,
  ProducerGlobalConfig,
  ProducerTopicConfig,
} from 'node-rdkafka';

/**
 * FIXME: for callbacks that don't take an argument, need to specify
 * T = void to make the parameter optional
 */
export type Callback<T = any, R = Promise<any>> = (payload: T) => R;

export type getPayload = (
  msg: any,
  topic: string
) => {
  timestamp: number;
  topic: string;
  message: any;
};

export interface Logger {
  trace(format: any, ...params: any[]): void;
  info(format: any, ...params: any[]): void;
  debug(format: any, ...params: any[]): void;
  error(format: any, ...params: any[]): void;
}

export type Engine = 'kafka' | 'sqs' | 'redis';

export type KafkaConsumerConfig = {
  global: ConsumerGlobalConfig;
  topic: ConsumerTopicConfig;
};

export type KafkaProducerConfig = {
  global: ProducerGlobalConfig;
  topic: ProducerTopicConfig;
};

export type KafkaConfiguration = {
  bootstrapServers: string;
  defaultTopicParitions?: number;
  defaultTopicReplicationFactor?: number;
  /**
   * @description Wait for commiting the message? True - wait, False - immediate commit, Default - True
   */
  waitToCommit?: boolean;
  /**
   * @description Consumer/Producer connection ready timeout
   */
  connectionTimeout?: number;
  consumer?: KafkaConsumerConfig;
  producer?: KafkaProducerConfig;
  admin?: GlobalConfig;
};

export type SQSConfiguration = {
  region: string;
  apiVersion: string;
  messageRetentionPeriod: string;
  receiveMessageWaitTimeSeconds: string;
  accessKeyId: string;
  secretAccessKey: string;
  shuffleQueue: boolean;
  maxNumberOfMessages: number;
  visibilityTimeout: number;
  waitTimeSeconds: number;
  endpoint?: string;
  httpOptions?: HTTPOptions;
  consumerPollInterval?: number;
};

export type RedisConfiguration = {
  redisHost: string;
  redisPort: number;
  redisMessageMaxsize?: number;
  workerConfig: any;
  consumerPollInterval?: number;
  visibilityTimeout?: number;
};

export type DummyConfiguration = any;

export type Configuration =
  (SQSConfiguration | KafkaConfiguration | RedisConfiguration) & {
    engine: 'sqs' | 'kafka' | 'redis',
    shuffleQueue?: boolean;
    workerConfig?: Options;
  };

export type Attribute = {
  name: string;
  dataType: string;
  value: string;
};

export type Pool<T> = GenericPool<T>;

export type Registry = {};

export interface IEvent {
  emit(eventName: string, ...any): any;
  on(eventName: string, ...any): any;
}

export type TaskList = {
  [key: string]: ITask;
};

export interface IRegistry {
  registeredTasks: TaskList;
  events: IEvent;
  items: Map<string, string>;
  addNewTask(task: ITask, topic?: string): void;
  removeTask(task: ITask): void;
  getTopics(): string[];
  getTaskTopics(): string[];
  getTopic(name: string): string;
  addTopic(name: string, topic?: string): void;
  getTask(topic: string): ITask | null;
}

export interface ITask<T = any, R = any> {
  config: Configuration;
  registry: IRegistry;
  subscribe: Callback<T, R>;
  name: string;
  topic: string;
  attributes: any;
  producer: any;
  publish(payload: T | T[]): Promise<void>;
}

export interface IRunner<T = any, M = any> {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  receive(messages: M, topic: string, partition: number): Promise<void>;
  process(topics: Array<string>): Promise<T>;
  disconnect(): Promise<void>;
}

export type CustomTopicFunction = (topic: string) => string;
export interface ISteveo {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  producer: IProducer;
  getTopicName?: CustomTopicFunction;
  task(topic: string, callBack: Callback, opts?: any): ITask;
  runner(): IRunner;
  customTopicName(cb: CustomTopicFunction): void;
  disconnect(): void;
}

export type AsyncWrapper = {
  promise(): Promise<void>;
};

export type Producer = {
  send(data: any, sendParams: any): void;
  init(): void;
  createQueueAsync(params: any): Promise<void>;
  createQueue(params: any): AsyncWrapper;
  sendMessageAsync(params: any): Promise<void>;
  sendMessage(params: any): AsyncWrapper;
  listQueuesAsync(): Array<string>;
  getQueueAttributesAsync(params: any): any;
  getQueueAttributes(params: any): any;
};

export interface IProducer<P = any> {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  producer?: any;
  initialize(topic?: string): Promise<P>;
  getPayload(msg: any, topic: string): any;
  send<T = any>(topic: string, payload: T, key?: string): Promise<void>;
  disconnect(): Promise<void>;
}

export type sqsUrls = {
  [key: string]: any;
};

export type CreateRedisTopic = {
  topic: string;
  visibilityTimeout: number;
  maxsize: number;
};

export type CreateSqsTopic = {
  topic: string;
  messageRetentionPeriod: string;
  receiveMessageWaitTimeSeconds: string;
};

export type CreateQueueConfig = CreateRedisTopic | CreateSqsTopic;

export type Hooks = {
  preProcess?: () => Promise<void>;
  healthCheck?: () => Promise<void>;
  terminationCheck?: () => Promise<boolean>;
};
