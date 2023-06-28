import nullLogger from 'null-logger';

import { Logger, IProducer, IRegistry, DummyConfiguration } from '../common';

import { createMessageMetadata } from '../lib/context';
import { BaseProducer } from './base';

class DummyProducer extends BaseProducer implements IProducer {
  config: DummyConfiguration;

  registry: IRegistry;

  logger: Logger;

  queues: Set<string>;

  constructor(
    config: DummyConfiguration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    super(config.middleware ?? []);
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
    const context = createMessageMetadata(msg);
    return {
      qname: topic,
      message: JSON.stringify({ ...msg, _meta: context }),
    };
  }

  async send<T = any>(topic: string, payload: T) {
    try {
      await this.wrap({ topic, payload }, async c => {
        const data = this.getPayload(c.payload, c.topic);
        this.logger.debug(
          `dummy producer - topic: ${c.topic}, payload: ${data}`
        );
      });
      this.registry.emit('producer_success', topic, payload);
    } catch (ex) {
      this.logger.error('Error while sending Redis payload', topic, ex);
      this.registry.emit('producer_failure', topic, ex, payload);
      throw ex;
    }
  }
}

export default DummyProducer;
