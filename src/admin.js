// @flow
import KafkaClient from './helpers/kafka';

import type { Config } from '../types';

const Admin = (config: Config) => {
  const lag = async (groupId: string,
    topicName: string, partitions: Array<number>) => {
    const { admin } = await KafkaClient({
      kafkaConnection: config.kafkaConnection,
      kafkaCodec: config.kafkaCodec,
      clientId: config.clientId,
      logger: {
        logLevel: config.logLevel,
      },
      kafkaGroupId: config.kafkaGroupId,
    });
    await admin.init();
    return admin.fetchConsumerLag(groupId, [{
      topicName,
      partitions,
    }]);
  };

  return {
    lag,
  };
};

export default Admin;
