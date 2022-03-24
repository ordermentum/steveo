import nullLogger from 'null-logger';
import Kafka, {
  AdminClient,
  IAdminClient,
  KafkaConsumer,
  Message,
} from 'node-rdkafka';
import BaseRunner from '../base/base_runner';
import { getDuration } from './utils';
import {
  Hooks,
  IRunner,
  Logger,
  IRegistry,
  KafkaConfiguration,
  Configuration,
} from '../common';

class KafkaRunner extends BaseRunner
  implements IRunner<KafkaConsumer, Message> {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  consumer: KafkaConsumer;

  adminClient: IAdminClient;

  hooks?: Hooks;

  constructor({
    config,
    registry,
    logger = nullLogger,
    hooks = {},
  }: {
    config: Configuration;
    registry: IRegistry;
    logger: Logger;
    hooks?: Hooks;
  }) {
    super(hooks);
    this.hooks = hooks;
    this.config = config;
    this.registry = registry;
    this.logger = logger;

    this.consumer = new Kafka.KafkaConsumer(
      {
        'bootstrap.servers': (this.config as KafkaConfiguration)
          .bootstrapServers,
        'security.protocol': (this.config as KafkaConfiguration)
          .securityProtocol,
        ...((this.config as KafkaConfiguration).consumer?.global ?? {}),
      },
      (this.config as KafkaConfiguration).consumer?.topic ?? {}
    );

    this.adminClient = AdminClient.create({
      'bootstrap.servers': (this.config as KafkaConfiguration).bootstrapServers,
      'security.protocol': (this.config as KafkaConfiguration).securityProtocol,
      ...(this.config as KafkaConfiguration).admin,
    });
  }

  receive = async (message: Message) => {
    const { topic } = message;
    const config = this.config as KafkaConfiguration;
    const { parseMessage, waitToCommit } = config;
    try {
      const valueString = message.value?.toString() ?? '';
      let value = valueString;

      if (parseMessage) {
        try {
          value = JSON.parse(valueString);
        } catch (e) {} // eslint-disable-line no-empty
      }
      const parsed = {
        ...message,
        value,
        key: message.key?.toString(),
      };
      this.registry.events.emit('runner_receive', topic, parsed, {
        ...message,
        start: getDuration(),
      });
      const task = this.registry.getTask(topic);

      if (!task) {
        this.logger.error(`Unknown Task ${topic}`);
        this.consumer.commitMessage(message);
        return;
      }

      if (!waitToCommit) {
        this.consumer.commitMessage(message);
      }
      this.logger.debug('Start subscribe', topic, message);
      if (this.hooks?.preTask) {
        await this.hooks.preTask(parsed);
      }
      const result = await task.subscribe(parsed);
      if (this.hooks?.postTask) {
        await this.hooks.postTask({ ...parsed, result });
      }
      if (waitToCommit) {
        this.consumer.commitMessage(message);
      }
      this.logger.debug('Finish subscribe', topic, message);
      this.registry.events.emit('runner_complete', topic, parsed, {
        ...message,
        end: getDuration(),
      });
    } catch (ex) {
      this.logger.error('Error while executing consumer callback ', {
        message,
        topic,
        error: ex,
      });
      this.registry.events.emit('runner_failure', topic, ex, message);
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
   */
  healthCheck = async function() {
    return new Promise<void>((resolve, reject) => {
      /**
       * if you are concerned about potential performance issues,
       * don't be, it returns early if it has a local connection status
       * only fallsback to the kafka client if the local connection status is missing
       */
      this.consumer.getMetadata({}, err => {
        if (err) {
          return reject();
        }
        return resolve();
      });
    });
  };

  consumeCallback = async (err, messages) => {
    this.logger.debug('Consumer callback');
    await this.checks(
      () => {},
      () => this.healthCheck
    );
    if (err) {
      const message = 'Error while consumption';
      this.logger.error(`${message} - ${err}`);
      this.registry.events.emit(
        'runner_connection_failure',
        null,
        err,
        message
      ); // keeping the argument order - (eventName, topicName, error, message)
      this.consumer.consume(1, this.consumeCallback);
      return;
    }
    try {
      if (messages?.length) {
        await this.receive(messages[0]);
      }
    } finally {
      this.consumer.consume(1, this.consumeCallback);
    }
  };

  process(topics: Array<string>) {
    return new Promise<KafkaConsumer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.error('Connection timed out');
        reject();
      }, (this.config as KafkaConfiguration).connectionTimeout!);
      this.consumer.connect({}, err => {
        clearTimeout(timeoutId);
        if (err) {
          this.logger.error('Error initializing consumer', err);
          reject();
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
        const topicsWithTasks = topics.filter(
          topic => !!this.registry.getTask(topic)
        );
        if (topicsWithTasks.length) {
          this.consumer.subscribe(topicsWithTasks);
          this.consumer.consume(1, this.consumeCallback);
        }
        resolve(this.consumer);
      });
    });
  }

  async createQueue({ topic }) {
    const task = this.registry.getTask(topic);
    return new Promise<void>((resolve, reject) => {
      const options = task?.attributes ?? {};
      this.adminClient.createTopic(
        {
          topic,
          num_partitions:
            options.num_partitions ??
            (this.config as KafkaConfiguration).defaultTopicPartitions,
          replication_factor:
            options.replication_factor ??
            (this.config as KafkaConfiguration).defaultTopicReplicationFactor,
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

  async disconnect() {
    this.consumer.disconnect();
    this.adminClient.disconnect();
  }
}

export default KafkaRunner;
