import nullLogger from 'null-logger';

import { Configuration, Logger, IProducer, IRegistry } from '../common';

import { generateMetadata } from './utils';

class DummyProducer implements IProducer {
  config: Configuration;

  registry: IRegistry;

  logger: Logger;

  queues: Set<string>;

  constructor(
    config: Configuration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.logger = logger;
    this.registry = registry;
    this.queues = new Set<string>();
  }

  async initialize(topic?: string) {
    if (!topic) {
      return;
    }

    if (!this.queues.has(topic)) {
      this.queues.add(topic);
    }
  }

  getPayload(msg: any, topic: string): any {
    const context = generateMetadata(msg);
    return {
      qname: topic,
      message: JSON.stringify({ ...msg, _meta: context }),
    };
  }

  async send<T = any>(topic: string, payload: T) {
    const data = this.getPayload(payload, topic);
    try {
      this.registry.emit('producer_success', topic, payload);
    } catch (ex) {
      this.logger.error('Error while sending Redis payload', topic, ex);
      this.registry.emit('producer_failure', topic, ex, data);
      throw ex;
    }
  }

  async disconnect() {}

  async reconnect() {}
}

export default DummyProducer;
