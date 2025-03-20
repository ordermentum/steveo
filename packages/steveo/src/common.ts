import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Pool as GenericPool, Options } from 'generic-pool';
import {
  ConsumerGlobalConfig,
  ConsumerTopicConfig,
  GlobalConfig,
  ProducerGlobalConfig,
  ProducerTopicConfig,
} from 'node-rdkafka';
import { DefaultJobOptions } from 'bullmq';
import { Workflow } from './runtime/workflow';
import { TaskOptions } from './types/task-options';
import { Logger } from './lib/logger';

// https://github.com/aws/aws-sdk-js-v3/issues/3063
// 🤌🏾🤌🏾🤌🏾
declare global {
  interface ReadableStream {}
}
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

export type KafkaConsumerConfig = {
  global: ConsumerGlobalConfig;
  topic: ConsumerTopicConfig;
};

export type KafkaProducerConfig = {
  global: ProducerGlobalConfig;
  topic: ProducerTopicConfig;
};

export interface KafkaConfiguration extends Configuration {
  engine: 'kafka';
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
  engine: 'sqs';
  region?: string;
  apiVersion: string;
  messageRetentionPeriod: string;
  receiveMessageWaitTimeSeconds: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  maxNumberOfMessages: number;
  visibilityTimeout: number;
  waitTimeSeconds: number;
  endpoint?: string;
  httpOptions?: NodeHttpHandler;
  consumerPollInterval?: number;
  waitToCommit?: boolean;
}

export interface RedisConfiguration extends Configuration {
  engine: 'redis';
  connectionUrl: string;
  redisMessageMaxsize?: number;
  consumerPollInterval?: number;
  visibilityTimeout?: number;
}

export interface DummyConfiguration extends Configuration {
  engine: 'dummy';
}

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

export type Pool<T> = GenericPool<T>;

export interface IEvent {
  emit(eventName: string, ...any): any;
  on(eventName: string, ...any): any;
}

export interface StepRuntime<T = any, R = any> {
  subscribe: Callback<T, R>;
  name: string;
  topic: string;
  options?: TaskOptions;
}

export type RegistryElem = ITask | Workflow | StepRuntime;

export type TaskList = {
  [key: string]: RegistryElem;
};

export interface IRegistry {
  registeredTasks: TaskList;
  events: IEvent;
  items: Map<string, string>;
  heartbeat: number;

  addNewTask(task: RegistryElem, topic?: string): void;
  removeTask(task: RegistryElem): void;
  getTopics(): string[];
  getTaskTopics(): string[];
  getTopic(name: string): string;
  emit(name: string, ...args: any): void;
  addTopic(name: string, topic?: string): void;
  getTask(topic: string): RegistryElem | null;
}

/**
 * @description Kafka message routing options
 */
export interface KafkaMessageRoutingOptions {
  /**
   * @description Determines which partition this message lands in.
   *         See https://www.confluent.io/learn/kafka-message-key/
   */
  key?: string;
}

/**
 * @description SQS FIFO message routing options
 */
export interface SQSMessageRoutingOptions {
  /**
   * @description Groups messages with the same key.
   *         See https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/using-messagegroupid-property.html
   */
  key?: string;
  /**
   * @description The message deduplication ID.
   * SQS FIFO engine uses content-based deduplication by default if no message deduplication ID is provided.
   */
  deDuplicationId?: string;
}

export interface RedisMessageRoutingOptions extends DefaultJobOptions {}

export type MessageRoutingOptions = {
  sqs: SQSMessageRoutingOptions;
  kafka: KafkaMessageRoutingOptions;
  redis: RedisMessageRoutingOptions;
  dummy: Record<string, any>;
};

export interface ITask<T = any, R = any> {
  config: Configuration;
  registry: IRegistry;
  subscribe: Callback<T, R>;
  name: string;
  topic: string;
  options?: TaskOptions[keyof TaskOptions];
  producer: any;
  publish(
    payload: T | T[],
    options?: MessageRoutingOptions[keyof MessageRoutingOptions]
  ): Promise<void>;
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
  publish: <T extends PayloadT>(
    name: string,
    payload: T,
    options?: MessageRoutingOptions[keyof MessageRoutingOptions]
  ) => Promise<void>;
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
  initialize(
    topic?: string,
    options?: MessageRoutingOptions[keyof MessageRoutingOptions]
  ): Promise<P>;
  getPayload<T = any>(
    msg: T,
    topic: string,
    options?: MessageRoutingOptions[keyof MessageRoutingOptions]
  ): any;
  send<T = any>(
    topic: string,
    payload: T,
    options?: MessageRoutingOptions[keyof MessageRoutingOptions]
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

export type PayloadT = Record<string, any> | Record<string, any>[] | undefined;
