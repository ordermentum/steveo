import Bluebird from 'bluebird';
import { Queue, QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Steveo } from '..';
import { IRunner, RedisConfiguration } from '../common';
import { getContext } from '../lib/context';
import { Logger } from '../lib/logger';
import BaseRunner from './base';
import { TaskOptions } from '../types/task-options';
import { getRedisInstance } from '../config/redis';

class RedisRunner extends BaseRunner implements IRunner {
  config: RedisConfiguration;

  logger: Logger;

  redisConnection: IORedis;

  queues: Map<string, Queue>;

  workers: Map<string, Worker>;

  queueEvents: Map<string, QueueEvents>;

  private stateCheckInterval: NodeJS.Timeout | null = null;

  constructor(steveo: Steveo) {
    super(steveo);
    this.config = steveo.config as RedisConfiguration;
    this.logger = steveo.logger;

    // Create Redis connection
    this.redisConnection = getRedisInstance(this.config);

    this.queues = new Map();
    this.workers = new Map();
    this.queueEvents = new Map();

    // Start the state check interval
    this.startStateCheck();
  }

  private startStateCheck() {
    // Clear any existing interval
    if (this.stateCheckInterval) {
      clearInterval(this.stateCheckInterval);
    }

    // Check state every 5 seconds
    this.stateCheckInterval = setInterval(() => {
      this.checkState();
    }, 5000);
  }

  private async checkState() {
    try {
      if (this.manager.shouldTerminate) {
        this.logger.debug('State check: terminating Redis runner');
        this.manager.terminate();
        await this.shutdown();
        return;
      }

      if (this.state === 'paused') {
        // Check if workers need to be paused
        for (const [topic, worker] of this.workers.entries()) {
          if (!worker.isPaused()) {
            this.logger.debug(`State check: pausing worker for ${topic}`);
            await worker.pause();
          }
        }
      } else if (this.state === 'running') {
        // Check if workers need to be resumed
        for (const [topic, worker] of this.workers.entries()) {
          if (worker.isPaused()) {
            this.logger.debug(`State check: resuming worker for ${topic}`);
            worker.resume();
          }
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Error in state check interval');
    }
  }

  // These methods have empty implementations as BullMQ handles them internally
  async receive(_messages: any[], _topic: string): Promise<any> {
    return Promise.resolve();
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
      { concurrency: this.config.workerConfig?.max ?? 4 }
    );
  }

  // Get retry configuration from config or use defaults
  private getRetryConfig(topic: string) {
    const task = this.registry.getTask(topic);
    if (!task) {
      throw new Error(`Task not found for topic: ${topic}`);
    }
    const options = task.options as TaskOptions['redis'];
    return {
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs in the queue for inspection
      attempts: 3,
      backoff: options.backoff || {
        type: 'exponential',
        delay: 1000,
      },
      ...options,
    };
  }

  async setupWorker(topic: string) {
    const workerConfig = this.getRetryConfig(topic);
    // Ensure queue exists
    await this.createQueue(topic);

    // Create worker
    const worker = new Worker(
      topic,
      async job => {
        await this.wrap({ topic, payload: { message: job.data } }, async c => {
          let params;
          try {
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
                maxAttempts: workerConfig.attempts,
              },
              'Error while executing consumer callback'
            );

            this.registry.emit('runner_failure', topic, error, params);
            // If this was the final retry attempt, emit a special event
            if (job.attemptsMade >= workerConfig.attempts) {
              this.registry.emit(
                'runner_max_retries',
                topic,
                error,
                params,
                job.attemptsMade
              );
            }

            throw error; // Let BullMQ know the job failed and should be retried if attempts remain
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

      const attemptDetails = `(Attempt ${job.attemptsMade}/${workerConfig.attempts})`;
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

    const task = this.registry.getTask(topic);
    if (!task) {
      this.logger.error(`Unknown Task ${topic}`);
      return false;
    }

    this.logger.info(`creating BullMQ queue ${topic}`);
    const queue = new Queue(topic, {
      connection: this.redisConnection,
      defaultJobOptions: this.getRetryConfig(topic),
    });

    this.queues.set(topic, queue);
    return true;
  }

  async shutdown() {
    // Clear the state check interval
    if (this.stateCheckInterval) {
      clearInterval(this.stateCheckInterval);
      this.stateCheckInterval = null;
    }

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

    // Close Redis connection
    this.redisConnection.disconnect();
  }
}

export default RedisRunner;
