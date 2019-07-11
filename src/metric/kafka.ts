import * as Kafka from 'no-kafka';

import { Configuration, IMetric, Logger } from '../../types';

class KafkaMetric implements IMetric {
  config: Configuration;

  admin?: Kafka.GroupAdmin;

  logger: Logger;

  constructor(config: Configuration, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async initialize() {
    // @ts-ignore
    this.admin = new Kafka.GroupAdmin({
      groupId: this.config.kafkaGroupId,
      clientId: this.config.clientId,
      connectionString: this.config.kafkaConnection,
      codec: this.config.kafkaCodec,
    });
    // @ts-ignore
    await this.admin.init();
  }
}

export default KafkaMetric;
