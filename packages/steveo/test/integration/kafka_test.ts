import {expect} from 'chai';
import sinon from 'sinon';
import {promisify} from 'util';
import Bluebird from 'bluebird';
import logger from 'pino';
import {KafkaConfiguration, Steveo} from '../../src';

const sleep = promisify(setTimeout);

describe('Kafka Integration Test', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('processes messages concurrently (pool) (kafka)', async () => {
    const consumerGroupId = 'steveo-integration-test';

    const configuration: KafkaConfiguration = {
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
    const log = logger({level: 'debug'});
    const steveo = new Steveo(configuration, log);
    const tasks = ['one', 'two', 'three'];

    for (const task of tasks) {
      steveo.task(`steveo_integration_${task}`, async () => Promise.resolve());
    }

    await steveo
      ?.runner()
      .createQueues()
      .catch(e => {
        log.error('Error creating queues', e);
      });

    await steveo.start();
    await steveo.producer.initialize();

    const iterations = 50;
    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await steveo.publish(`steveo_integration_${randomTask}`, {});
      },
      {concurrency: 50}
    );

    steveo.runner().process();
    // we want to trigger at least one loop
    await sleep(1000);
    await steveo.stop();
    await sleep(1000);

    expect(steveo.manager.state).to.equal('terminated');
  });

  it('can gracefully shutdown when processing messages that publish concurrently (pool) (kafka)', async () => {
    const consumerGroupId = 'steveo-integration-test';

    const configuration: KafkaConfiguration = {
      engine: 'kafka' as const,
      queuePrefix: `steveo_kafka_integration`,
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
    const log = logger({level: 'debug'});
    const steveo = new Steveo(configuration, log);
    const tasks = ['one', 'two', 'three'];

    const noopTask = steveo.task('steveo_integration_noop_task', async () => {
      log.info('noop task');
      return;
    });

    for (const task of tasks) {
      steveo.task(`steveo_integration_${task}`, async () => noopTask.publish({}));
    }

    await steveo
      ?.runner()
      .createQueues()
      .catch(e => {
        log.error('Error creating queues', e);
      });

    await steveo.start();
    await steveo.producer.initialize();

    const iterations = 50;
    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await steveo.publish(`steveo_integration_${randomTask}`, {});
      },
      {concurrency: 50}
    );

    let receivedProducerFailure = false;
    steveo.registry.events.on('producer_failure', () => {
      receivedProducerFailure = true;
    });

    steveo.runner().process();
    // we want to trigger at least one loop
    await sleep(1000);
    await steveo.stop();
    await sleep(1000);

    expect(receivedProducerFailure).to.be.false;
    expect(steveo.manager.state).to.equal('terminated');
  });
});
