import nullLogger from 'null-logger';
import { HighLevelProducer } from 'node-rdkafka';

import {
  Configuration,
  KafkaConfiguration,
  Logger,
  IProducer,
  IRegistry,
} from '../common';
import { generateMessageMetadata } from './utils/generateMessageMetadata';

class KafkaProducer implements IProducer<HighLevelProducer> {
  config: Configuration;

  registry: IRegistry;

  logger: Logger;

  producer: HighLevelProducer;

  constructor(
    config: Configuration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.producer = new HighLevelProducer(
      {
        'bootstrap.servers': (this.config as KafkaConfiguration)
          .bootstrapServers,
        'security.protocol': (this.config as KafkaConfiguration)
          .securityProtocol,
        ...((this.config as KafkaConfiguration).producer?.global ?? {}),
      },
      (this.config as KafkaConfiguration).producer?.topic ?? {}
    );
    this.logger = logger;
    this.registry = registry;
  }

  async initialize() {
    if (this.producer.isConnected()) {
      return this.producer;
    }
    return new Promise<HighLevelProducer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.error('Connection timed out');
        reject();
      }, (this.config as KafkaConfiguration).connectionTimeout!);
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

  getPayload = <T>(payload: T) => {
    const context = generateMessageMetadata(payload);
    if (typeof payload === 'string') {
      return Buffer.from(payload, 'utf-8');
    }
    return Buffer.from(JSON.stringify({ ...payload, _meta: context }), 'utf-8');
  };

  async send<T>(topic: string, payload: T, key: string | null = null) {
    return new Promise<void>((resolve, reject) => {
      this.producer.produce(
        topic,
        null,
        this.getPayload<T>(payload),
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
            this.registry.emit('producer_failure', topic, err);
            reject();
          } else {
            this.registry.emit('producer_success', topic, payload);
            resolve();
          }
        }
      );
    });
  }

  async disconnect() {
    this.producer.disconnect();
  }
}

export default KafkaProducer;
