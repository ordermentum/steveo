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
  subscribe: Object,
};

export type RegistredTopics = {
  [key: ?string]: Task,
};

export type Runner = {
  send: (topic: string, payload: Object) => any,
  receive: (messageSet: Array<Object>, topic: string, partition: number) => any,
  kafkaClient: Object,
  initializeConsumer: (topics: Array<string>) => any,
  initializeGroupAdmin: () => any,
  initializeProducer: () => any,
};


export type Reg = {
  addNewTask: (task: Task, runner: Runner) => any,
  removeTask: (task: Task, runner: Runner) => any,
  successCallback: Callback,
  failureCallback: Callback,
};
