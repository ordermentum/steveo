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
      consumerPollInterval: 1000,
      upperCaseNames: true,
    };
    const steveo = new Steveo(configuration, logger({ level: 'debug' }));
    const tasks = ['one', 'two', 'three'];

    const iterations = 100;

    for (const task of tasks) {
      steveo.task(`steveo_${task}`, async () => {
        await sleep(10);
      });
    }

    await Bluebird.map(
      Array(iterations).fill(0),
      async () => {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await steveo.publish(`steveo_${randomTask}`, {});
      },
      { concurrency: 100 }
    );

    const loops = iterations / tasks.length;
    let loop = 0;
    await steveo.runner().process();
    while (loop < loops) {
      await sleep(500);
      loop += 1;
    }

    await steveo.terminate();
    expect(steveo.registry.getTopics()).to.have.lengthOf(tasks.length);
  });
});
