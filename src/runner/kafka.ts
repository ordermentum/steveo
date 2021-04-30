import nullLogger from 'null-logger';
import Kafka, { KafkaConsumer, Message } from 'node-rdkafka';
import BaseRunner from '../base/base_runner';
import { getDuration } from './utils';
import {
  Hooks,
  IRunner,
  Pool,
  Logger,
  IRegistry,
  KafkaConfiguration,
} from '../common';

class KafkaRunner extends BaseRunner
  implements IRunner<KafkaConsumer, Message> {
  config: KafkaConfiguration;

  logger: Logger;

  registry: IRegistry;

  consumer: KafkaConsumer;

  pool: Pool;

  constructor(
    config: KafkaConfiguration,
    registry: IRegistry,
    pool: Pool,
    logger: Logger = nullLogger,
    hooks: Hooks = {}
  ) {
    super(hooks);
    this.config = config;
    this.registry = registry;
    this.logger = logger;
    this.pool = pool;

    this.consumer = new Kafka.KafkaConsumer(
      {
        'bootstrap.servers': this.config.bootstrapServers,
        ...(this.config.consumer?.global ?? {}),
      },
      this.config.consumer?.topic ?? {}
    );
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
        this.consumer.commitMessageSync(message);
        return;
      }

      if (!this.config.waitToCommit) {
        this.consumer.commitMessageSync(message);
      }
      this.logger.debug('Start subscribe', topic, message);
      await task.subscribe(message);
      if (this.config.waitToCommit) {
        this.consumer.commitMessageSync(message);
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
    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    })
    console.log('🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐🚐 ');
    console.log(':', );
  };

  process(topics: Array<string>) {
    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.debug('initializing consumer', subscriptions);
    return new Promise<KafkaConsumer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.error('Connection timed out');
        reject();
      }, this.config.connectionTimeout!);
      this.consumer.connect({}, err => {
        clearTimeout(timeoutId);
        if (err) {
          this.logger.error('Error initializing consumer', err);
          reject();
        }
      });
      this.consumer.on('data', this.receive);
      this.consumer.on('disconnected', () => {
        this.logger.debug('Consumer disconnected');
      });
      this.consumer.on('event.error', err => {
        this.logger.error('Error from consumer', err);
      });
      this.consumer.on('ready', () => {
        console.log('📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙📙');
        console.log(':', topics);
        clearTimeout(timeoutId);
        this.consumer.subscribe(topics);
        this.logger.info('Consumer ready', this.consumer.getMetadata());
        this.consumer.consume();
        resolve(this.consumer);
      });
    });
  }

  async disconnect() {
    this.consumer?.disconnect();
  }
}

export default KafkaRunner;
