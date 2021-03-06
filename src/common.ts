import { HTTPOptions } from 'aws-sdk';

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

export type KafkaParams = {
  kafkaConnection: string;
  kafkaGroupId: string;
  clientId?: string;
  kafkaCodec: string;
  logger: Logger;
};

export type Engine = 'kafka' | 'sqs' | 'redis';
export type KafkaConfiguration = {
  kafkaConnection: string;
  clientId: string;
  kafkaGroupId: string;
  logLevel: number;
  kafkaCodec: number | string;
  kafkaSendAttempts: number;
  kafkaSendDelayMin: number;
  kafkaSendDelayMax: number;
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
  endPoint?: string;
  httpOptions?: HTTPOptions;
};

export type RedisConfiguration = {
  redisHost: string;
  redisPort: string;
  redisMessageMaxsize: number;
  workerConfig: any;
  consumerPollInterval: number;
};

export type DummyConfiguration = any;

export type Configuration =
  | SQSConfiguration
  | KafkaConfiguration
  | RedisConfiguration
  | any;

export type Attribute = {
  name: string;
  dataType: string;
  value: string;
};

export type Pool = {
  acquire(): Promise<any>;
  release(client: any): Promise<any>;
};

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
  attributes: Attribute[];
  producer: any;
  publish(payload: T | T[]): Promise<void>;
}

export type Consumer = {
  commitOffset(values: any): void;
  init(config: any[]): any;
};

export interface IRunner {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  receive(messages: any[], topic: string, partition: string): Promise<void>;
  process(topics: Array<string>): Promise<any>;
}

export interface IMetric {
  config: Configuration;
  groupId?: string;
  initialize(): Promise<void>;
}

export type CustomTopicFunction = (topic: string) => string;
export interface ISteveo {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  producer: IProducer;
  getTopicName?: CustomTopicFunction;
  task(topic: string, callBack: Callback): ITask;
  runner(): IRunner;
  customTopicName(cb: CustomTopicFunction): void;
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

export interface IProducer {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  producer?: any;
  initialize(topic?: string): Promise<void>;
  getPayload(msg: any, topic: string): any;
  send<T = any>(topic: string, payload: T): Promise<void>;
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
