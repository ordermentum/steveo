// @flow
import Kafka from 'no-kafka';
import Config from './config';

const Admin = (config: Config) => {
  const lag = async (groupId: string,
    topicName: string, partitions: Array<number>) => {
    const admin: Object = new Kafka.GroupAdmin({
      groupId: config.kafkaGroupId,
      clientId: config.clientId,
      connectionString: config.kafkaConnection,
      codec: config.kafkaCodec,
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
