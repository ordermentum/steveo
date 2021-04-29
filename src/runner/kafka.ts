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

    this.consumer.on('event.error', function(err) {
      this.log.error('Error from consumer', err);
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
        this.consumer.commit(message);
        return;
      }

      if (!this.config.waitToCommit) {
        this.consumer.commit(message);
      }
      this.logger.debug('Start subscribe', topic, message);
      await task.subscribe(message);
      if (this.config.waitToCommit) {
        this.consumer.commit(message);
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

  process(topics: Array<string>) {
    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.debug('initializing consumer', subscriptions);
    return new Promise<KafkaConsumer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.error('Connection timed out');
        return reject();
      }, this.config.connectionTimeout!);
      this.consumer.connect({}, err => {
        clearTimeout(timeoutId);
        if (err) {
          this.logger.error('Error initializing consumer');
          return reject();
        }
        this.logger.debug('Consumer ready');
        this.consumer.subscribe(topics);
        this.consumer.consume();
        this.consumer.on('data', this.receive);
        this.consumer.on('disconnected', () => {
          this.logger.debug('Consumer disconnected');
        });
        return resolve(this.consumer);
      });
    });
  }
}

export default KafkaRunner;
