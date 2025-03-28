import { expect } from 'chai';
import sinon from 'sinon';

import logger from 'pino';
import { v4 } from 'uuid';
import { randomUUID } from 'crypto';
import Runner from '../../src/consumers/sqs';
import { build } from '../../src/lib/pool';
import Registry from '../../src/runtime/registry';
import { Steveo } from '../../src';
import {
  DummyConfiguration,
  IRegistry,
  SQSConfiguration,
} from '../../src/common';

interface MockRegistryOptions {
  subscribeStub?: sinon.SinonStub;
  fifo?: boolean;
  waitToCommit?: boolean;
  emitStub?: sinon.SinonStub;
}

function createMockRegistry(
  sandbox: sinon.SinonSandbox,
  options: MockRegistryOptions = {}
): IRegistry {
  const {
    subscribeStub = sandbox.stub().resolves({ some: 'success' }),
    fifo = false,
    waitToCommit = false,
    emitStub = sandbox.stub(),
  } = options;

  const taskOptions: Record<string, unknown> = {};

  if (fifo) {
    taskOptions.fifo = true;
  }

  if (waitToCommit) {
    taskOptions.waitToCommit = true;
  }

  const task: Record<string, unknown> = {
    publish: sandbox.stub(),
    subscribe: subscribeStub,
  };

  if (Object.keys(taskOptions).length > 0) {
    task.options = taskOptions;
  }

  return {
    registeredTasks: {},
    items: new Map(),
    heartbeat: 0,
    addNewTask: sandbox.stub(),
    removeTask: sandbox.stub(),
    getTopics: sandbox.stub().returns([]),
    getTaskTopics: sandbox.stub().returns([]),
    getTopic: sandbox.stub().callsFake(name => name),
    addTopic: sandbox.stub(),
    getTask: sandbox.stub().returns(task),
    emit: emitStub,
    events: {
      emit: emitStub,
      on: sandbox.stub(),
    },
  };
}

function createSQSConfig(): SQSConfiguration {
  return {
    engine: 'sqs' as const,
    apiVersion: '2012-11-05',
    messageRetentionPeriod: '345600', // 4 days
    receiveMessageWaitTimeSeconds: '20',
    maxNumberOfMessages: 10,
    visibilityTimeout: 30,
    waitTimeSeconds: 20,
  };
}

function createSteveoInstance(
  registry: IRegistry,
  config: SQSConfiguration | DummyConfiguration = createSQSConfig()
): Steveo {
  const log = logger({ level: 'debug' });
  const steveo = new Steveo(config, log);
  steveo.registry = registry;
  steveo.pool = build(registry);

  return steveo;
}

describe('runner/sqs', () => {
  let runner: Runner;
  let registry: Registry;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers({
      now: 0,
      shouldAdvanceTime: true,
    });
    registry = new Registry();

    const steveo = {
      config: {},
      registry,
      pool: build(registry),
    };
    // @ts-expect-error - Steveo type doesn't expose registry property
    runner = new Runner(steveo);
  });

  afterEach(() => {
    sandbox.restore();
    clock.restore();
  });

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.process).to.equal('function');
  });

  it('should create queue with fifo suffix if enabled', async () => {
    // Create a registry with fifo enabled
    const registry = createMockRegistry(sandbox, { fifo: true });
    const steveo = createSteveoInstance(registry);
    const runner = new Runner(steveo);

    // Stub the createQueue method
    const createQueueStub = sandbox.stub(runner.sqs, 'createQueue').resolves();

    await runner.createQueue('a-topic');

    expect(createQueueStub.called).to.equal(true);

    const createQueueArgs = createQueueStub.args[0][0] as { QueueName: string };
    expect(createQueueArgs.QueueName, 'should have fifo suffix').to.eqls(
      'a-topic.fifo'
    );
  });

  it('should invoke callback when receives a message on topic', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const registry = createMockRegistry(sandbox, { subscribeStub });
    const steveo = createSteveoInstance(registry);
    const runner = new Runner(steveo);

    // Stub the deleteMessage method
    const deleteMessageStub = sandbox
      .stub(runner.sqs, 'deleteMessage')
      .resolves();

    await runner.receive(
      [
        { ReceiptHandle: v4(), Body: JSON.stringify({ data: 'Hello' }) },
        { ReceiptHandle: v4(), Body: JSON.stringify({ data: 'World' }) },
      ],
      'a-topic'
    );

    expect(subscribeStub.callCount, 'subscribe is called twice').to.equal(2);
    expect(
      deleteMessageStub.callCount,
      'deleteMessage is called twice'
    ).to.equal(2);
  });

  it('should invoke callback with context if context is present in message body', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const registry = createMockRegistry(sandbox, { subscribeStub });
    const steveo = createSteveoInstance(registry);
    const runner = new Runner(steveo);

    sandbox.stub(runner.sqs, 'deleteMessage').resolves();

    const inputContext = { contextKey: 'contextValue' };
    const messageBody = { data: 'Hello', _meta: inputContext };
    await runner.receive(
      [
        {
          ReceiptHandle: v4(),
          Body: JSON.stringify(messageBody),
        },
      ],
      'a-topic'
    );

    const expectedContext = {
      duration: 0,
      ...inputContext,
    };

    sinon.assert.calledWith(subscribeStub, { data: 'Hello' }, expectedContext);
  });

  it('should delete message if waitToCommit is true after processing', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const registry = createMockRegistry(sandbox, {
      subscribeStub,
      waitToCommit: true,
    });
    const steveo = createSteveoInstance(registry);
    const runner = new Runner(steveo);

    // Stub the deleteMessage method
    const deleteMessageStub = sandbox
      .stub(runner.sqs, 'deleteMessage')
      .resolves();

    await runner.receive(
      [
        { ReceiptHandle: v4(), Body: JSON.stringify({ data: 'Hello' }) },
        { ReceiptHandle: v4(), Body: JSON.stringify({ data: 'World' }) },
      ],
      'a-topic'
    );

    expect(subscribeStub.callCount, 'subscribe is called twice').to.equal(2);
    expect(
      deleteMessageStub.callCount,
      'deleteMessage is called twice'
    ).to.equal(2);
  });

  it('should delete message using the FIFO QueueUrl if enabled in task', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const registry = createMockRegistry(sandbox, {
      subscribeStub,
      fifo: true,
    });
    const steveo = createSteveoInstance(registry);
    const runner = new Runner(steveo);

    // Stub the deleteMessage method
    const deleteMessageStub = sandbox
      .stub(runner.sqs, 'deleteMessage')
      .resolves({});

    const randomId = randomUUID();
    sandbox.stub(runner.sqs, 'getQueueUrl').resolves({
      QueueUrl: `https://ap-southeast2.aws.com/${randomId}/a-topic.fifo`,
    });

    const url: string = await runner.getQueueUrl('a-topic');

    await runner.receive(
      [
        { ReceiptHandle: v4(), Body: JSON.stringify({ data: 'Hello' }) },
        { ReceiptHandle: v4(), Body: JSON.stringify({ data: 'World' }) },
      ],
      'a-topic'
    );

    expect(subscribeStub.callCount, 'subscribe is called twice').to.equal(2);

    expect(
      deleteMessageStub.args[0][0].QueueUrl,
      'FIFO should be automatically appended if the task config has it'
    ).to.eqls(url);
  });

  it('get all urls for queues', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const registry = createMockRegistry(sandbox, { subscribeStub });

    // Use a different config for this test
    const config = {
      engine: 'dummy' as const,
    };
    const steveo = createSteveoInstance(registry, config);
    const runner = new Runner(steveo);

    const getQueueUrlAsyncStub = sandbox
      .stub(runner.sqs, 'getQueueUrl')
      .resolves({ QueueUrl: 'https://ap-southeast2.aws.com' });

    expect(runner.sqsUrls).to.deep.equal({});
    await runner.getQueueUrl('test');
    expect(runner.sqsUrls).to.deep.equal({
      test: 'https://ap-southeast2.aws.com',
    });
    await runner.getQueueUrl('test');
    expect(getQueueUrlAsyncStub.calledOnce).to.equal(true);
  });

  it('continues to work if queue does not exist', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const registry = createMockRegistry(sandbox, { subscribeStub });

    // Use a different config for this test
    const config = {
      engine: 'dummy' as const,
    };
    const steveo = createSteveoInstance(registry, config);
    const runner = new Runner(steveo);

    const getQueueUrlAsyncStub = sandbox
      .stub(runner.sqs, 'getQueueUrl')
      .rejects(new Error());

    expect(runner.sqsUrls).to.deep.equal({});
    await runner.getQueueUrl('test');
    expect(runner.sqsUrls).to.deep.equal({});
    await runner.getQueueUrl('test');
    expect(getQueueUrlAsyncStub.callCount).to.equal(2);
  });

  describe('process', () => {
    it('terminates', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });
      const registry = createMockRegistry(sandbox, {
        subscribeStub,
      });

      // Override getTopics and getTaskTopics for this test
      registry.getTopics = sandbox.stub().returns(['test']);
      registry.getTaskTopics = sandbox.stub().returns(['test']);

      // Use a different config for this test
      const config = {
        engine: 'dummy' as const,
      };
      const steveo = createSteveoInstance(registry, config);
      const runner = new Runner(steveo);

      runner.state = 'terminating';
      await runner.process();
      expect(runner.state).to.equal('terminated');
    });

    it('paused', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });
      const registry = createMockRegistry(sandbox, {
        subscribeStub,
      });

      // Override getTopics and getTaskTopics for this test
      registry.getTopics = sandbox.stub().returns(['test']);
      registry.getTaskTopics = sandbox.stub().returns(['test']);

      // Use a different config for this test
      const config = {
        engine: 'dummy' as const,
      };
      const steveo = createSteveoInstance(registry, config);
      const runner = new Runner(steveo);

      const getQueueUrlAsyncStub = sandbox
        .stub(runner.sqs, 'getQueueUrl')
        .resolves({ QueueUrl: 'https://ap-southeast2.aws.com' });

      const receiveMessageAsyncStub = sandbox
        .stub(runner.sqs, 'receiveMessage')
        .resolves([]);

      runner.state = 'paused';
      await runner.process();
      expect(getQueueUrlAsyncStub.calledOnce).to.equal(false);
      expect(receiveMessageAsyncStub.calledOnce).to.equal(false);
    });

    it('processes a message', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });
      const registry = createMockRegistry(sandbox, {
        subscribeStub,
      });

      // Override getTopics and getTaskTopics for this test
      registry.getTopics = sandbox.stub().returns(['test']);
      registry.getTaskTopics = sandbox.stub().returns(['test']);

      // Use a different config for this test
      const config = {
        engine: 'dummy' as const,
      };
      const steveo = createSteveoInstance(registry, config);
      const runner = new Runner(steveo);

      const getQueueUrlAsyncStub = sandbox
        .stub(runner.sqs, 'getQueueUrl')
        .resolves({ QueueUrl: 'https://ap-southeast2.aws.com' });

      const receiveMessageAsyncStub = sandbox
        .stub(runner.sqs, 'receiveMessage')
        .resolves([]);

      await runner.process();
      expect(getQueueUrlAsyncStub.calledOnce).to.equal(true);
      expect(receiveMessageAsyncStub.calledOnce).to.equal(true);
    });

    it('processes a message from a FIFO queue', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });
      const registry = createMockRegistry(sandbox, {
        subscribeStub,
        fifo: true,
      });

      // Override getTopics and getTaskTopics for this test
      registry.getTopics = sandbox.stub().returns(['test']);
      registry.getTaskTopics = sandbox.stub().returns(['test']);

      // Use a different config for this test
      const config = {
        engine: 'dummy' as const,
      };
      const steveo = createSteveoInstance(registry, config);
      const runner = new Runner(steveo);

      const randomId = randomUUID();
      const getQueueUrlAsyncStub = sandbox
        .stub(runner.sqs, 'getQueueUrl')
        // if are logic is correct, and that it appends .fifo to the plain `test` topic
        //  this would be the argument passed on the getQueueUrl to SQS
        .withArgs({ QueueName: 'test.fifo' })
        .resolves({
          QueueUrl: `https://ap-southeast2.aws.com/${randomId}/test.fifo`,
        });

      const receiveMessageAsyncStub = sandbox
        .stub(runner.sqs, 'receiveMessage')
        .resolves([]);

      await runner.process();
      expect(getQueueUrlAsyncStub.calledOnce).to.equal(true);
      expect(receiveMessageAsyncStub.calledOnce).to.equal(true);

      expect(
        receiveMessageAsyncStub.args[0][0].QueueUrl,
        'Should have the same value as the specified getQueueUrl stub'
      ).to.eqls(`https://ap-southeast2.aws.com/${randomId}/test.fifo`);
    });
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const subscribeStub = sandbox.stub().throws({ some: 'error' });
    const emitStub = sandbox.stub();
    const registry = createMockRegistry(sandbox, {
      subscribeStub,
      emitStub,
    });

    // Use a different config for this test
    const config = {
      engine: 'dummy' as const,
    };
    const steveo = createSteveoInstance(registry, config);
    const runner = new Runner(steveo);

    const deleteMessageStub = sandbox
      .stub(runner.sqs, 'deleteMessage')
      .resolves();

    await runner.receive(
      [
        {
          ReceiptHandle: v4(),
          Body: JSON.stringify({ data: 'Hello' }),
        },
        {
          ReceiptHandle: v4(),
          Body: JSON.stringify({ data: 'World' }),
        },
      ],
      'a-topic'
    );
    expect(subscribeStub.callCount, 'subscribe is called twice').to.equal(2);
    expect(
      deleteMessageStub.callCount,
      'deleteMessage is called twice'
    ).to.equal(2);
    expect(
      emitStub.calledWith(
        'runner_failure',
        'a-topic',
        { some: 'error' },
        { data: 'World' }
      )
    ).to.equal(true);
  });

  describe('healthCheck', () => {
    it('should call getQueueUrl with .fifo suffix for FIFO queues', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });
      const registry = createMockRegistry(sandbox, {
        subscribeStub,
        fifo: true,
      });
      registry.getTopics = sandbox.stub().returns(['fifo-health-topic']);
      const steveo = createSteveoInstance(registry);
      const runner = new Runner(steveo);

      const getQueueUrlStub = sandbox
        .stub(runner.sqs, 'getQueueUrl')
        .resolves({});

      await runner.healthCheck();

      expect(getQueueUrlStub.calledOnce).to.be.true;
      expect(getQueueUrlStub.args[0][0]).to.deep.equal({
        QueueName: 'fifo-health-topic.fifo',
      });
    });

    it('should call getQueueUrl without .fifo suffix for standard queues', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });
      const registry = createMockRegistry(sandbox, { subscribeStub });
      registry.getTopics = sandbox.stub().returns(['standard-health-topic']);
      const steveo = createSteveoInstance(registry);
      const runner = new Runner(steveo);

      const getQueueUrlStub = sandbox
        .stub(runner.sqs, 'getQueueUrl')
        .resolves({});

      await runner.healthCheck();

      expect(getQueueUrlStub.calledOnce).to.be.true;
      expect(getQueueUrlStub.args[0][0]).to.deep.equal({
        QueueName: 'standard-health-topic',
      });
    });

    it('should throw error if no queues are registered', async () => {
      const registry = createMockRegistry(sandbox);
      registry.getTopics = sandbox.stub().returns([]);
      const steveo = createSteveoInstance(registry);
      const runner = new Runner(steveo);
      try {
        await runner.healthCheck();
        expect.fail('Expected an error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('No queues registered');
      }
    });
  });

  it('calculates duration of a task run correctly', async () => {
    clock.restore();
    const startMs = Date.now();
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const registry = createMockRegistry(sandbox, { subscribeStub });
    const config = createSQSConfig();
    const steveo = createSteveoInstance(registry, config);
    const runner = new Runner(steveo);

    sandbox.stub(runner.sqs, 'deleteMessage').resolves();

    const inputContext = { contextKey: 'contextValue', startMs };
    const messageBody = { data: 'Hello', _meta: inputContext };

    // Wait a second to avoid flakiness
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });

    await runner.receive(
      [
        {
          ReceiptHandle: v4(),
          Body: JSON.stringify(messageBody),
        },
      ],
      'a-topic'
    );

    // Greater than or equal to 1 second and less than a reasonable 15 seconds, as the test runs in a few milliseconds
    // To catch calculation errors
    // Note: Duration is in milliseconds
    expect(subscribeStub.args[0][1].duration)
      .to.be.greaterThanOrEqual(1000)
      .lessThan(15000);
  });
});
