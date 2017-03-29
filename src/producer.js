// @flow
import Kafka from 'no-kafka';
import moment from 'moment';
import events from 'events';
import { defineLazyProperty } from 'lazy-object';
import type { Config } from '../types';

const Producer = (config: Config, logger: Object) => {
  const eventEmitter = new events.EventEmitter();

  const producer = new Kafka.Producer({
    connectionString: config.kafkaConnection,
    codec: config.kafkaCodec,
  });

  const producerPayload = (msg: Object, topic: string) => {
    const timestamp = moment().unix();

    return {
      timestamp,
      topic,
      message: { value: JSON.stringify(Object.assign({}, msg, { timestamp })) },
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
      eventEmitter.emit('success', topic, payload);
    } catch (ex) {
      logger.error('Error while sending payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', ex);
      eventEmitter.emit('failure', topic, payload);
      throw ex;
    }
  };

  return {
    send,
    initialize,
    producer,
    events: eventEmitter,
  };
};

export default Producer;
