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
export type Callback<T = any, R = Promise<any>, C = any> = (
  payload: T,
  context?: C
) => R;

export type getPayload = (
  msg: any,
  topic: string
) => {
  timestamp: number;
  topic: string;
  message: any;
};

export type RunnerState = 'running' | 'terminating' | 'terminated' | 'paused';

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

export interface KafkaConfiguration extends Configuration {
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
  consumer?: KafkaConsumerConfig;
  producer?: KafkaProducerConfig;
  admin?: GlobalConfig;
}

export interface SQSConfiguration extends Configuration {
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
  waitToCommit?: boolean;
}

export interface RedisConfiguration extends Configuration {
  redisHost: string;
  redisPort: number;
  namespace?: string;
  redisMessageMaxsize?: number;
  consumerPollInterval?: number;
  visibilityTimeout?: number;
}

export interface DummyConfiguration extends Configuration {}

export interface Configuration {
  engine: 'sqs' | 'kafka' | 'redis' | 'dummy';
  queuePrefix?: string;
  shuffleQueue?: boolean;
  workerConfig?: Options;
  terminationWaitCount?: number;
  /**
   * @description Uppercase topic names
   */
  upperCaseNames?: boolean;
  /**
   * @description the absolute path to the tasks that need to be registered with this instance
   * This is required if you want to use the built in steveo runner
   */
  tasksPath?: string;
  middleware?: Middleware[];
}

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

export type TaskOptions = {
  attributes?: Attribute[];
  queueName?: string;
  waitToCommit?: boolean;

  fifo?: boolean;
  deadLetterQueue?: boolean;
  maxReceiveCount?: number;

  // num_partitions and replication_factor are used for kafka
  replication_factor?: number;
  num_partitions?: number;
};

export interface IRegistry {
  registeredTasks: TaskList;
  events: IEvent;
  items: Map<string, string>;
  heartbeat: number;

  addNewTask(task: ITask, topic?: string): void;
  removeTask(task: ITask): void;
  getTopics(): string[];
  getTaskTopics(): string[];
  getTopic(name: string): string;
  emit(name: string, ...args: any): void;
  addTopic(name: string, topic?: string): void;
  getTask(topic: string): ITask | null;
}

export interface ITask<T = any, R = any> {
  config: Configuration;
  registry: IRegistry;
  subscribe: Callback<T, R>;
  name: string;
  topic: string;
  options: TaskOptions;
  producer: any;
  publish(payload: T | T[], context?: { key: string }): Promise<void>;
}

export interface IRunner<T = any, M = any> {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  receive(messages: M, topic: string, partition: number): Promise<void>;
  process(topics?: Array<string>): Promise<T>;
  createQueues(): Promise<boolean>;

  healthCheck: () => Promise<void>;

  stop(): Promise<void>;
  reconnect(): Promise<void>;
}

export type CustomTopicFunction = (topic: string) => string;

export interface ISteveo {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  producer: IProducer;
  task(topic: string, callBack: Callback, opts?: TaskOptions): ITask;
  runner(): IRunner;
}

export type AsyncWrapper = {
  promise(): Promise<void>;
};

export type Producer = {
  send(data: any, sendParams: any): void;
  init(): void;
  createQueueAsync(params: any): Promise<void>;
  createQueue(params: any): Promise<boolean>;
  sendMessage(params: any): AsyncWrapper;
  listQueuesAsync(): Array<string>;
  getQueueAttributesAsync(params: any): any;
  getQueueAttributes(params: any): any;
  stop(): Promise<void>;
};

export interface IProducer<P = any> {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  producer?: any;
  initialize(topic?: string): Promise<P>;
  getPayload(msg: any, topic: string): any;
  send<T = any>(
    topic: string,
    payload: T,
    key?: string,
    context?: unknown
  ): Promise<void>;
  // FIXME: Replace T = any with Record<string, any> or an explicit list of
  // types we will handle as first-class citizens,
  // e.g. `Record<string, any> | string`.
  stop(): Promise<void>;
}

export type MiddlewareContext<P = any> = {
  payload: P;
  topic: string;
};
export type MiddlewareCallback = (context: MiddlewareContext) => Promise<void>;
export interface Middleware {
  // producer and consumer middleware
  publish<Ctx = any, C = MiddlewareCallback>(
    context: MiddlewareContext<Ctx>,
    callback: C
  );
  consume<Ctx = any, C = MiddlewareCallback>(
    context: MiddlewareContext<Ctx>,
    callback: C
  );
}

export type sqsUrls = Record<string, string>;
