// @flow
import Kafka from 'no-kafka';

import type { Config } from '../types';

const Admin = (config: Config) => {
  const lag = async (topicName: string, partitions: Array<number>) => {
    const admin = new Kafka.GroupAdmin({
      groupId: config.kafkaGroupId,
      clientId: config.clientId,
      connectionString: config.kafkaConnection,
      codec: config.kafkaCodec,
    });
    await admin.init();
    return admin.fetchConsumerLag(config.kafkaGroupId, [{
      topicName,
      partitions,
    }]);
  };

  return {
    lag,
  };
};

export default Admin;
