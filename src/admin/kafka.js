// @flow

import Kafka from 'no-kafka';

import type { Configuration, IAdmin } from '../../types';

class KafkaAdmin implements IAdmin {
  config: Configuration;
  groupId: string;
  admin: Object;

  constructor(config: Configuration) {
    this.config = config;
  }

  async initialize() {
    this.admin = new Kafka.GroupAdmin({
      groupId: this.config.kafkaGroupId,
      clientId: this.config.clientId,
      connectionString: this.config.kafkaConnection,
      codec: this.config.kafkaCodec,
    });
    await this.admin.init();
  }

  lag(topicName: string, partitions: string) {
    return this.admin.fetchConsumerLag(this.config.kafkaGroupId, [{
      topicName,
      partitions,
    }]);
  }
}

export default KafkaAdmin;
