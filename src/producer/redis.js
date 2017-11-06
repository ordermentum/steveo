// @flow
import nullLogger from 'null-logger';
import moment from 'moment';
import redisConf from '../config/redis';

import BaseProducer from './base';

import type { Configuration, ITask, Logger, IProducer, IRegistry } from '../../types';

class RedisProducer extends BaseProducer implements IProducer {
  constructor(config: Configuration, registry: IRegistry, logger: Logger = nullLogger) {
    super(config, registry, logger);
    this.producer = redisConf.redis(this.config);
  }

  async initialize(topic: ?string) {
    const params = {
      qname: topic,
      vt: this.config.visibilityTimeout,
      maxsize: this.config.redisMessageMaxsize,
    };
    const queues: Array<string> = await this.producer.listQueuesAsync();
    if (!queues.find(q => q === topic)) {
      await this.producer.createQueueAsync(params);
    }
  }

  getPayload(msg: Object, topic: string) : Object {
    const timestamp: Number = moment().unix();
    const task: ITask = this.registry.getTask(topic);
    console.log('🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴');
    console.log('task:', task);
    return {
      qname: task.topic,
      message: JSON.stringify(Object.assign({}, msg, { timestamp })),
    };
  }

  async send(topic: string, payload: Object) : Promise<void> {
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
