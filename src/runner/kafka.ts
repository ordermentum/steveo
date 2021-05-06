import nullLogger from 'null-logger';
import Kafka, {
  AdminClient,
  CODES,
  IAdminClient,
  KafkaConsumer,
  Message,
} from 'node-rdkafka';
import BaseRunner from '../base/base_runner';
import { getDuration } from './utils';
import {
  Hooks,
  IRunner,
  Pool,
  Logger,
  IRegistry,
  KafkaConfiguration,
  Configuration,
} from '../common';

const RECONNECTION_ERR_CODES = [
  CODES.ERRORS.ERR_UNKNOWN,
  CODES.ERRORS.ERR__TRANSPORT,
  CODES.ERRORS.ERR_BROKER_NOT_AVAILABLE,
  CODES.ERRORS.ERR__ALL_BROKERS_DOWN,
];

class KafkaRunner extends BaseRunner
  implements IRunner<KafkaConsumer, Message> {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  consumer: KafkaConsumer;

  pool: Pool<any>;

  paused: boolean;

  adminClient: IAdminClient;

  constructor(
    config: Configuration,
    registry: IRegistry,
    pool: Pool<any>,
    logger: Logger = nullLogger,
    hooks: Hooks = {}
  ) {
    super(hooks);
    this.config = config;
    this.registry = registry;
    this.logger = logger;
    this.pool = pool;
    this.paused = false;

    this.consumer = new Kafka.KafkaConsumer(
      {
        'bootstrap.servers': (this.config as KafkaConfiguration)
          .bootstrapServers,
        'security.protocol': 'ssl',
        ...((this.config as KafkaConfiguration).consumer?.global ?? {}),
      },
      (this.config as KafkaConfiguration).consumer?.topic ?? {}
    );

    this.adminClient = AdminClient.create({
      'bootstrap.servers': (this.config as KafkaConfiguration).bootstrapServers,
      'security.protocol': 'ssl',
      ...(this.config as KafkaConfiguration).admin,
    });
  }

  receive = async (message: Message) => {
    const { topic } = message;
    try {
      const parsed = {
        ...message,
        value: message.value?.toString(),
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
      if (!(this.config as KafkaConfiguration).waitToCommit) {
        this.consumer.commitMessage(message);
      }
      this.logger.debug('Start subscribe', topic, message);
      await task.subscribe(message);
      if ((this.config as KafkaConfiguration).waitToCommit) {
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

  reconnect = () => {
    this.consumer.disconnect(() => {
      this.consumer.connect({}, err => {
        if (err) {
          this.logger.error('Error reconnecting consumer', err);
          process.exit(1);
        }
      });
    });
  };

  async healthCheck() {
    console.log('📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙');
    console.log(':', );
    return new Promise<void>((resolve, reject) => {
      /**
       * if you are concerned about potential performance issues,
       * don't be, it returns early if it has a local connection status
       * only fallsback to the kafka client if the local connection status is missing
       */
      this.consumer.getMetadata({}, err => {
        if(err) {
          return reject();
        }
        return resolve();
      });
    });
  }

  consumeCallback = async (err, messages) => {
    this.logger.info('Consumer callback');
    await this.checks(()=> {}, this.healthCheck);
    if (err) {
      this.logger.error(`Error while consumption - ${err}`);
      if (err.origin === 'local' && RECONNECTION_ERR_CODES.includes(err.code)) {
        this.logger.info('Reconnecting consumer');
        this.reconnect();
        return;
      }
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
    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.debug('initializing consumer', subscriptions);
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
        if (topics.length) {
          this.consumer.subscribe(topics);
          this.consumer.consume(1, this.consumeCallback);
        }
        resolve(this.consumer);
      });
    });
  }

  async createQueue({ topic }) {
    const task = this.registry.getTask(topic);
    return new Promise<void>((resolve, reject) => {
      if (!task) {
        reject(new Error('Task missing'));
      }
      const options = task?.attributes ?? {};
      this.adminClient.createTopic(
        {
          topic,
          num_partitions:
            options.num_partitions ??
            (this.config as KafkaConfiguration).defaultTopicParitions,
          replication_factor:
            options.replication_factor ??
            (this.config as KafkaConfiguration).defaultTopicReplicationFactor,
        },
        err => {
          if (err) {
            reject(err);
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
