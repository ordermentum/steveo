// @flow
import moment from 'moment';
import KafkaClient from './helpers/kafka';

import type { Env } from '../types';

const Runner = (env: Env, registry: Object, logger: Object) => {
  const kafkaClient = KafkaClient({
    kafkaConnection: env.KAFKA_CONNECTION,
    kafkaCodec: env.KAFKA_CODEC,
    clientId: env.CLIENT_ID,
    logger: {
      logLevel: env.LOG_LEVEL,
    },
    kafkaGroupId: env.KAFKA_GROUP_ID,
  });


  const receive = async (payload: Object, topic: string) => {
    logger.info('Payload: ', JSON.stringify(payload, null, 2), 'received on topic:', topic);
    const task = registry[topic];
    await task.subscribe(payload);
  };


  const initializeConsumer = (subscriptions: Array<string>) => {
    logger.info('initializing consumer', subscriptions);
    return kafkaClient.consumer.init([{
      subscriptions,
      handler: receive,
    }]);
  };

  const producerPayload = (msg: Object, topic: string) => {
    const timestamp = moment().unix();

    return {
      timestamp,
      topic,
      message: { value: JSON.stringify(Object.assign({}, msg, { timestamp })) },
    };
  };

  const send = async (topic: string, payload: Object) => {
    logger.info('Message ', JSON.stringify(payload, null, 2), ' arrived on topic: ', topic);
    const data = producerPayload(payload, topic);
    logger.info('*****', data);
    const sendParams = {
      retries: {
        attempts: env.KAFKA_SEND_ATTEMPTS,
        delay: {
          min: env.KAFKA_SEND_DELAY_MIN,
          max: env.KAFKA_SEND_DELAY_MAX,
        },
      },
    };
    try {
      await kafkaClient.producer.send(data, sendParams);
      logger.info(`
        *****PRODUCE********
        topic:- ${topic}
        ********************
        payload:- ${JSON.stringify(payload)}
        ********************
      `);
    } catch (ex) {
      logger.error('Error while sending payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', ex);
    }
  };

  return {
    send,
    receive,
    kafkaClient,
    initializeConsumer,
  };
};

export default Runner;
