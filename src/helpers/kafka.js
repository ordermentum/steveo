// @flow
import Kafka from 'no-kafka';
import uuid from 'uuid';

import type { KafkaParams } from '../../types';

const KafkaClient = (params: KafkaParams) => {
  const producer = new Kafka.Producer({
    connectionString: params.kafkaConnection,
    codec: params.kafkaCodec,
  });

  const consumer = new Kafka.GroupConsumer({
    groupId: params.kafkaGroupId,
    clientId: params.clientId || uuid.v4(),
    connectionString: params.kafkaConnection,
    codec: params.kafkaCodec,
    logger: params.logger,
  });

  const admin = new Kafka.GroupAdmin({
    groupId: params.kafkaGroupId,
    clientId: params.clientId || uuid.v4(),
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
