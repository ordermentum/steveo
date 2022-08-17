/* eslint-disable no-continue */
import RedisSMQ from 'rsmq';
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
  RedisConfiguration,
} from '../common';
import { Steveo } from '..';

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
  config: Configuration<RedisConfiguration>;

  logger: Logger;

  registry: IRegistry;

  redis: RedisSMQ;

  pool: Pool<any>;

  hooks?: Hooks;

  currentTimeout?: ReturnType<typeof setTimeout>;

  constructor(steveo: Steveo) {
    super(steveo);
    this.config = steveo?.config;
    this.registry = steveo?.registry;
    this.logger = steveo?.logger ?? nullLogger;
    this.redis = redisConf.redis(steveo?.config);
    this.pool = steveo.pool;
  }

  async receive(messages: any[], topic: string): Promise<any> {
    return Promise.all(
      messages.map(async m => {
        let params;
        let resource;
        try {
          resource = await this.pool.acquire();
          params = JSON.parse(m.message);
          const runnerContext = getContext(params);
          this.registry.events.emit(
            'runner_receive',
            topic,
            params,
            runnerContext
          );
          this.logger.debug('Deleting message', topic, params);
          await deleteMessage({ // eslint-disable-line
            instance: this.redis,
            topic,
            messageId: m.id,
            logger: this.logger,
          });

          const task = this.registry.getTask(topic);
          if (!task) {
            this.logger.error(`Unknown Task ${topic}`);
            return;
          }
          this.logger.debug('Start subscribe', topic, params);
          if (this.hooks?.preTask) {
            await this.hooks.preTask(params);
          }
          const { context = null, ...value } = params;
          const result = await task.subscribe(value, context);
          if (this.hooks?.postTask) {
            await this.hooks.postTask({ ...(params ?? {}), result });
          }
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
        if (resource) await this.pool.release(resource);
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
    const loop = () => {
      if (this.steveo.exiting) return;
      if (this.currentTimeout) clearTimeout(this.currentTimeout);

      this.currentTimeout = setTimeout(
        this.process.bind(this, topics),
        this.config.consumerPollInterval ?? 1000
      );
    };

    if (this.paused) {
      this.logger.debug(`paused processing`);
      loop();
      return;
    }

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
      return;
    }

    const params = {
      qname: topic,
      vt: visibilityTimeout,
      maxsize,
    };
    await this.redis.createQueueAsync(params);
  }

  async disconnect() {
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    this.redis?.quit(() => {});
  }

  async reconnect() {}
}

export default RedisRunner;
