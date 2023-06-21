import { expect } from 'chai';
import sinon from 'sinon';
import { promisify } from 'util';
import Bluebird from 'bluebird';
import logger from 'pino';
import { Steveo } from '../../src';

const sleep = promisify(setTimeout);

describe('SQS Integration Test', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('concurrent tasks (pool) (sqs)', async () => {
    const configuration = {
      region: 'us-east-1',
      apiVersion: '2012-11-05',
      receiveMessageWaitTimeSeconds: '20',
      messageRetentionPeriod: '604800',
      engine: 'sqs' as const,
      queuePrefix: `steveo`,
      accessKeyId: 'test',
      secretAccessKey: 'key',
      shuffleQueue: false,
      endpoint: 'http://localhost:4566',
      maxNumberOfMessages: 1,
      workerConfig: {
        max: 2,
      },
      visibilityTimeout: 180,
      waitTimeSeconds: 2,
      consumerPollInterval: 500,
      upperCaseNames: true,
    };
    const steveo = new Steveo(configuration, logger({ level: 'debug' }));
    const tasks = ['one', 'two', 'three'];

    for (const task of tasks) {
      steveo.task(`steveo_${task}`, async () => Promise.resolve());
    }
    await steveo?.runner().createQueues();

    const iterations = 1000;
    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await steveo.publish(`steveo_${randomTask}`, {});
      },
      { concurrency: 100 }
    );

    steveo.runner().process();
    // we want to trigger at least one loop
    await sleep(2000);
    await steveo.stop();
    await sleep(1000);

    expect(steveo.manager.state).to.equal('terminated');
  });
});
