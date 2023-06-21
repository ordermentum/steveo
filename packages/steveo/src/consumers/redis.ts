/* eslint-disable no-continue */
import RedisSMQ from 'rsmq';
import nullLogger from 'null-logger';
import Bluebird from 'bluebird';
import BaseRunner from './base';
import { getContext } from '../lib/context';
import redisConf from '../config/redis';
import { IRunner, Pool, Logger, RedisConfiguration } from '../common';
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
  config: RedisConfiguration;

  logger: Logger;

  redis: RedisSMQ;

  pool: Pool<any>;

  currentTimeout?: ReturnType<typeof setTimeout>;

  constructor(steveo: Steveo) {
    super(steveo);
    this.config = steveo?.config as RedisConfiguration;
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
          this.registry.emit('runner_receive', topic, params, runnerContext);
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
          const { context = null, ...value } = params;
          await task.subscribe(value, context);
          const completedContext = getContext(params);
          this.registry.emit(
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
          this.registry.emit('runner_failure', topic, ex, params);
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

  poll(topics?: string[]) {
    if (this.state === 'terminating') {
      this.logger.debug(`terminating redis`);
      this.state = 'terminated';
      this.shutdown();
      return;
    }

    if (this.currentTimeout) clearTimeout(this.currentTimeout);

    this.currentTimeout = setTimeout(
      this.process.bind(this, topics),
      this.config.consumerPollInterval ?? 1000
    );
  }

  async process(topics?: string[]) {
    if (this.state === 'paused') {
      this.logger.debug(`paused processing`);
      this.poll(topics);
      return;
    }

    this.logger.debug(
      `starting poll for messages ${topics ? topics.join(',') : 'all'}`
    );

    const subscriptions = this.getActiveSubsciptions(topics);

    await Bluebird.map(
      subscriptions,
      async topic => {
        await this.dequeue(topic);
      },
      { concurrency: this.config.workerConfig?.max ?? 1 }
    );

    this.poll(topics);
  }

  async createQueue(topic: string): Promise<boolean> {
    this.logger.debug(`loading existing queues to check topic ${topic}`);
    const queues = await this.redis.listQueuesAsync();
    const exists = queues.find(q => q === topic);

    if (exists) {
      this.logger.debug(`${topic} already exists`);
      return false;
    }

    const params = {
      qname: topic,
      vt: this.config.visibilityTimeout,
      maxsize: this.config.redisMessageMaxsize,
    };
    this.logger.info(`creating redis queue ${topic}`);
    await this.redis.createQueueAsync(params);

    return true;
  }

  async shutdown() {
    this.redis?.quit(() => {});
  }

  async reconnect() {}
}

export default RedisRunner;
