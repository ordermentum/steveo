// @flow
export type Callback = (x: any) => any;

export type ProducerPayload = (msg: Object, topic: string) => {
  timestamp: number,
  topic: string,
  message: Object,
}

export type Logger = {
  logLevel: number,
  info(...any): void,
  error(...any): void,
};

export type KafkaParams = {
  kafkaConnection: string,
  kafkaGroupId: string,
  clientId: ?string,
  kafkaCodec: string,
  logger: Logger,
};

export type Engine = 'kafka' | 'sqs';

export type Configuration = {
  kafkaConnection: string,
  clientId: string,
  kafkaGroupId: string,
  logLevel: number,
  kafkaCodec: number | string,
  kafkaSendAttempts: number,
  kafkaSendDelayMin: number,
  kafkaSendDelayMax: number,
  engine: Engine,
  region: string;
  apiVersion: string;
  messageRetentionPeriod: string;
  receiveMessageWaitTimeSeconds: string;
};

export type Task = {
  topic: string,
  subscribe(any): any,
}

export interface IEvent {
  emit(eventName: string, ...any): any;
}

export interface IRegistry {
  registeredTasks: Object;
  events: IEvent;
  addNewTask(task: Task): void;
  removeTask(task: Task): void;
  getTopics(): Array<string>;
  getTask(topic: string): ITask; //eslint-disable-line
}

export interface ITask {
  config: Configuration;
  registry: IRegistry;
  subscribe: Callback;
  topic: string;
  producer: Object;
  publish(payload: Object): Promise<void>;
}

export type Consumer = {
  commitOffset(Object): void,
  init(Array<Object>) : Object;
};

export interface IRunner {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  consumer: Consumer;
  receive(messages: Array<Object>, topic: string, partition: string): Promise<void>;
  process(): Callback;
}

export interface ISteveo {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  task(topic: string, callBack: Callback): ITask;
  runner(): IRunner;
  customTopicName(cb: Callback): void;
  lag(): (topicName: string, partitions: string) => Object;
}

export type Producer = {
  send(data: Object, sendParams: Object): void;
  init() : void;
  createQueue(params: Object, Callback): ?Promise<void>;
};

export interface IProducer {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  producer: Producer;
  initialize(topic: ?string): ?Promise<void>;
  producerPayload(msg: Object, topic: string): Object;
  send(topic: string, payload: Object): Promise<void>;
}

export interface IAdmin {
  config: Configuration;
  groupId: string;
  initialize(): Promise<void>;
  lag(topicName: string, partitions: string): Object;
}

export type sqsUrls = {
  [key: string]: Promise<void>,
}
