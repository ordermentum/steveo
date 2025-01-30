import Kafka, {
  AdminClient,
  IAdminClient,
  KafkaConsumer,
  Message,
} from 'node-rdkafka';
import nullLogger from 'null-logger';
import { Pool } from 'generic-pool';
import BaseRunner from './base';
import { getContext } from '../lib/context';
import { IRunner, KafkaConfiguration } from '../common';
import { Logger } from '../lib/logger';
import { Steveo } from '..';
import { Resource } from '../lib/pool';
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

  pool: Pool<Resource>;

  constructor(steveo: Steveo) {
    super(steveo);
    this.config = steveo.config as KafkaConfiguration;
    this.pool = steveo.pool;
    this.logger = steveo.logger ?? nullLogger;
    this.consumerReady = false;
    this.consumer = new Kafka.KafkaConsumer(
      {
        'bootstrap.servers': this.config.bootstrapServers,
        'security.protocol': this.config.securityProtocol,
        rebalance_cb: (err, assignment) => {
          this.logger.debug('Rebalance event', err, assignment);
          try {
            /**
             * These error codes can mean that the consumer needs to reassign
             *
             * KafkaJS (another kafka client) has a similar implementation
             * See: https://github.com/tulios/kafkajs/pull/1474
             * See: https://github.com/tulios/kafkajs/blob/master/src/consumer/runner.js#L115-L160
             */
            if (
              [
                Kafka.CODES.ERRORS.ERR__ASSIGN_PARTITIONS,
                Kafka.CODES.ERRORS.ERR_NOT_COORDINATOR_FOR_GROUP,
                Kafka.CODES.ERRORS.ERR_REBALANCE_IN_PROGRESS,
                Kafka.CODES.ERRORS.ERR_ILLEGAL_GENERATION,
                Kafka.CODES.ERRORS.ERR_UNKNOWN_MEMBER_ID,
              ].includes(err.code)
            ) {
              if (this.consumer.rebalanceProtocol() === 'COOPERATIVE') {
                this.consumer.incrementalAssign(assignment);
              } else {
                this.consumer.assign(assignment);
              }
            } else if (err.code === Kafka.CODES.ERRORS.ERR__REVOKE_PARTITIONS) {
              if (this.consumer.rebalanceProtocol() === 'COOPERATIVE') {
                this.consumer.incrementalUnassign(assignment);
              } else {
                this.consumer.unassign();
              }
            }
          } catch (e) {
            this.logger.error('Error during rebalance', e);
            // Shutting down the consumer to not have a zombie consumer
            if (this.consumer.isConnected()) this.shutdown();
          }
        },
        offset_commit_cb: (err, topicPartitions) => {
          if (err) {
            this.logger.error(err);
          } else {
            this.logger.debug(
              'Offset commit successful',
              topicPartitions,
              ' assigments',
              this.consumer.assignments()
            );
          }
        },
        ...(this.config.consumer?.global ?? {}),
      },
      this.config.consumer?.topic ?? {}
    );

    this.adminClient = AdminClient.create({
      'bootstrap.servers': this.config.bootstrapServers,
      'security.protocol': this.config.securityProtocol,
      ...(this.config.admin ?? {}),
    });
  }

  async receive(message: Message) {
    const { topic } = message;
    const { waitToCommit } = this.config;
    let resource: Resource | null = null;

    try {
      const payload = this.parseMessagePayload(message);

      await this.wrap({ topic, payload }, async c => {
        this.logger.debug(`waiting for pool ${c.topic}`);
        resource = await this.pool.acquire();
        this.logger.debug(`acquired pool`);

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
          this.consumer.commitMessage(message);
          return;
        }

        if (!waitToCommit) {
          this.logger.debug(`commit offset ${message.offset}`);
          this.consumer.commitMessage(message);
        }

        this.logger.debug('Start subscribe', c.topic, message);
        const { _meta: _ = {}, ...data } = c.payload;

        /**
         * We still need the `value` property on the callback payload
         * to have backwards compatibility when upgrading steveo version
         * without needing to update every task with the new shape
         */
        await task.subscribe({ ...data, value: data }, getContext(payload));

        if (waitToCommit) {
          this.logger.debug({ message }, 'committing message');
          this.consumer.commitMessage(message);
        }

        this.logger.debug('Finish subscribe', c.topic, message);
        this.registry.emit(
          'runner_complete',
          c.topic,
          parsed,
          getContext(payload)
        );
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
      if (error instanceof JsonParsingError) {
        this.consumer.commitMessage(message);
      }
    }

    if (resource) {
      this.logger.debug('releasing pool');
      await this.pool.release(resource);
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
      /**
       * if you are concerned about potential performance issues,
       * don't be, it returns early if it has a local connection status
       * only falls back to the kafka client if the local connection status is missing
       */
      this.consumer.getMetadata(
        {
          allTopics: false,
          topic: '',
          timeout: 1000,
        },
        (err: Error, meta) => {
          this.logger.debug(`metadata response meta=${meta} err=${err}`);
          if (err) {
            return reject(err);
          }
          return resolve(meta);
        }
      );
    });
  };

  consumeCallback = async (err, messages) => {
    this.logger.debug(`Consumer callback: ${messages?.[0]}`);

    if (this.state === 'terminating') {
      this.logger.debug(`terminating kafka consumer`);
      this.state = 'terminated';
      await this.shutdown();
      return;
    }

    if (this.state === 'paused') {
      this.logger.debug('Consumer paused');
      await sleep(1000);
      this.consumer.consume(1, this.consumeCallback);
      return;
    }

    if (err) {
      const message = 'Error while consumption';
      this.logger.error(`${message} - ${err}`);
      this.registry.emit('runner_connection_failure', null, err, message); // keeping the argument order - (eventName, topicName, error, message)
      this.consumer.consume(1, this.consumeCallback);
      return;
    }
    try {
      if (messages && messages?.length) {
        await this.receive(messages[0]);
      }
    } finally {
      this.consumer.consume(1, this.consumeCallback);
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
        this.logger.error('Connection timed out');
        reject();
      }, this.config.connectionTimeout);

      this.consumer.connect({}, err => {
        clearTimeout(timeoutId);
        if (err) {
          this.logger.error('Error initializing consumer', err);
          reject();
        }
      });

      this.consumer.on('event.log', log => {
        this.logger.debug(log.message);
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
          this.consumer.consume(1, this.consumeCallback);
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
  }
}

export default KafkaRunner;
