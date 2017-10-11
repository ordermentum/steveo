// @flow
import nullLogger from 'null-logger';
import Kafka from 'no-kafka';
import moment from 'moment';

import BaseProducer from './base';

import type { Configuration, Logger, IProducer, IRegistry } from '../../types';

class KafkaProducer extends BaseProducer implements IProducer {
  constructor(config: Configuration, registry: IRegistry, logger: Logger = nullLogger) {
    super(config, registry, logger);
    this.producer = new Kafka.Producer({
      connectionString: this.config.kafkaConnection,
      codec: this.config.kafkaCodec,
    });
  }

  initialize() {
    this.producer.init();
  }

  getPayload(msg: Object, topic: string) {
    const timestamp = moment().unix();
    const payload = JSON.stringify(Object.assign({}, msg, { timestamp }));
    const size = Buffer.from(payload, 'utf-8');
    this.logger.info('Payload Size:', topic, size.length);
    return {
      timestamp,
      topic,
      message: {
        value: payload,
      },
    };
  }

  async send(topic: string, payload: Object) {
    const data = this.getPayload(payload, topic);
    const sendParams = {
      retries: {
        attempts: this.config.kafkaSendAttempts,
        delay: {
          min: this.config.kafkaSendDelayMin,
          max: this.config.kafkaSendDelayMax,
        },
      },
    };

    try {
      await this.producer.send(data, sendParams);
      this.registry.events.emit('producer_success', topic, payload);
    } catch (ex) {
      this.logger.error('Error while sending payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', ex);
      this.registry.events.emit('producer_failure', topic, ex);
      throw ex;
    }
  }
}

export default KafkaProducer;
