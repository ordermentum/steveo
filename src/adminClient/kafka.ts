import { AdminClient } from 'node-rdkafka';
import { KafkaConfiguration } from '../common';

/**
Admin client is responsible for creating, deleting, and scaling out topics. 
*/
export default (config: KafkaConfiguration) =>
  AdminClient.create({
    'bootstrap.servers': config.bootstrapServers,
    ...config.admin,
  });
