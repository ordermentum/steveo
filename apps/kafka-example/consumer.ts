#!/usr/bin/env ts-node

import Steveo from 'steveo';
import path from 'path';

const TOPIC = 'EXAMPLE_TOPIC';

if (!process.env.KAFKA_BROKERS) {
  throw new Error('KAFKA_BROKERS environment variable is required');
}

const steveo = Steveo(
  {
    engine: 'kafka',
    consumer: {
      global: {
        'group.id': 'example-consumer-group',
      },
      topic: {},
    },
    bootstrapServers: process.env.KAFKA_BROKERS,
    upperCaseNames: true,
    securityProtocol: 'plaintext',
    tasksPath: path.resolve(__dirname, './tasksPathIsRequired'),
  },
  console
);

process.on('unhandledRejection', (reason, promise) => {
  steveo.logger.error('Unhandled Rejection', { reason, promise });
});

steveo.task(
  TOPIC,
  async message => {
    steveo.logger.info('Received message', message);
  },
  { num_partitions: 8 }
);

steveo.start().then(() => {
  steveo.logger.info('Consumer started');
});
