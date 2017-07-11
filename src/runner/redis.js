// @flow
import BaseRunner from '../base/base_runner';
import redisConf from '../config/redis';
import type { IRunner, Configuration, Logger, Consumer, IRegistry, CreateRedisTopic } from '../../types';

type DeleteMessage = {
  instance: Object,
  topic: string,
  messageId: Object,
  logger: Logger
};

/* istanbul ignore next */
const deleteMessage = async ({
  instance,
  topic,
  messageId,
  logger,
}: DeleteMessage) => {
  const deleteParams = {
    qname: topic,
    id: messageId,
  };
  try {
    const data = await instance.deleteMessageAsync(deleteParams);
    return data;
  } catch (ex) {
    logger.info('redis deletion error', ex, topic, messageId);
    throw ex;
  }
};

class RedisRunner extends BaseRunner implements IRunner {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  consumer: Consumer;
  redis: Object;

  constructor(config: Configuration, registry: IRegistry, logger: Logger) {
    super();
    this.config = config;
    this.registry = registry;
    this.logger = logger;
    this.redis = redisConf.redis(config);
  }

  receive = async (messages: Array<Object>, topic: string) => {
    for (const m of messages) { // eslint-disable-line no-restricted-syntax
      let params = null;
      try {
        params = JSON.parse(m.message);
        this.registry.events.emit('runner_receive', topic, params);
        this.logger.info('Deleting message', topic, params);
        await deleteMessage({ // eslint-disable-line
          instance: this.redis,
          topic,
          messageId: m.id,
          logger: this.logger,
        });
        const task = this.registry.getTask(topic);
        this.logger.info('Start subscribe', topic, params);
        await task.subscribe(params); // eslint-disable-line
        this.registry.events.emit('runner_complete', topic, params);
      } catch (ex) {
        this.logger.error('Error while executing consumer callback ', { params, topic, error: ex });
        this.registry.events.emit('runner_failure', topic, ex, params);
      }
    }
  }
  /* istanbul ignore next */
  iterateOnQueue = async (topic: string) => {
    setTimeout(async () => {
      const data = await this.redis.receiveMessageAsync({ qname: topic });
      if (Object.keys(data).length) {
        this.logger.info('Message from redis', data);
        await this.receive([data], topic);
      }
      this.iterateOnQueue(topic);
    }, this.config.consumerPollInterval);
  };

  process(topics: Array<string>) {
    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.info('initializing consumer', subscriptions);
    return Promise.all(subscriptions.map(async (topic) => {
      this.logger.info('initializing consumer', topic);
      return this.iterateOnQueue(topic);
    }));
  }

  async createQueue({ topic, visibilityTimeout = 604800, maxsize = -1 }: CreateRedisTopic) {
    this.logger.info(`creating queue ${topic}`);

    const queues = await this.redis.listQueuesAsync();
    const exists = queues.find(q => q === topic);

    if (exists) {
      this.logger.info(`${topic} already exists`);
      return true;
    }

    const params = {
      qname: topic,
      vt: visibilityTimeout,
      maxsize,
    };
    return this.redis.createQueueAsync(params);
  }
}

export default RedisRunner;
