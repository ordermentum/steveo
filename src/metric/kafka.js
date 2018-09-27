// @flow

import Kafka from 'no-kafka';

import type { Configuration, IMetric, Logger } from '../../types';

class KafkaMetric implements IMetric {
  config: Configuration;
  groupId: string;
  admin: Object;
  logger: Logger;

  constructor(config: Configuration, logger: Logger) {
    this.config = config;
    this.logger = logger;
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
}

export default KafkaMetric;
