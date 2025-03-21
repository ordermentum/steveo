import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import {
  IProducer,
  IRegistry,
  RedisConfiguration,
  RedisMessageRoutingOptions,
} from '../common';
import { consoleLogger, Logger } from '../lib/logger';
import { createMessageMetadata } from '../lib/context';
import { BaseProducer } from './base';

class RedisProducer extends BaseProducer implements IProducer {
  config: RedisConfiguration;

  registry: IRegistry;

  logger: Logger;

  connection: IORedis;

  queues: Map<string, Queue>;

  constructor(
    config: RedisConfiguration,
    registry: IRegistry,
    logger: Logger = consoleLogger
  ) {
    super(config.middleware ?? []);
    this.config = config;
    this.logger = logger;
    this.registry = registry;
    this.queues = new Map();

    // Create Redis connection
    this.connection = new IORedis(config.connectionUrl);
  }

  async initialize(topic: string, options: RedisMessageRoutingOptions) {
    if (!this.queues.has(topic)) {
      const queueOptions: QueueOptions = {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: true,
          attempts: 3,
          backoff: options.backoff || {
            type: 'exponential',
            delay: 1000,
          },
          ...options,
        },
      };

      const queue = new Queue(topic, queueOptions);
      this.queues.set(topic, queue);
      this.logger.debug(`Initialized BullMQ queue: ${topic}`);
    }
  }

  getPayload(msg: any): any {
    const context = createMessageMetadata(msg);
    return { ...msg, _meta: context };
  }

  async send<T = any>(
    topic: string,
    payload: T,
    options: RedisMessageRoutingOptions = {}
  ) {
    try {
      await this.wrap({ topic, payload }, async c => {
        // Ensure the queue exists
        if (!this.queues.has(c.topic)) {
          await this.initialize(c.topic, options);
        }

        const queue = this.queues.get(c.topic);
        if (!queue) throw new Error(`Queue not found for topic ${c.topic}`);

        const data = this.getPayload(c.payload);

        // Add job to the queue
        await queue.add(c.topic, data, {
          // You can customize job options here if needed
          removeOnComplete: false,
          removeOnFail: false,
          ...options,
        });

        // Get queue statistics
        const jobCounts = await queue.getJobCounts();
        this.logger.debug(`Queue stats: ${JSON.stringify(jobCounts)}`);

        this.registry.emit('producer_success', c.topic, c.payload);
      });
    } catch (ex) {
      this.logger.error('Error while sending BullMQ payload', topic, ex);
      this.registry.emit('producer_failure', topic, ex, payload);
      throw ex;
    }
  }

  async stop() {
    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      this.logger.debug(`Closed queue: ${name}`);
    }
    await this.connection.quit();
    this.logger.debug('Closed Redis connection');
  }
}

export default RedisProducer;
