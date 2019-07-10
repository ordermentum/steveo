import nullLogger from 'null-logger';
import Kafka from 'no-kafka';
import BaseRunner from '../base/base_runner';
import {
  Hooks,
  IRunner,
  Pool,
  Configuration,
  Logger,
  Consumer,
  IRegistry,
} from '../../types';

class KafkaRunner extends BaseRunner implements IRunner {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  consumer: Consumer;

  pool: Pool;

  constructor(
    config: Configuration,
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

    this.consumer = new Kafka.GroupConsumer({
      groupId: config.kafkaGroupId,
      clientId: config.clientId,
      connectionString: config.kafkaConnection,
      codec: config.kafkaCodec,
      logger: {
        logLevel: config.logLevel,
      },
    });
  }

  receive = async (messages: any[], topic: string, partition: string) => {
    for (const m of messages) {
      // eslint-disable-line no-restricted-syntax
      let params: Object = {};
      try {
        // commit offset
        params = JSON.parse(m.message.value.toString('utf8'));

        this.registry.events.emit('runner_receive', topic, params);
        await this.consumer.commitOffset({ topic, partition, offset: m.offset, metadata: 'optional' }); // eslint-disable-line
        const task = this.registry.getTask(topic);
        this.logger.debug('Start subscribe', topic, params);
        await task.subscribe(params); // eslint-disable-line
        this.logger.debug('Finish subscribe', topic, params);
        this.registry.events.emit('runner_complete', topic, params);
      } catch (ex) {
        this.logger.error('Error while executing consumer callback ', {
          params,
          topic,
          error: ex,
        });
        this.registry.events.emit('runner_failure', topic, ex, params);
      }
    }
  };

  process(topics: Array<string>) {
    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.debug('initializing consumer', subscriptions);
    return this.consumer.init([
      {
        subscriptions,
        handler: this.receive,
      },
    ]);
  }
}

export default KafkaRunner;
