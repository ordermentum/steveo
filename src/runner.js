// @flow
import moment from 'moment';
import KafkaClient from './helpers/kafka';

import type { Env } from '../types';

const Runner = (env: Env, kafkaHost: string, registry: Object, logger: Object) => {
  const kafkaClient = KafkaClient({
    kafkaConnection: env.KAFKA_CONNECTION,
    kafkaCodec: env.KAFKA_CODEC,
    clientId: env.CLIENT_ID,
    logger: {
      logLevel: env.LOG_LEVEL,
    },
    kafkaGroupId: env.KAFKA_GROUP_ID,
  });

  const producerPayload = (msg: Object, topic: string) => {
    const timestamp = moment().unix();

    return {
      timestamp,
      topic,
      message: { value: JSON.stringify(Object.assign({}, msg, { timestamp })) },
    };
  };

  const send = (topic: string, payload: Object) => {
    // send messages to kafka
    kafkaClient.producer.send(producerPayload(payload, topic));
    logger.info(`*****PRODUCE********
                 topic:- ${topic}
                 ********************
                 payload:- ${JSON.stringify(payload)}
                 ********************
                `);
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
