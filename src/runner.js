// @flow
import moment from 'moment';
import KafkaClient from './helpers/kafka';

import type { Config } from '../types';

const Runner = (config: Config, registry: Object, logger: Object) => {
  const kafkaClient = KafkaClient({
    kafkaConnection: config.kafkaConnection,
    kafkaCodec: config.kafkaCodec,
    clientId: config.clientId,
    logger: {
      logLevel: config.logLevel,
    },
    kafkaGroupId: config.kafkaGroupId,
  });


  const receive = async (payload: Object, topic: string) => {
    logger.info('Payload: ', JSON.stringify(payload, null, 2), 'received on topic:', topic);
    const task = registry[topic];
    try {
      await task.subscribe(payload);
    } catch (ex) {
      logger.error('Error while executing consumer callback ', ex);
    }
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
        attempts: config.kafkaSendAttempts,
        delay: {
          min: config.kafkaSendDelayMin,
          max: config.kafkaSendDelayMax,
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
