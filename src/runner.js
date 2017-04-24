// @flow
import Kafka from 'no-kafka';
import Config from './config';
import type { Reg } from '../types';

const Runner = (config: Config, registry: Reg, logger: Object) => {
  const consumer = new Kafka.GroupConsumer({
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
      let params = null;
      try {
        // commit offset
        params = JSON.parse(m.message.value.toString('utf8'));
        registry.events.emit('runner_receive', topic, params);
        await consumer.commitOffset({ topic, partition, offset: m.offset, metadata: 'optional' }); // eslint-disable-line
        const task = registry.getTask(topic);
        await task.subscribe(params); // eslint-disable-line
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
