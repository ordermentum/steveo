import Kafka, {
  AdminClient,
  IAdminClient,
  KafkaConsumer,
  Message,
} from 'node-rdkafka';
import nullLogger from 'null-logger';
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
import { Steveo } from '..';

class JsonParsingError extends Error { }

class KafkaRunner extends BaseRunner
  implements IRunner<KafkaConsumer, Message> {
  config: Configuration<KafkaConfiguration>;

  logger: Logger;

  registry: IRegistry;

  consumer: KafkaConsumer;

  adminClient: IAdminClient;

  hooks?: Hooks;

  constructor(steveo: Steveo) {
    super(steveo);
    this.hooks = steveo?.hooks;
    this.config = steveo?.config;
    this.registry = steveo?.registry;
    this.logger = steveo?.logger ?? nullLogger;
    this.consumer = new Kafka.KafkaConsumer(
      {
        'bootstrap.servers': this.config.bootstrapServers,
        'security.protocol': this.config.securityProtocol,
        offset_commit_cb: (err, topicPartitions) => {
          if (err) {
            this.logger.error(err);
          } else {
            this.logger.debug('Offset commit successful', topicPartitions, ' assigments', this.consumer.assignments());
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

    try {
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
        this.logger.debug(`committing message ${message}`);
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
      if (ex instanceof JsonParsingError) {
        this.consumer.commitMessage(message);
      }
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
  healthCheck = async function () {
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
    this.logger.debug('Consumer callback', messages?.[0]);
    this.logger.debug('Consumer assignments', this.consumer.assignments());
    await this.healthCheck();

    if (this.steveo.exiting) {
      this.disconnect();
      return;
    }

    if (this.paused) {
      this.logger.debug('Consumer paused');
      return;
    }

    await this.preProcess();

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

      setInterval(() => {
        if (this.paused) {
          this.logger.debug('Pausing consumer', this.consumer.assignments());
          this.consumer.pause(this.consumer.assignments());
        } else {
          this.logger.debug('Playing consumer', this.consumer.assignments());
          this.consumer.resume(this.consumer.assignments());
        }
      }, this.config.pauseInterval ?? 5000);

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

  async disconnect() {
    this.consumer.disconnect();
    this.adminClient.disconnect();
  }
}

export default KafkaRunner;
