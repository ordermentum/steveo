/* eslint-disable no-continue */
import Bluebird from 'bluebird';
import { Queue, QueueEvents, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import nullLogger from 'null-logger';
import { Steveo } from '..';
import { IRunner, Pool, RedisConfiguration } from '../common';
import { getContext } from '../lib/context';
import { Logger } from '../lib/logger';
import BaseRunner from './base';

class RedisRunner extends BaseRunner implements IRunner {
  config: RedisConfiguration;

  logger: Logger;

  redisConnection: IORedis;

  pool: Pool<any>;

  queues: Map<string, Queue>;

  workers: Map<string, Worker>;

  queueEvents: Map<string, QueueEvents>;

  // Add dead letter queues map
  deadLetterQueues: Map<string, Queue>;

  constructor(steveo: Steveo) {
    super(steveo);
    this.config = steveo.config as RedisConfiguration;
    this.logger = steveo.logger ?? nullLogger;

    // Create Redis connection
    this.redisConnection = new IORedis(this.config.redisOptions);

    this.pool = steveo.pool;
    this.queues = new Map();
    this.workers = new Map();
    this.queueEvents = new Map();
    this.deadLetterQueues = new Map();
  }

  async receive(messages: any[], topic: string): Promise<any> {
    // This method is not directly used in BullMQ as it handles message receiving internally
    return Promise.resolve();
  }

  async deleteMessage(topic: string, messageId: string) {
    // Not needed in BullMQ as it handles message deletion internally
    return Promise.resolve();
  }

  async dequeue(topic: string) {
    // This is not needed in BullMQ as Workers handle dequeueing
    return Promise.resolve();
  }

  poll(topics?: string[]) {
    // BullMQ doesn't require polling as it uses Redis pub/sub for notifications
    if (this.manager.shouldTerminate) {
      this.logger.debug(`terminating redis`);
      this.manager.terminate();
      this.shutdown();
    }
  }

  async process(topics?: string[]) {
    const subscriptions = this.getActiveSubsciptions(topics);

    // Create workers for each subscription if they don't exist
    await Bluebird.map(
      subscriptions,
      async topic => {
        if (!this.workers.has(topic)) {
          await this.setupWorker(topic);
        }
      },
      { concurrency: this.config.workerConfig?.max ?? 1 }
    );
  }

  // Get retry configuration from config or use defaults
  private getRetryConfig() {
    return {
      attempts: this.config.retryConfig?.attempts ?? 3,
      backoff: this.config.retryConfig?.backoff ?? {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    };
  }

  // Create a dead letter queue for a topic
  private async createDeadLetterQueue(topic: string): Promise<Queue> {
    const deadLetterQueueName = `${topic}:dead-letter`;

    if (this.deadLetterQueues.has(deadLetterQueueName)) {
      return this.deadLetterQueues.get(deadLetterQueueName)!;
    }

    this.logger.info(`Creating dead letter queue: ${deadLetterQueueName}`);
    const deadLetterQueue = new Queue(deadLetterQueueName, {
      connection: this.redisConnection,
    });

    this.deadLetterQueues.set(deadLetterQueueName, deadLetterQueue);
    return deadLetterQueue;
  }

  // Move a failed job to the dead letter queue
  private async moveToDeadLetter(job: Job, error: Error): Promise<void> {
    try {
      const topic = job.queueName;
      const deadLetterQueue = await this.createDeadLetterQueue(topic);

      // Add the job to the dead letter queue with error information
      await deadLetterQueue.add(
        'failed-job',
        {
          originalData: job.data,
          processedOn: job.processedOn,
          failedReason: error.message,
          stack: error.stack,
          attemptsMade: job.attemptsMade,
        },
        {
          jobId: `${job.id}-failed-${Date.now()}`,
        }
      );

      this.logger.info(
        { jobId: job.id, topic, error: error.message },
        'Moved failed job to dead letter queue'
      );

      // Optionally, you might want to remove the job from the original queue
      // await job.remove();
    } catch (dlqError) {
      this.logger.error(
        {
          jobId: job.id,
          topic: job.queueName,
          originalError: error.message,
          dlqError,
        },
        'Failed to move job to dead letter queue'
      );
    }
  }

  async setupWorker(topic: string) {
    // Ensure queue exists
    await this.createQueue(topic);

    // Create worker
    const worker = new Worker(
      topic,
      async job => {
        if (this.state === 'paused') {
          return;
        }

        await this.wrap({ topic, payload: { message: job.data } }, async c => {
          let params;
          let resource;
          try {
            resource = await this.pool.acquire();
            params = job.data;
            const runnerContext = getContext(params);
            this.registry.emit(
              'runner_receive',
              c.topic,
              params,
              runnerContext
            );

            const task = this.registry.getTask(topic);
            if (!task) {
              this.logger.error(`Unknown Task ${topic}`);
              return;
            }
            this.logger.debug(
              { topic, params, attempt: job.attemptsMade },
              'Start subscribe'
            );
            const { context = null, ...value } = params;
            await task.subscribe(value, context);
            const completedContext = getContext(params);
            this.registry.emit(
              'runner_complete',
              topic,
              params,
              completedContext
            );
          } catch (error) {
            this.logger.error(
              {
                params,
                topic,
                error,
                attempt: job.attemptsMade,
                maxAttempts: this.getRetryConfig().attempts,
              },
              'Error while executing consumer callback'
            );

            this.registry.emit('runner_failure', topic, error, params);

            // If this was the final retry attempt, move to dead letter queue
            if (job.attemptsMade >= this.getRetryConfig().attempts) {
              await this.moveToDeadLetter(job, error);
              this.registry.emit(
                'runner_max_retries',
                topic,
                error,
                params,
                job.attemptsMade
              );
            }

            throw error; // Let BullMQ know the job failed and should be retried if attempts remain
          } finally {
            if (resource) await this.pool.release(resource);
          }
        });
      },
      {
        connection: this.redisConnection,
        concurrency: this.config.workerConfig?.max ?? 1,
        autorun: true,
      }
    );

    // Setup event handlers
    worker.on('failed', (job, error) => {
      if (!job) return;

      const attemptDetails = job
        ? `(Attempt ${job.attemptsMade}/${this.getRetryConfig().attempts})`
        : '';

      this.logger.error(
        { jobId: job.id, topic, error, attemptDetails },
        `Job failed ${attemptDetails}`
      );
    });

    worker.on('completed', job => {
      this.logger.debug({ jobId: job.id, topic }, 'Job completed successfully');
    });

    worker.on('error', error => {
      this.logger.error({ topic, error }, 'Worker error');
    });

    // Store the worker
    this.workers.set(topic, worker);

    // Setup queue events
    const queueEvents = new QueueEvents(topic, {
      connection: this.redisConnection,
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.debug({ jobId, topic, failedReason }, 'Job failed event');
    });

    queueEvents.on('stalled', ({ jobId }) => {
      this.logger.warn({ jobId, topic }, 'Job stalled');
    });

    this.queueEvents.set(topic, queueEvents);

    return worker;
  }

  async createQueue(topic: string): Promise<boolean> {
    if (this.queues.has(topic)) {
      this.logger.debug(`${topic} queue already exists`);
      return false;
    }

    this.logger.info(`creating BullMQ queue ${topic}`);
    const queue = new Queue(topic, {
      connection: this.redisConnection,
      defaultJobOptions: this.getRetryConfig(),
    });

    this.queues.set(topic, queue);
    return true;
  }

  async shutdown() {
    // Close all workers
    for (const [topic, worker] of this.workers.entries()) {
      this.logger.debug(`Closing worker for ${topic}`);
      await worker.close();
    }

    // Close all queue events
    for (const [topic, queueEvent] of this.queueEvents.entries()) {
      this.logger.debug(`Closing queue events for ${topic}`);
      await queueEvent.close();
    }

    // Close all queues
    for (const [topic, queue] of this.queues.entries()) {
      this.logger.debug(`Closing queue for ${topic}`);
      await queue.close();
    }

    // Close all dead letter queues
    for (const [topic, queue] of this.deadLetterQueues.entries()) {
      this.logger.debug(`Closing dead letter queue for ${topic}`);
      await queue.close();
    }

    // Close Redis connection
    this.redisConnection.disconnect();
  }
}
export default RedisRunner;
