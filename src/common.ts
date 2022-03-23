import { HTTPOptions } from 'aws-sdk';
import { Pool as GenericPool, Options } from 'generic-pool';
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
  securityProtocol?:
    | 'plaintext'
    | 'ssl'
    | 'sasl_plaintext'
    | 'sasl_ssl'
    | undefined;
  defaultTopicPartitions?: number;
  defaultTopicReplicationFactor?: number;
  /**
   * @description Wait for commiting the message? True - wait, False - immediate commit, Default - True
   */
  waitToCommit?: boolean;
  /**
   * @description Consumer/Producer connection ready timeout
   */
  connectionTimeout?: number;
  parseMessage?: boolean;
  consumer?: KafkaConsumerConfig;
  producer?: KafkaProducerConfig;
  admin?: GlobalConfig;
};

export type SQSConfiguration = {
  region: string;
  apiVersion: string;
  messageRetentionPeriod: string;
  receiveMessageWaitTimeSeconds: string;
  accessKeyId?: string;
  secretAccessKey?: string;
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

export type ChildProcessConfig = {
  /**
   * @description the absolute path to the steveo instance to make child processes of
   */
  instancePath: string;
  /**
   * @description The arguments to be passed when forking child process (mainly for interoperability with typescript)
   * @example for ts-node we'll pass ['-r', 'ts-node/register']
   */
  args: string[];
};

export type Configuration = (
  | SQSConfiguration
  | KafkaConfiguration
  | RedisConfiguration
) & {
  engine: 'sqs' | 'kafka' | 'redis';
  queuePrefix?: string;
  shuffleQueue?: boolean;
  workerConfig?: Options;
  /**
   * @description Uppercase topic names
   */
  upperCaseNames?: boolean;
  /**
   * @description [Consumers only] Create a child process of a consumer per topic
   * @default false
   * @summary 5 topics passed to the instance will fork 5 child processes
   */
  childProcesses?: ChildProcessConfig;
  /**
   * @description the absolute path to the tasks that need to be registered with this instance
   * This is required if you want to use the built in steveo runner and/or the child process functionality
   */
  tasksPath?: string;
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
  reconnect(): Promise<void>;
  createQueues(): Promise<void>;
}

export type CustomTopicFunction = (topic: string) => string;

export type TaskOpts = {
  queueName?: string;
};
export interface ISteveo {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  producer: IProducer;
  task(
    topic: string,
    callBack: Callback,
    attributes?: Attribute[],
    opts?: TaskOpts
  ): ITask;
  runner(): IRunner;
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

export type CreateKafkaTopic = {
  topic: string;
};

export type CreateQueueConfig =
  | CreateRedisTopic
  | CreateSqsTopic
  | CreateKafkaTopic;

export type Hooks = {
  preProcess?: () => Promise<void>;
  healthCheck?: () => Promise<void>;
  terminationCheck?: () => Promise<boolean>;
};
