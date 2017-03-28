// @flow
import Kafka from 'no-kafka';

import type { KafkaParams } from '../../types';

const KafkaClient = (params: KafkaParams) => {
  const admin = new Kafka.GroupAdmin({
    groupId: params.kafkaGroupId,
    clientId: params.clientId,
    connectionString: params.kafkaConnection,
    codec: params.kafkaCodec,
  });


  const consumer = new Kafka.GroupConsumer({
    groupId: params.kafkaGroupId,
    clientId: params.clientId,
    connectionString: params.kafkaConnection,
    codec: params.kafkaCodec,
    logger: params.logger,
  });

  const producer = new Kafka.Producer({
    connectionString: params.kafkaConnection,
    codec: params.kafkaCodec,
  });

  return {
    producer,
    consumer,
    admin,
  };
};

export default KafkaClient;
