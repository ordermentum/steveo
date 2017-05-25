// @flow
import Kafka from 'no-kafka';
import { memoryUsage, abort } from 'process';
import type { Reg, Configuration, Consumer } from '../types';

const maxRss = process.env.STEVEO_MAX_RSS && parseInt(process.env.STEVEO_MAX_RSS);

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
    for (const m of messages) { // eslint-disable-line no-restricted-syntax
      let params: Object = {};
      const currentRss = memoryUsage().rss;
      try {
        if ( maxRss ) {
          if (currentRss > maxRss) {
            logger.error(`Steveo - Memory ${currentRss} is above max ${maxRss}. Killing the process`);
            abort();
          }
        };
        // commit offset
        params = JSON.parse(m.message.value.toString('utf8'));
        registry.events.emit('runner_receive', topic, params);
        logger.info('Current rss memory:', currentRss);
        logger.info('Commit offset', topic, params);
        await consumer.commitOffset({ topic, partition, offset: m.offset, metadata: 'optional' }); // eslint-disable-line
        const task = registry.getTask(topic);
        logger.info('Start subscribe', topic, params);
        await task.subscribe(params); // eslint-disable-line
        logger.info('Finish subscribe', topic, params);
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
