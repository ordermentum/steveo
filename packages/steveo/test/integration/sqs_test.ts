import { expect } from 'chai';
import crypto from 'crypto';
import sinon from 'sinon';
import { promisify } from 'util';
import Bluebird from 'bluebird';
import logger from 'pino';
import { Middleware, Steveo } from '../../src';

const sleep = promisify(setTimeout);

class PayloadMiddleware implements Middleware {
  seen: Set<string>;

  constructor() {
    this.seen = new Set<string>();
  }

  async publish(context, next) {
    const { payload } = context;
    const data = {
      ...(payload ?? {}),
      payloadSignature: crypto
        .createHash('sha1')
        .update(JSON.stringify(payload))
        .digest('hex'),
    };
    context.payload = data;
    return next();
  }

  async consume(context, next) {
    const data = context?.payload ?? {};
    if (data.payloadSignature) this.seen.add(data.payloadSignature);
    return next();
  }
}

describe('SQS Integration Test', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('processes messages concurrently (pool) (sqs)', async () => {
    const middleware = new PayloadMiddleware();
    const configuration = {
      region: 'us-east-1',
      apiVersion: '2012-11-05',
      receiveMessageWaitTimeSeconds: '20',
      messageRetentionPeriod: '604800',
      engine: 'sqs' as const,
      queuePrefix: `steveo_sqs_integration`,
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
      middleware: [middleware],
    };
    const steveo = new Steveo(configuration, logger({ level: 'debug' }));
    const tasks = ['one', 'two', 'three'];

    for (const task of tasks) {
      steveo.task(`steveo_integration_${task}`, async () => Promise.resolve());
    }

    await steveo?.runner().createQueues();

    const iterations = 50;
    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await steveo.publish(`steveo_integration_${randomTask}`, {});
      },
      { concurrency: 50 }
    );

    let receivedTerminate = false;
    steveo.registry.events.on('terminate', () => {
      receivedTerminate = true;
    });

    steveo.runner().process();
    // we want to trigger at least one loop
    await sleep(1000);
    await steveo.stop();

    // Make sure stop() blocks before it properly shuts down
    expect(receivedTerminate).to.be.true;
    await sleep(1000);
    expect(middleware.seen.size).to.be.greaterThan(0);

    expect(steveo.manager.state).to.equal('terminated');
  });

  it('can gracefully shutdown when processing messages that publish concurrently (pool) (sqs)', async () => {
    const middleware = new PayloadMiddleware();
    const configuration = {
      region: 'us-east-1',
      apiVersion: '2012-11-05',
      receiveMessageWaitTimeSeconds: '20',
      messageRetentionPeriod: '604800',
      engine: 'sqs' as const,
      queuePrefix: `steveo_sqs_integration`,
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
      middleware: [middleware],
    };

    const log = logger({ level: 'debug' });
    const steveo = new Steveo(configuration, log);

    const noopTask = steveo.task('steveo_integration_noop_task', async () => {
      log.info('noop task');
      return;
    });

    const tasks = ['one', 'two', 'three'];

    for (const task of tasks) {
      steveo.task(`steveo_integration_${task}`, async () => noopTask.publish({}));
    }

    await steveo?.runner().createQueues();

    const iterations = 50;
    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await steveo.publish(`steveo_integration_${randomTask}`, {});
      },
      { concurrency: 50 }
    );

    let receivedTerminate = false;
    steveo.registry.events.on('terminate', () => {
      receivedTerminate = true;
    });

    let receivedProducerFailure = false;
    steveo.registry.events.on('producer_failure', () => {
      receivedProducerFailure = true;
    });

    steveo.runner().process();
    // we want to trigger at least one loop
    await sleep(1000);
    await steveo.stop();

    expect(receivedProducerFailure).to.be.false;
    expect(receivedTerminate).to.be.true;
    await sleep(1000);
    expect(middleware.seen.size).to.be.greaterThan(0);

    expect(steveo.manager.state).to.equal('terminated');
  });

});
