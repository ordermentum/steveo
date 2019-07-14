import nullLogger from 'null-logger';
import BaseRunner from '../base/base_runner';
import { getContext } from './utils';
import redisConf from '../config/redis';
import {
  Hooks,
  IRunner,
  Configuration,
  Pool,
  Logger,
  IRegistry,
  CreateRedisTopic,
} from '../common';

type DeleteMessage = {
  instance: any;
  topic: string;
  messageId: any;
  logger: Logger;
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
    logger.debug('redis deletion error', ex, topic, messageId);
    throw ex;
  }
};

class RedisRunner extends BaseRunner implements IRunner {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  redis: any;

  pool: Pool;

  constructor(
    config: Configuration,
    registry: IRegistry,
    pool: Pool,
    logger: Logger = nullLogger,
    hooks: Hooks = {}
  ) {
    super(hooks);
    this.config = config;
    this.registry = registry;
    this.logger = logger;
    this.redis = redisConf.redis(config);
    this.pool = pool;
  }

  async receive(messages: any[], topic: string): Promise<any> {
    return Promise.all(
      messages.map(async m => {
        let params = null;
        const resource = await this.pool.acquire();
        try {
          params = JSON.parse(m.message);
          const context = getContext(params);
          this.registry.events.emit('runner_receive', topic, params, context);
          this.logger.debug('Deleting message', topic, params);
          await deleteMessage({ // eslint-disable-line
            instance: this.redis,
            topic,
            messageId: m.id,
            logger: this.logger,
          });

          const task = this.registry.getTask(topic);
          this.logger.debug('Start subscribe', topic, params);
          await task.subscribe(params); // eslint-disable-line
          const completedContext = getContext(params);
          this.registry.events.emit(
            'runner_complete',
            topic,
            params,
            completedContext
          );
        } catch (ex) {
          this.logger.error('Error while executing consumer callback ', {
            params,
            topic,
            error: ex,
          });
          this.registry.events.emit('runner_failure', topic, ex, params);
        }
        await this.pool.release(resource);
      })
    );
  }

  async dequeue(topic: string) {
    const data = await this.redis.receiveMessageAsync({ qname: topic });

    if (Object.keys(data).length) {
      this.logger.debug('Message from redis', data);
      try {
        await this.receive([data], topic);
      } catch (ex) {
        this.logger.error('Error while invoking receive', ex);
      }
    }
  }

  async process(topics?: string[]) {
    const loop = () =>
      setTimeout(
        this.process.bind(this, topics),
        this.config.consumerPollInterval
      );
    await this.checks(loop);
    this.logger.debug(
      `starting poll for messages ${topics ? topics.join(',') : 'all'}`
    );
    const subscriptions = this.getActiveSubsciptions(topics);

    await Promise.all(
      subscriptions.map(async topic => {
        await this.dequeue(topic);
      })
    );

    loop();
  }

  async createQueue({
    topic,
    visibilityTimeout = 604800,
    maxsize = -1,
  }: CreateRedisTopic) {
    this.logger.debug(`creating queue ${topic}`);

    const queues = await this.redis.listQueuesAsync();
    const exists = queues.find(q => q === topic);

    if (exists) {
      this.logger.debug(`${topic} already exists`);
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
