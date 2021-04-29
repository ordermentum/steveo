import nullLogger from 'null-logger';
import { Producer } from 'node-rdkafka';

import { KafkaConfiguration, Logger, IProducer, IRegistry } from '../common';

class KafkaProducer implements IProducer<Producer> {
  config: KafkaConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: Producer;

  constructor(
    config: KafkaConfiguration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.producer = new Producer(
      {
        'bootstrap.servers': this.config.bootstrapServers,
        ...(this.config.producer?.global ?? {}),
      },
      this.config.producer?.topic ?? {}
    );
    this.logger = logger;
    this.registry = registry;
  }

  async initialize() {
    return new Promise<Producer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.error('Connection timed out');
        reject();
      }, this.config.connectionTimeout!);
      this.producer.connect({}, err => {
        if (err) {
          clearTimeout(timeoutId);
          this.logger.error('Error initializing producer', err);
          reject(err);
        }
      });
      this.producer.on('ready', () => {
        clearTimeout(timeoutId);
        this.logger.debug('producer ready');
        resolve(this.producer);
      });
      this.producer.on('disconnected', () => {
        this.logger.debug('Producer disconnected');
      });
    });
  }

  getPayload = (payload: string) => Buffer.from(payload, 'utf-8');

  async send(topic: string, payload: string, key: string | null = null) {
    try {
      this.producer.produce(
        topic,
        null,
        this.getPayload(payload),
        key,
        Date.now()
      );
      this.registry.events.emit('producer_success', topic, payload);
    } catch (err) {
      this.logger.error(
        'Error while sending payload:',
        JSON.stringify(payload, null, 2),
        'topic :',
        topic,
        'Error :',
        err
      );
      this.registry.events.emit('producer_failure', topic, err);
    }
  }
}

export default KafkaProducer;
