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

export type Env = {
  KAFKA_CONNECTION: string,
  KAFKA_CODEC: string,
  CLIENT_ID: string,
  LOG_LEVEL: number,
  KAFKA_GROUP_ID: string,
  KAFKA_SEND_ATTEMPTS: ?number,
  KAFKA_SEND_DELAY_MIN: ?number,
  KAFKA_SEND_DELAY_MAX: ?number,
};


