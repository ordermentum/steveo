#!/usr/bin/env ts-node

import Steveo from 'steveo';
import crypto from 'crypto';
import { setTimeout } from 'timers/promises';

const TOPIC = 'EXAMPLE_TOPIC';

if (!process.env.KAFKA_BROKERS) {
  throw new Error('KAFKA_BROKERS environment variable is required');
}

const steveo = Steveo(
  {
    engine: 'kafka',
    producer: {
      global: {},
      topic: {
        partitioner: 'consistent',
        partitioner_cb(topic, key, partitionCount) {
          steveo.logger.info('Partitioner', { topic, key, partitionCount });
          return 0;
        },
      },
    },
    bootstrapServers: process.env.KAFKA_BROKERS,
    upperCaseNames: true,
    securityProtocol: 'plaintext',
  },
  console
);

let active = true;
process.on('SIGINT', async () => {
  active = false;
  await steveo.stop();
});

process.on('unhandledRejection', (reason, promise) => {
  steveo.logger.error('Unhandled Rejection', { reason, promise });
});

const run = async () => {
  steveo.logger.info('Registering topic', { topic: TOPIC });
  await steveo.registerTopic(TOPIC);
  while (active) {
    const id = crypto.randomUUID();
    await steveo.publish(TOPIC, {
      id,
      message: `Hello, World! ${Date.now()}`,
    });
    steveo.logger.info('Published message', { id });
    await setTimeout(500);
  }
};

run();
