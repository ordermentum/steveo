// @flow
import KafkaClient from './helpers/kafka';

import type { Env } from '../types';

const Runner = (env: Env, kafkaHost: string, registry: Object) => {
  const kafkaClient = KafkaClient({
    kafkaConnection: env.KAFKA_CONNECTION,
    kafkaCodec: env.KAFKA_CODEC,
    clientId: env.CLIENT_ID,
    logger: {
      logLevel: env.LOG_LEVEL,
    },
    kafkaGroupId: env.KAFKA_GROUP_ID,
  });
  const send = (topic: string, payload: Object) => {
    // send messages to kafka
    console.log(topic, payload);
  };

  const receive = async (payload: Object, topic: string) => {
    // receive messages from kafka
    const task = registry[topic];
    await task.subscribe(payload);
  };

  return {
    send,
    receive,
  };
};

export default Runner;
