import Kafka from 'no-kafka';

class KafkaAdmin {
  constructor(config, groupId, topic, partitions) {
    this.config = config;
    this.groupId = groupId;
    this.partitions = partitions;
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

  lag() {
    return this.admin.fetchConsumerLag(this.groupId, [{
      topicName: this.topicName,
      partitions: this.partitions,
    }]);
  }
}

export default KafkaAdmin;
