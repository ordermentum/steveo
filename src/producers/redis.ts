import nullLogger from 'null-logger';
import RedisSMQ from 'rsmq';
import redisConf from '../config/redis';

import { Logger, IProducer, IRegistry, RedisConfiguration } from '../common';

import { createMessageMetadata } from '../lib/context';

class RedisProducer implements IProducer {
  config: RedisConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: RedisSMQ;

  constructor(
    config: RedisConfiguration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.producer = redisConf.redis(config);
    this.logger = logger;
    this.registry = registry;
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
    const data = this.getPayload(payload, topic);
    try {
      const response = await this.producer.sendMessageAsync(data);
      this.logger.debug('Redis Publish Data', data, 'id', response);
      const queueAttributes = await this.producer.getQueueAttributesAsync({
        qname: topic,
      });
      this.logger.debug('Queue status', queueAttributes);
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

export default RedisProducer;
