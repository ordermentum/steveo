// @flow

import redisConf from '../config/redis';

import type { Configuration, Logger, Producer, IProducer, IRegistry } from '../../types';


class RedisProducer implements IProducer {
  config: Configuration;
  registry: IRegistry;
  logger: Logger;
  producer: Producer;

  constructor(config: Configuration, registry: IRegistry, logger: Logger) {
    this.config = config;
    this.producer = redisConf.redis(config);
    this.logger = logger;
    this.registry = registry;
  }

  async initialize(topic: ?string) {
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

  getPayload(msg: Object, topic: string) {
    const timestamp = new Date().getTime();
    const task = this.registry.getTask(topic);
    return {
      qname: task.topic,
      message: JSON.stringify(Object.assign({}, msg, { timestamp })),
    };
  }

  async send(topic: string, payload: Object) {
    const redisData = this.getPayload(payload, topic);
    try {
      const data = await this.producer.sendMessageAsync(redisData);
      this.logger.info('Redis Publish Data', redisData, 'id', data);
      const queueAttributes = await this.producer.getQueueAttributesAsync({ qname: topic });
      this.logger.info('Queue status', queueAttributes);
      this.registry.events.emit('producer_success', topic, payload);
    } catch (ex) {
      this.logger.error('Error while sending Redis payload', topic, ex);
      this.registry.events.emit('producer_failure', topic, ex);
      throw ex;
    }
  }
}

export default RedisProducer;
