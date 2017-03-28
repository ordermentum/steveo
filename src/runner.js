// @flow
import moment from 'moment';
import kafka from 'no-kafka';
import KafkaClient from './helpers/kafka';

import type { Config } from '../types';

const Runner = (config: Config, registry: Object, logger: Object) => {
  const kafkaClient = KafkaClient({
    kafkaConnection: config.kafkaConnection,
    kafkaCodec: config.kafkaCodec,
    clientId: config.clientId,
    logger: {
      logLevel: config.logLevel,
    },
    kafkaGroupId: config.kafkaGroupId,
  });

  const receive = (messageSet: Array<Object>, topic: string, partition: number) =>
    Promise.all(messageSet.map(async (m) => {
      try {
        logger.info(`
        *****CONSUME********
        topic:- ${topic}
        ********************
        payload:- ${m.message.value}
        ********************
      `);
        // commit offset
        await kafkaClient.consumer.commitOffset({ topic, partition, offset: m.offset, metadata: 'optional' });
        const task = registry[topic];
        await task.subscribe(JSON.parse(m.message.value.toString('utf8')));
      } catch (ex) {
        logger.error('Error while executing consumer callback ', ex);
      }
    }));

  const initializeConsumer = (subscriptions: Array<string>) => {
    logger.info('initializing consumer', subscriptions);

    return kafkaClient.consumer.init([{
      strategy: new kafka.WeightedRoundRobinAssignmentStrategy(),
      metadata: {
        weight: 4,
      },
      subscriptions,
      handler: receive,
    }]);
  };

  const initializeGroupAdmin = () => kafkaClient.admin.init();

  const initializeProducer = () => kafkaClient.producer.init();

  const producerPayload = (msg: Object, topic: string) => {
    const timestamp = moment().unix();

    return {
      timestamp,
      topic,
      message: { value: JSON.stringify(Object.assign({}, msg, { timestamp })) },
    };
  };

  const send = async (topic: string, payload: Object) => {
    logger.info('Message ', JSON.stringify(payload, null, 2), ' arrived on topic: ', topic);
    const data = producerPayload(payload, topic);
    logger.info('*****', data);
    const sendParams = {
      retries: {
        attempts: config.kafkaSendAttempts,
        delay: {
          min: config.kafkaSendDelayMin,
          max: config.kafkaSendDelayMax,
        },
      },
    };
    try {
      await kafkaClient.producer.send(data, sendParams);
      logger.info(`
        *****PRODUCE********
        topic:- ${topic}
        ********************
        payload:- ${JSON.stringify(payload)}
        ********************
      `);
    } catch (ex) {
      logger.error('Error while sending payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', ex);
    }
  };

  const fetchConsumerLag = (groupId: string, topicName: string, partitions: Array<number>) =>
    kafkaClient.admin.fetchConsumerLag(groupId, [{
      topicName,
      partitions,
    }]);

  return {
    send,
    receive,
    kafkaClient,
    initializeConsumer,
    initializeGroupAdmin,
    initializeProducer,
    fetchConsumerLag,
  };
};

export default Runner;
