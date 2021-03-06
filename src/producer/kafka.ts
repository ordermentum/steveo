import * as kafka from 'no-kafka';
import nullLogger from 'null-logger';

import { Configuration, Logger, IProducer, IRegistry } from '../common';

import { getMeta } from './utils';

export const kafkaCompression = {
  SNAPPY: kafka.COMPRESSION_SNAPPY,
  GZIP: kafka.COMPRESSION_GZIP,
  NONE: kafka.COMPRESSION_NONE,
};

class KafkaProducer implements IProducer {
  config: Configuration;

  registry: IRegistry;

  logger: Logger;

  producer: kafka.Producer;

  constructor(
    config: Configuration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.producer = new kafka.Producer({
      connectionString: this.config.kafkaConnection,
      codec: this.config.kafkaCodec,
    });
    this.logger = logger;
    this.registry = registry;
  }

  async initialize() {
    this.producer.init();
  }

  getPayload(msg: any, topic: string) {
    const context = getMeta(msg);
    const payload = JSON.stringify({ ...msg, _meta: context });
    const size = Buffer.from(payload, 'utf-8');
    this.logger.debug('Payload Size:', topic, size.length);
    return {
      context,
      topic,
      message: {
        value: payload,
      },
    };
  }

  async send<T = any>(topic: string, payload: T) {
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
      this.logger.error(
        'Error while sending payload:',
        JSON.stringify(payload, null, 2),
        'topic :',
        topic,
        'Error :',
        ex
      );
      this.registry.events.emit('producer_failure', topic, ex);
      throw ex;
    }
  }
}

export default KafkaProducer;
