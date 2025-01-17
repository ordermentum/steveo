import { HighLevelProducer } from 'node-rdkafka';
import {
  KafkaConfiguration,
  IProducer,
  IRegistry,
  KafkaMessageRoutingOptions,
} from '../common';
import { consoleLogger, Logger } from '../lib/logger';
import { createMessageMetadata } from '../lib/context';
import { BaseProducer } from './base';

class KafkaProducer extends BaseProducer implements IProducer {
  config: KafkaConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: HighLevelProducer;

  constructor(
    config: KafkaConfiguration,
    registry: IRegistry,
    logger: Logger = consoleLogger
  ) {
    super(config.middleware ?? []);
    this.config = config;
    this.producer = new HighLevelProducer(
      {
        'bootstrap.servers': this.config.bootstrapServers,
        'security.protocol': this.config.securityProtocol,
        ...(this.config.producer?.global ?? {}),
      },
      this.config.producer?.topic ?? {}
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
        this.logger.error(
          `${this.config.engine.toUpperCase()}: Connection timed out`
        );
        reject();
      }, (this.config as KafkaConfiguration).connectionTimeout!);
      this.producer.connect({}, err => {
        if (err) {
          clearTimeout(timeoutId);
          this.logger.error(
            `${this.config.engine.toUpperCase()}: Error initializing producer`,
            err
          );
          reject(err);
        }
      });
      this.producer.on('ready', () => {
        clearTimeout(timeoutId);
        this.logger.debug(
          `${this.config.engine.toUpperCase()}: producer ready`
        );
        resolve(this.producer);
      });
      this.producer.on('disconnected', () => {
        this.logger.debug(
          `${this.config.engine.toUpperCase()}: Producer disconnected`
        );
      });
    });
  }

  getPayload = <T>(
    payload: T,
    _topic: string,
    options: KafkaMessageRoutingOptions
  ) => {
    if (typeof payload === 'string') {
      return Buffer.from(payload, 'utf-8');
    }

    const messageMetadata = {
      ...createMessageMetadata(payload),
      ...options,
    };

    return Buffer.from(
      JSON.stringify({ ...payload, _meta: messageMetadata }),
      'utf-8'
    );
  };

  publish(topic: string, data, key: string | null = null) {
    return new Promise<void>((resolve, reject) => {
      this.producer.produce(topic, null, data, key, Date.now(), err => {
        if (err) {
          this.logger.error(
            {
              topic,
              engine: this.config.engine.toUpperCase(),
            },
            `${this.config.engine.toUpperCase()} Error while sending payload:`,
            JSON.stringify(data, null, 2),
            'topic :',
            topic,
            'Error :',
            err
          );
          this.registry.emit('producer_failure', topic, err);
          reject();
        } else {
          this.registry.emit('producer_success', topic, data);
          resolve();
        }
      });
    });
  }

  async send<T = any>(
    topic: string,
    payload: T,
    options: KafkaMessageRoutingOptions = {}
  ) {
    try {
      await this.wrap({ topic, payload }, async c => {
        const data = this.getPayload(c.payload, topic, options);
        await this.publish(c.topic, data, options.key);
        this.registry.emit('producer_success', topic, c.payload);
      });
    } catch (ex) {
      this.logger.error(
        { topic, engine: this.config.engine.toUpperCase() },
        `${this.config.engine.toUpperCase()}: Error while sending payload`,
        topic,
        ex
      );
      this.registry.emit('producer_failure', topic, ex, payload);
      throw ex;
    }
  }

  async stop() {
    if (this.producer.isConnected()) {
      this.producer.disconnect(err => {
        if (err) {
          this.logger.error(
            `${this.config.engine.toUpperCase()}: Error while disconnecting producer`,
            err
          );
        }
      });
    }
  }
}

export default KafkaProducer;
