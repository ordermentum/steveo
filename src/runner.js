// @flow
import Kafka from 'no-kafka';
import type { Reg, Configuration, Consumer } from '../types';

const Runner = (config: Configuration, registry: Reg, logger: Object) => {
  const consumer: Consumer = new Kafka.GroupConsumer({
    groupId: config.kafkaGroupId,
    clientId: config.clientId,
    connectionString: config.kafkaConnection,
    codec: config.kafkaCodec,
    logger: {
      logLevel: config.logLevel,
    },
  });

  const receive = async (messages: Array<Object>, topic: string, partition: number) => {
    for (const m of messages) { // eslint-disable-line
      let params: Object = {};
      try {
        // commit offset
        params = JSON.parse(m.message.value.toString('utf8'));
        registry.events.emit('runner_receive', topic, params);
        logger.info('commit offset', topic, params);
        await consumer.commitOffset({ topic, partition, offset: m.offset, metadata: 'optional' }); // eslint-disable-line
        const task = registry.getTask(topic);
        logger.info('start subscribe call', topic, params);
        await task.subscribe(params); // eslint-disable-line
        logger.info('subscribe call finished', topic);
        registry.events.emit('runner_complete', topic, params);
      } catch (ex) {
        logger.error('Error while executing consumer callback ', { params, topic, error: ex });
        registry.events.emit('runner_failure', topic, ex, params);
      }
    }
  };

  const process = () => {
    const subscriptions = registry.getTopics();
    logger.info('initializing consumer', subscriptions);
    return consumer.init([{
      subscriptions,
      handler: receive,
    }]);
  };

  return {
    process,
    consumer,
    receive,
  };
};

export default Runner;
