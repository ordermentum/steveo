import logger from 'pino';
import Bluebird from 'bluebird';
import { expect } from 'chai';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { KafkaConfiguration, Steveo } from '../src';

const sleep = promisify(setTimeout);

describe('Steveo Integration Test', () => {
  it('gracefully shuts itself down when multiple steveo instances are running and are dependent on each other', async () => {
    const consumerGroupId = `steveo-integration-test-${randomUUID()}`;

    const kafkaConfiguration: KafkaConfiguration = {
      engine: 'kafka' as const,
      queuePrefix: `steveo`,
      shuffleQueue: false,
      bootstrapServers: '0.0.0.0:9092',
      defaultTopicReplicationFactor: 1,
      tasksPath: '.',
      securityProtocol: 'plaintext',
      consumer: {
        global: {
          'group.id': consumerGroupId,
        },
        topic: {},
      },
      producer: {
        global: {},
        topic: {},
      },
      waitToCommit: true,
      upperCaseNames: true,
      middleware: [],
    };

    const sqsConfiguration = {
      region: 'us-east-1',
      apiVersion: '2012-11-05',
      receiveMessageWaitTimeSeconds: '20',
      messageRetentionPeriod: '604800',
      engine: 'sqs' as const,
      queuePrefix: `steveo`,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'key',
      },
      shuffleQueue: false,
      endpoint: 'http://127.0.0.1:4566',
      maxNumberOfMessages: 1,
      workerConfig: {
        max: 2,
      },
      visibilityTimeout: 180,
      waitTimeSeconds: 2,
      consumerPollInterval: 500,
      upperCaseNames: true,
      middleware: [],
      tasksPath: '.',
    };

    const log = logger({ level: 'debug' });
    const sqs = new Steveo(sqsConfiguration, log.child({ engine: 'sqs' }));
    const kafka = new Steveo(
      kafkaConfiguration,
      log.child({ engine: 'kafka' })
    );
    const tasks = [randomUUID(), randomUUID(), randomUUID()];

    kafka.task('steveo_integration_noop_task', async () => {
      log.info('noop task');
    });

    /**
     * create a dependency between the two steveo instances
     */
    for (const task of tasks) {
      sqs.task(`steveo_integration_${task}`, async () =>
        kafka.publish('steveo_integration_noop_task', {})
      );
    }

    await Promise.all([
      sqs.runner().createQueues(),
      kafka.runner().createQueues(),
    ]);

    await Promise.all([sqs.start(), kafka.start()]);
    await kafka.producer.initialize();

    const iterations = 50;
    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await sqs.publish(`steveo_integration_${randomTask}`, {});
      },
      { concurrency: 50 }
    );

    sqs.runner().process();
    kafka.runner().process();

    let receivedProducerFailure = false;
    kafka.registry.events.on('producer_failure', () => {
      receivedProducerFailure = true;
    });

    let receivedTerminate = false;
    sqs.registry.events.on('terminate', () => {
      receivedTerminate = true;
    });

    await sleep(5000);

    await Promise.all([sqs.stop(), kafka.stop()]);

    await sleep(1000);

    expect(receivedProducerFailure).to.equal(false);
    expect(receivedTerminate).to.equal(true);
    expect(sqs.manager.state).to.equal('terminated');
    expect(kafka.manager.state).to.equal('terminated');
  });

  it('waits for the consumer pool to drain before shutting down completely', async () => {
    const consumerGroupId = `steveo-integration-test-${randomUUID()}`;

    const kafkaConfiguration: KafkaConfiguration = {
      engine: 'kafka' as const,
      queuePrefix: `steveo`,
      shuffleQueue: false,
      bootstrapServers: '0.0.0.0:9092',
      defaultTopicReplicationFactor: 1,
      tasksPath: '.',
      securityProtocol: 'plaintext',
      consumer: {
        global: {
          'group.id': consumerGroupId,
        },
        topic: {},
      },
      producer: {
        global: {},
        topic: {},
      },
      waitToCommit: true,
      upperCaseNames: true,
      middleware: [],
    };

    const sqsConfiguration = {
      region: 'us-east-1',
      apiVersion: '2012-11-05',
      receiveMessageWaitTimeSeconds: '20',
      messageRetentionPeriod: '604800',
      engine: 'sqs' as const,
      queuePrefix: `steveo`,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'key',
      },
      shuffleQueue: false,
      endpoint: 'http://127.0.0.1:4566',
      maxNumberOfMessages: 1,
      workerConfig: {
        max: 2,
      },
      visibilityTimeout: 180,
      waitTimeSeconds: 2,
      consumerPollInterval: 500,
      upperCaseNames: true,
      middleware: [],
      tasksPath: '.',
    };

    const log = logger({ level: 'debug' });
    const sqs = new Steveo(sqsConfiguration, log.child({ engine: 'sqs' }));
    const kafka = new Steveo(
      kafkaConfiguration,
      log.child({ engine: 'kafka' })
    );
    const tasks = [randomUUID(), randomUUID(), randomUUID()];

    kafka.task('steveo_integration_noop_task', async () => {
      log.info('noop task');
    });

    /**
     * create a dependency between the two steveo instances
     */
    for (const task of tasks) {
      sqs.task(`steveo_integration_${task}`, async () => {
        await sleep(5000); // simulate a long-running task
        await kafka.publish('steveo_integration_noop_task', {});
      });
    }

    await Promise.all([
      sqs.runner().createQueues(),
      kafka.runner().createQueues(),
    ]);

    await Promise.all([sqs.start(), kafka.start()]);
    await kafka.producer.initialize();

    const iterations = 3;
    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await sqs.publish(`steveo_integration_${randomTask}`, {});
      },
      { concurrency: 3 }
    );

    sqs.runner().process();
    kafka.runner().process();

    let receivedProducerFailure = false;
    kafka.registry.events.on('producer_failure', () => {
      receivedProducerFailure = true;
    });

    let receivedTerminate = false;
    sqs.registry.events.on('terminate', () => {
      receivedTerminate = true;
    });

    await sleep(3000);

    await Promise.all([sqs.stop(), kafka.stop()]);

    await sleep(1000);

    expect(receivedProducerFailure).to.equal(false);
    expect(receivedTerminate).to.equal(true);
    expect(sqs.manager.state).to.equal('terminated');
    expect(kafka.manager.state).to.equal('terminated');
  });
});
