import { expect } from 'chai';
import sinon from 'sinon';
import { promisify } from 'util';
import Bluebird from 'bluebird';
import logger from 'pino';
import { Steveo } from '../../src';

const sleep = promisify(setTimeout);

describe('Integration Test', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('concurrent tasks (pool) (sqs)', async () => {
    const configuration = {
      engine: 'redis' as const,
      queuePrefix: `steveo`,
      shuffleQueue: false,
      redisHost: process.env.REDIS_HOST || '127.0.0.1',
      redisPort: 6379,
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
    await steveo?.runner()?.createQueues();

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
    await sleep(1000);
    await steveo.stop();
    await sleep(2000);

    expect(steveo.manager.state).to.equal('terminated');
  });
});
