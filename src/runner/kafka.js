// @flow
import Kafka from 'no-kafka';
import BaseRunner from '../base/base_runner';
import type { IRunner, Configuration, Logger, Consumer, IRegistry } from '../../types';

class KafkaRunner extends BaseRunner implements IRunner {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  consumer: Consumer;

  constructor(config: Configuration, registry: IRegistry, logger: Logger) {
    super();
    this.config = config;
    this.registry = registry;
    this.logger = logger;

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

  receive = async (messages: Array<Object>, topic: string, partition: string) => {
    for (const m of messages) { // eslint-disable-line no-restricted-syntax
      let params: Object = {};
      try {
        // commit offset
        params = JSON.parse(m.message.value.toString('utf8'));

        this.registry.events.emit('runner_receive', topic, params);
        await this.consumer.commitOffset({ topic, partition, offset: m.offset, metadata: 'optional' }); // eslint-disable-line
        const task = this.registry.getTask(topic);
        this.logger.info('Start subscribe', topic, params);
        await task.subscribe(params); // eslint-disable-line
        this.logger.info('Finish subscribe', topic, params);
        this.registry.events.emit('runner_complete', topic, params);
      } catch (ex) {
        this.logger.error('Error while executing consumer callback ', { params, topic, error: ex });
        this.registry.events.emit('runner_failure', topic, ex, params);
      }
    }
  }

  process(topics: Array<string>) {
    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.info('initializing consumer', subscriptions);
    return this.consumer.init([{
      subscriptions,
      handler: this.receive,
    }]);
  }
}

export default KafkaRunner;
