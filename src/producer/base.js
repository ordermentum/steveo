import nullLogger from 'null-logger';
import type { Configuration, Producer, IProducer, Logger, IRegistry } from '../../types';

class BaseProducer implements IProducer {
  config: Configuration;
  registry: IRegistry;
  logger: Logger;
  producer: Producer;

  constructor(config: Configuration, registry: IRegistry, logger: Logger = nullLogger) {
    this.config = config;
    this.logger = logger;
    this.registry = registry;
  }

  async publish(topic: string, payload: Object | Array<Object>) {
    let params = payload;
    if (!Array.isArray(payload)) {
      params = [payload];
    }

    try {
      await this.initialize(topic);
      await Promise.all(params.map(data => this.send(topic, data)));
      this.registry.events.emit('task_success', topic, params);
    } catch (ex) {
      this.registry.events.emit('task_failure', topic, ex);
      throw ex;
    }
  }
}

export default BaseProducer;
