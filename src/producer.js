// @flow
import Kafka from 'no-kafka';
import moment from 'moment';
import { defineLazyProperty } from 'lazy-object';
import type { Config, Reg } from '../types';

const Producer = (config: Config, registry: Reg, logger: Object) => {
  const producer = new Kafka.Producer({
    connectionString: config.kafkaConnection,
    codec: config.kafkaCodec,
  });

  const producerPayload = (msg: Object, topic: string) => {
    const timestamp = moment().unix();
    const payload = JSON.stringify(Object.assign({}, msg, { timestamp }));
    logger.info('Payload Size:', topic, payload.length);
    return {
      timestamp,
      topic,
      message: {
        value: payload,
      },
    };
  };

  const initialize = () =>
    defineLazyProperty(producer, { init: producer.init() });

  const send = async (topic: string, payload: Object) => {
    const data = producerPayload(payload, topic);
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
      await producer.send(data, sendParams);
      registry.events.emit('producer_success', topic, payload);
    } catch (ex) {
      logger.error('Error while sending payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', ex);
      registry.events.emit('producer_failure', topic, ex);
      throw ex;
    }
  };

  return {
    send,
    initialize,
    producer,
  };
};

export default Producer;
