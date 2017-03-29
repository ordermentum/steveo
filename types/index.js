/* @flow */

export type Callback = (x: any) => any;

export type Logger = {
  logLevel: number,
};

export type KafkaParams = {
  kafkaConnection: string,
  kafkaGroupId: string,
  clientId: ?string,
  kafkaCodec: string,
  logger: Logger,
};

export type PublishCallback = {
  success: Callback,
  failure: Callback
};


export type Config = {
  kafkaConnection: string,
  kafkaCodec: string,
  clientId: string,
  logLevel: number,
  kafkaGroupId: string,
  kafkaSendAttempts: ?number,
  kafkaSendDelayMin: ?number,
  kafkaSendDelayMax: ?number,
  publishCallback: ?PublishCallback,
};

export type Task = {
  topic: string,
  subscribe: () => any,
};

export type Producer = {
  send: (topic: string, payload: Object) => any,
  initialize: () => any,
};

export type RegistredTopics = {
  [key: ?string]: Task,
};

export type Runner = {
  send: (topic: string, payload: Object) => any,
  receive: (messages: Array<Object>, topic: string, partition: number) => any,
  kafkaClient: Object,
  initializeConsumer: (topics: Array<string>) => any,
  initializeGroupAdmin: () => any,
  initializeProducer: () => any,
};


export type Reg = {
  addNewTask: (task: Task) => any,
  removeTask: (task: Task) => any,
  successCallback: Callback,
  failureCallback: Callback,
  getTopics: () => Array<string>,
  getTask: (topic: string) => Task,
};
