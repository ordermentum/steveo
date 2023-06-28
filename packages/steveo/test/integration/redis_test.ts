import { expect } from 'chai';
import sinon from 'sinon';
import { promisify } from 'util';
import Bluebird from 'bluebird';
import logger, { Logger } from 'pino';
import { Middleware, Steveo } from '../../src';

const sleep = promisify(setTimeout);

class SampleMiddleware implements Middleware {
  consumed: number = 0;

  published: number = 0;

  logger: Logger;

  constructor() {
    this.logger = logger({ level: 'debug' });
  }

  async consume(_context, next) {
    this.consumed += 1;
    this.logger.info(`called consume`);
    return next();
  }

  async publish(_context, next) {
    this.published += 1;
    this.logger.info(`called publish`);
    return next();
  }
}

describe('Integration Test', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('concurrent tasks (pool) (redis)', async () => {
    const sample = new SampleMiddleware();

    const log = logger({ level: 'debug' });
    const configuration = {
      engine: 'redis' as const,
      queuePrefix: `steveo`,
      shuffleQueue: false,
      redisHost: process.env.REDIS_HOST || '127.0.0.1',
      redisPort: process.env.REDIS_PORT || 6379,
      maxNumberOfMessages: 1,
      workerConfig: {
        max: 2,
      },
      visibilityTimeout: 180,
      waitTimeSeconds: 2,
      consumerPollInterval: 500,
      upperCaseNames: true,
      middleware: [sample],
    };

    const steveo = new Steveo(configuration, log);
    const tasks = ['one', 'two', 'three'];

    for (const task of tasks) {
      steveo.task(`steveo_integration_${task}`, async () => Promise.resolve());
    }
    await steveo?.runner()?.createQueues();

    const iterations = 50;
    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await steveo.publish(`steveo_integration_${randomTask}`, {});
      },
      { concurrency: 50 }
    );

    steveo.runner().process();
    // we want to trigger at least one loop
    await sleep(1000);
    await steveo.stop();
    await sleep(2000);

    expect(steveo.manager.state).to.equal('terminated');
    expect(sample.consumed).be.greaterThan(0);
    expect(sample.published).be.greaterThan(0);
  });
});
