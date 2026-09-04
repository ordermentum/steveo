import Kafka, {
  AdminClient,
  IAdminClient,
  KafkaConsumer,
  Message,
  TopicPartitionOffset,
} from '@confluentinc/kafka-javascript';
import Bluebird from 'bluebird';
import nullLogger from 'null-logger';
import BaseRunner from './base';
import { getContext } from '../lib/context';
import { IRunner, KafkaConfiguration } from '../common';
import { Logger } from '../lib/logger';
import { Steveo } from '..';
import { sleep } from '../lib/utils';

class JsonParsingError extends Error {}

class KafkaRunner
  extends BaseRunner
  implements IRunner<KafkaConsumer, Message>
{
  config: KafkaConfiguration;

  logger: Logger;

  consumer: KafkaConsumer;

  adminClient: IAdminClient;

  consumerReady: boolean;

  private debugEnabled: boolean;

  private processedOffsets = new Map<string, TopicPartitionOffset>();

  constructor(steveo: Steveo) {
    super(steveo);
    this.config = steveo.config as KafkaConfiguration;
    this.logger = steveo.logger ?? nullLogger;
    this.consumerReady = false;
    const debugValue =
      this.config.consumer?.global?.debug ??
      (process.env.KAFKA_DEBUG !== undefined && process.env.KAFKA_DEBUG !== ''
        ? process.env.KAFKA_DEBUG
        : undefined);
    this.debugEnabled = !!debugValue;

    this.consumer = new Kafka.KafkaConsumer(
      {
        'bootstrap.servers': this.config.bootstrapServers,
        'security.protocol': this.config.securityProtocol,
        // the client handles assign/unassign, including cooperative
        rebalance_cb: true,
        offset_commit_cb: (err, topicPartitions) => {
          if (err) {
            this.logger.error(err);
          } else {
            this.logger.debug(
              'Offset commit successful',
              topicPartitions,
              ' assigments',
              // We need to rely on the manager state
              // to avoid race condition between this callback and
              // the termination
              this.manager.shouldTerminate ? [] : this.consumer.assignments()
            );
          }
        },
        // Only include debug property if explicitly enabled
        // Set KAFKA_DEBUG='cgrp,broker,topic' to enable debug logging
        ...(debugValue ? { debug: debugValue } : {}),
        ...(this.config.consumer?.global ?? {}),
      },
      this.config.consumer?.topic ?? {}
    );

    this.consumer.on('rebalance', err => {
      if (err?.code === Kafka.CODES.ERRORS.ERR__REVOKE_PARTITIONS) {
        this.flushOffsets();
      }
    });

    this.consumer.on('rebalance.error', err => {
      this.logger.error('Error during rebalance', err);
    });

    this.adminClient = AdminClient.create({
      'bootstrap.servers': this.config.bootstrapServers,
      'security.protocol': this.config.securityProtocol,
      ...(this.config.admin ?? {}),
    });
  }

  /**
   * Required by IRunner interface, but in Kafka it processes a single message without the topic/partition params.
   * For Kafka, the message object already contains topic and partition information.
   * This is called internally by processBatch. Concurrency is controlled by Bluebird.map.
   */
  async receive(
    message: Message,
    _topic?: string,
    _partition?: number
  ): Promise<void> {
    const { topic } = message;

    try {
      const startTime = Date.now();
      const payload = this.parseMessagePayload(message);

      await this.wrap({ topic, payload }, async c => {
        const parsed = {
          ...message,
          value: c.payload,
          key: message.key?.toString(),
        };
        this.registry.emit(
          'runner_receive',
          c.topic,
          parsed,
          getContext(payload)
        );
        this.logger.debug(`loading task`);
        const task = this.registry.getTask(c.topic);

        if (!task) {
          this.logger.error(`Unknown Task ${c.topic}`);
          return;
        }

        this.logger.debug('Start subscribe', c.topic, message);
        const { _meta: _ = {}, ...data } = c.payload;

        await task.subscribe({ ...data, value: data }, getContext(payload));

        this.logger.debug('Finish subscribe', c.topic, message);
        this.registry.emit('runner_complete', c.topic, parsed, {
          ...getContext(payload),
          processingMs: Date.now() - startTime,
        });
      });
    } catch (error) {
      this.logger.error(
        {
          message,
          topic,
          error,
        },
        'Error while executing consumer callback'
      );
      this.registry.emit('runner_failure', topic, error, message);
      throw error;
    }
  }

  private parseMessagePayload(message: Message): Record<string, any> {
    const messageValue: string = (message.value ?? '').toString();
    try {
      return JSON.parse(messageValue);
    } catch (e) {
      throw new JsonParsingError();
    }
  }

  /**
   * Get batch size based on configuration
   */
  private getBatchSize(): number {
    return this.config.batchProcessing?.enabled
      ? this.config.batchProcessing.batchSize || 5
      : 1;
  }

  private async processBatch(messages: Message[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }
    const batchSize = Math.min(messages.length, this.getBatchSize());
    const batch = messages.slice(0, batchSize);

    this.logger.debug(`Processing batch of ${batch.length} messages`);

    const startTime = Date.now();

    // Determine concurrency limit
    // If concurrency is enabled, use the configured limit (default: 10)
    // Otherwise, process all messages in the batch concurrently (no limit)
    const concurrency = this.config.concurrency?.enabled
      ? this.config.concurrency.maxConcurrent || 10
      : batch.length;

    const results = await Bluebird.map(
      batch,
      async (msg: Message) => {
        try {
          await this.receive(msg);
          return { status: 'fulfilled' as const };
        } catch (error) {
          return { status: 'rejected' as const, reason: error };
        }
      },
      { concurrency }
    );

    const failures = results.filter(r => r.status === 'rejected');
    const succeeded = results.length - failures.length;
    const duration = Date.now() - startTime;

    this.registry.emit('batch_processed', {
      batchSize: batch.length,
      succeeded,
      failed: failures.length,
      duration,
    });

    // Always commit, even if there are failures
    // This prevents infinite reprocessing of failed messages
    if (failures.length > 0) {
      this.logger.warn(
        `Batch had ${failures.length} failures out of ${batch.length} messages.`
      );

      // Log first failure for debugging
      const firstFailure = failures[0];
      if (firstFailure.status === 'rejected') {
        this.logger.error('First batch failure:', firstFailure.reason);
      }

      // Emit failure event
      this.registry.emit('batch_failure', {
        batchSize: batch.length,
        failureCount: failures.length,
        error: failures[0],
      });
    } else {
      this.logger.debug(`Batch succeeded (${batch.length} messages)`);
    }

    this.commitBatch(batch);
  }

  /**
   * A batch is drained from the consumer queue, so it can span partitions and
   * topics. Committing only the final message leaves the rest of the batch
   * uncommitted and redelivered on the next rebalance.
   */
  private commitBatch(batch: Message[]): void {
    const highestPerPartition = new Map<string, Message>();

    for (const message of batch) {
      const key = `${message.topic}/${message.partition}`;
      const highest = highestPerPartition.get(key);

      if (!highest || message.offset > highest.offset) {
        highestPerPartition.set(key, message);
      }
    }

    for (const [key, message] of highestPerPartition) {
      this.consumer.commitMessage(message);
      this.processedOffsets.set(key, {
        topic: message.topic,
        partition: message.partition,
        offset: message.offset + 1,
      });
    }
  }

  /**
   * commitMessage is queued, and librdkafka only flushes offsets on revoke when
   * enable.auto.commit is on. Committing here, while the old generation is
   * still current, keeps those messages from being redelivered. We send what we
   * processed rather than the stored offsets, which run ahead of processing.
   */
  private flushOffsets(): void {
    if (!this.processedOffsets.size) {
      return;
    }

    try {
      this.consumer.commitSync([...this.processedOffsets.values()]);
    } catch (e) {
      this.logger.error('Error committing offsets before revoke', e);
    }

    this.processedOffsets.clear();
  }

  reconnect = async () =>
    new Promise<void>((resolve, reject) => {
      this.consumer.disconnect(() => {
        // eslint-disable-next-line consistent-return
        this.consumer.connect({}, err => {
          if (err) {
            this.logger.error('Error reconnecting consumer', err);
            return reject();
          }
          this.logger.info('Reconnected successfully');
          resolve();
        });
      });
    });

  /**
   *
   * @description It's a bound function to avoid binding when passing as callback to the checker function
   * Reference: https://github.com/Blizzard/node-rdkafka/issues/217#issuecomment-313582908
   */
  healthCheck = async function () {
    return new Promise<void>((resolve, reject) => {
      if (this.consumer.isConnected()) {
        resolve();
        return;
      }
      reject(new Error('Kafka consumer is not connected'));
    });
  };

  consumeCallback = async (err, messages) => {
    this.logger.debug('Consumer callback: ', messages?.[0]);

    if (this.manager.shouldTerminate) {
      this.logger.debug(`terminating kafka consumer`);
      await this.shutdown();
      return;
    }

    if (this.state === 'paused') {
      this.logger.debug('Consumer paused');
      await sleep(1000);
      this.consumer.consume(this.getBatchSize(), this.consumeCallback);
      return;
    }

    if (err) {
      const message = 'Error while consumption';
      this.logger.error(`${message} - ${err}`);
      this.registry.emit('runner_connection_failure', null, err, message);
      this.consumer.consume(this.getBatchSize(), this.consumeCallback);
      return;
    }

    try {
      if (messages && messages?.length) {
        await this.processBatch(messages);
      }
    } finally {
      this.consumer.consume(this.getBatchSize(), this.consumeCallback);
    }
  };

  /**
   * Important to note that Kafka is different to SQS and Redis Runners
   * as with they are both polling consumers
   * no timeout behaviour, need to hook into the stream provided by node-rdkafka
   */
  process(topics: Array<string>) {
    return new Promise<KafkaConsumer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.error(
          'Kafka connection timed out. Bootstrap servers:',
          this.config.bootstrapServers
        );
        reject(new Error('Kafka connection timed out'));
      }, this.config.connectionTimeout);

      this.consumer.connect({}, err => {
        clearTimeout(timeoutId);
        if (err) {
          this.logger.error('Error initializing consumer', err);
          reject(err);
        }
      });

      this.consumer.on('event.log', log => {
        // Log Kafka internal messages (includes join/leave/rebalance events) only when debug is enabled
        if (this.debugEnabled) {
          this.logger.info(log.message);
        }
      });

      this.consumer.on('disconnected', () => {
        this.logger.debug('Consumer disconnected');
      });

      this.consumer.on('event.error', err => {
        this.logger.error('Error from consumer', err);
      });

      this.consumer.on('ready', () => {
        clearTimeout(timeoutId);
        this.logger.info('Kafka consumer ready');
        this.consumerReady = true;

        const topicsWithTasks = this.getTopicsWithTasks(topics);

        if (topicsWithTasks.length) {
          this.consumer.subscribe(topicsWithTasks);
          this.consumer.consume(this.getBatchSize(), this.consumeCallback);
        }
        resolve(this.consumer);
      });
    });
  }

  getTopicsWithTasks(topics: string[]) {
    const topicsWithTasks = topics.filter(
      topic => !!this.registry.getTask(topic)
    );
    return topicsWithTasks;
  }

  async createQueue(topic: string) {
    this.logger.info(`creating kafka topic ${topic}`);

    const task = this.registry.getTask(topic);
    return new Promise<boolean>((resolve, reject) => {
      const options = task?.options ?? {};

      const partitions =
        options.num_partitions ?? this.config.defaultTopicPartitions ?? 1;
      const replication =
        options.replication_factor ??
        this.config.defaultTopicReplicationFactor ??
        1;

      this.adminClient.createTopic(
        {
          topic,
          num_partitions: partitions,
          replication_factor: replication,
        },
        err => {
          if (err) {
            return reject(err);
          }
          return resolve(true);
        }
      );
    });
  }

  async shutdown() {
    this.logger.debug(`stopping consumer ${this.name}`);
    this.consumer.disconnect();
    this.adminClient.disconnect();
    this.manager.terminate();
  }
}

export default KafkaRunner;
