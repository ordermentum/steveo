import nullLogger from 'null-logger';
import RedisSMQ from 'rsmq';
import redisConf from '../config/redis';

import {
  Logger,
  IProducer,
  IRegistry,
  RedisConfiguration,
  Middleware,
} from '../common';

import { createMessageMetadata } from '../lib/context';
import { BaseProducer } from './base';

class RedisProducer extends BaseProducer implements IProducer {
  config: RedisConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: RedisSMQ;

  middleware: Middleware[];

  constructor(
    config: RedisConfiguration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    super([]);
    this.config = config;
    this.producer = redisConf.redis(config);
    this.logger = logger;
    this.registry = registry;
    this.middleware = [];
  }

  async initialize(topic: string) {
    const params = {
      qname: topic,
      vt: this.config.visibilityTimeout,
      maxsize: this.config.redisMessageMaxsize,
    };
    const queues = await this.producer.listQueuesAsync();
    if (!queues.find(q => q === topic)) {
      this.producer.createQueueAsync(params);
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
      await this.wrap(topic, payload, async (t, d) => {
        const data = this.getPayload(d, t);
        await this.producer.sendMessageAsync(data);
        const queueAttributes = await this.producer.getQueueAttributesAsync({
          qname: t,
        });
        this.logger.debug(`queue stats: ${queueAttributes}`);
        this.registry.emit('producer_success', topic, payload);
      });
    } catch (ex) {
      this.logger.error('Error while sending Redis payload', topic, ex);
      this.registry.emit('producer_failure', topic, ex, payload);
      throw ex;
    }
  }
}

export default RedisProducer;
