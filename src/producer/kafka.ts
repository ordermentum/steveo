import nullLogger from 'null-logger';
import { HighLevelProducer } from 'node-rdkafka';

import { KafkaConfiguration, Logger, IProducer, IRegistry } from '../common';

class KafkaProducer implements IProducer<HighLevelProducer> {
  config: KafkaConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: HighLevelProducer;

  constructor(
    config: KafkaConfiguration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.producer = new HighLevelProducer(
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
    return new Promise<HighLevelProducer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.error('Connection timed out');
        reject();
      }, this.config.connectionTimeout!);
      this.producer.connect({}, err => {
        clearTimeout(timeoutId);
        if (err) {
          this.logger.error('Error initializing producer');
          reject();
        } else {
          this.logger.debug('producer ready');
          resolve(this.producer);
        }
      });
    });
  }

  getPayload = (payload: string) => Buffer.from(payload, 'utf-8');

  async send(topic: string, payload: string, key: string | null = null) {
    return new Promise<void>((resolve, reject) => {
      this.producer.produce(
        topic,
        null,
        this.getPayload(payload),
        key,
        Date.now(),
        err => {
          if (err) {
            this.logger.error(
              'Error while sending payload:',
              JSON.stringify(payload, null, 2),
              'topic :',
              topic,
              'Error :',
              err
            );
            this.registry.events.emit('producer_failure', topic, err);
            reject();
          }
        }
      );
      this.registry.events.emit('producer_success', topic, payload);
      resolve();
    });
  }
}

export default KafkaProducer;
