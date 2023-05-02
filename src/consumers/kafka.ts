import Kafka, {
  AdminClient,
  IAdminClient,
  KafkaConsumer,
  Message,
} from 'node-rdkafka';
import nullLogger from 'null-logger';
import { Pool } from 'generic-pool';
import BaseRunner from './base';
import { getDuration } from '../lib/context';
import { Hooks, IRunner, Logger, KafkaConfiguration } from '../common';
import { Steveo } from '..';

class JsonParsingError extends Error {}

class KafkaRunner
  extends BaseRunner
  implements IRunner<KafkaConsumer, Message>
{
  config: KafkaConfiguration;

  logger: Logger;

  consumer: KafkaConsumer;

  adminClient: IAdminClient;

  hooks?: Hooks;

  consumerReady: boolean;

  pool: Pool<any>;

  constructor(steveo: Steveo) {
    super(steveo);
    this.hooks = steveo?.hooks;
    this.config = steveo?.config as KafkaConfiguration;
    this.pool = steveo?.pool;
    this.logger = steveo?.logger ?? nullLogger;
    this.consumerReady = false;
    this.consumer = new Kafka.KafkaConsumer(
      {
        'bootstrap.servers': this.config.bootstrapServers,
        'security.protocol': this.config.securityProtocol,
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

  receive = async (message: Message) => {
    const { topic } = message;
    const { waitToCommit } = this.config;
    let resource;

    try {
      this.logger.debug(`waiting for pool`);
      resource = await this.pool.acquire();
      this.logger.debug(`acquired pool`);
      const valueString = message.value?.toString() ?? '';
      let value = valueString;
      try {
        value = JSON.parse(valueString);
      } catch (e) {
        throw new JsonParsingError();
      }
      const parsed = {
        ...message,
        value,
        key: message.key?.toString(),
      };
      this.registry.emit('runner_receive', topic, parsed, {
        ...message,
        start: getDuration(),
      });
      this.logger.debug(`loading task`);
      const task = this.registry.getTask(topic);

      if (!task) {
        this.logger.error(`Unknown Task ${topic}`);
        this.consumer.commitMessage(message);
        return;
      }

      if (!waitToCommit) {
        this.logger.debug(`commit offset ${message.offset}`);
        this.consumer.commitMessage(message);
      }

      this.logger.debug('Start subscribe', topic, message);
      if (this.hooks?.preTask) {
        await this.hooks.preTask(parsed);
      }
      // @ts-ignore
      const context = parsed.value.context ?? null;
      const result = await task.subscribe(parsed, context);
      if (this.hooks?.postTask) {
        await this.hooks.postTask({ ...parsed, result });
      }

      if (waitToCommit) {
        this.logger.debug('committing message', message);
        this.consumer.commitMessage(message);
      }

      this.logger.debug('Finish subscribe', topic, message);
      this.registry.emit('runner_complete', topic, parsed, {
        ...message,
        end: getDuration(),
      });
    } catch (ex) {
      this.logger.error('Error while executing consumer callback ', {
        message,
        topic,
        error: ex,
      });
      this.registry.emit('runner_failure', topic, ex, message);
      if (ex instanceof JsonParsingError) {
        this.consumer.commitMessage(message);
      }
    }

    if (resource) {
      this.logger.debug(`releasing pool`);
      await this.pool.release(resource);
    }
  };

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
       * only fallsback to the kafka client if the local connection status is missing
       */
      this.consumer.getMetadata({}, (err, meta) => {
        this.logger.debug(`metadata response meta=${meta} err=${err}`);
        if (err) {
          return reject(err);
        }
        return resolve(meta);
      });
    });
  };

  consumeCallback = async (err, messages) => {
    this.logger.debug(`Consumer callback: ${messages?.[0]}`);

    if (this.state === 'terminating') {
      this.logger.debug(`terminating kafka consumer`);
      this.state = 'terminated';
      return;
    }

    await this.preProcess();

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
      if (this.state === 'paused') {
        this.logger.debug('Consumer paused');
      } else {
        this.consumer.consume(1, this.consumeCallback);
      }
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

  async createQueue({ topic }) {
    this.logger.info(`creating kafka topic ${topic}`);

    const task = this.registry.getTask(topic);
    return new Promise<void>((resolve, reject) => {
      const options = task?.attributes ?? {};
      this.adminClient.createTopic(
        {
          topic,
          num_partitions:
            options.num_partitions ?? this.config.defaultTopicPartitions,
          replication_factor:
            options.replication_factor ??
            this.config.defaultTopicReplicationFactor,
        },
        // eslint-disable-next-line consistent-return
        err => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  async stop() {
    this.logger.debug(`stopping consumer ${this.name}`);
    this.consumer.disconnect();
    this.adminClient.disconnect();
  }

  async resume() {
    if (!this.consumerReady) return;
    if (!this.consumer.isConnected()) {
      throw new Error('Lost connection to kafka');
    }
    if (this.state === 'terminating') return;
    if (this.state === 'paused') {
      this.logger.debug('Resuming consumer');
      this.state = 'running';
      this.consumer.consume(1, this.consumeCallback);
    }
  }
}

export default KafkaRunner;
