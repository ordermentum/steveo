import { expect } from 'chai';
import sinon from 'sinon';

import logger from 'pino';
import { v4 } from 'uuid';
import Runner from '../../src/consumers/sqs';
import { build } from '../../src/lib/pool';
import Registry from '../../src/registry';
import { Steveo } from '../../src';

describe('runner/sqs', () => {
  let runner: Runner;
  let registry: Registry;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    registry = new Registry();

    const steveo = {
      config: {},
      registry,
      pool: build(registry),
    };
    // @ts-ignore
    runner = new Runner(steveo);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.process).to.equal('function');
  });

  it('should invoke callback when receives a message on topic', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const anotherRegistry = {
      registeredTasks: [],
      addNewTask: () => {},
      removeTask: () => {},
      getTopics: () => [],
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
      events: {
        emit: sandbox.stub(),
      },
    };

    const log = logger({ level: 'debug' });
    const config = {
      engine: 'sqs' as const,
      logger: log,
      registry: anotherRegistry,
    };

    const steveo = new Steveo(config);
    // @ts-ignore
    steveo.registry = anotherRegistry;
    // @ts-ignore
    steveo.pool = build(anotherRegistry);

    const anotherRunner = new Runner(steveo);

    // @ts-ignore
    const deleteMessageStub = sandbox
      .stub(anotherRunner.sqs, 'deleteMessage')
      // @ts-ignore
      .returns({ promise: async () => {} });

    await anotherRunner.receive(
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
    const anotherRegistry = {
      registeredTasks: [],
      addNewTask: () => {},
      removeTask: () => {},
      getTopics: () => [],
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
      events: {
        emit: sandbox.stub(),
      },
    };

    const log = logger({ level: 'debug' });
    const config = {
      engine: 'sqs' as const,
      logger: log,
      registry: anotherRegistry,
    };

    const steveo = new Steveo(config);
    // @ts-ignore
    steveo.registry = anotherRegistry;
    // @ts-ignore
    steveo.pool = build(anotherRegistry);

    const anotherRunner = new Runner(steveo);

    // @ts-ignore
    const deleteMessageStub = sandbox
      .stub(anotherRunner.sqs, 'deleteMessage')
      // @ts-ignore
      .returns({ promise: async () => {} });

    const inputContext = { contextKey: 'contextValue' };
    await anotherRunner.receive(
      [
        {
          ReceiptHandle: v4(),
          Body: JSON.stringify({ data: 'Hello', context: inputContext }),
        },
      ],
      'a-topic'
    );

    sinon.assert.calledWith(
      subscribeStub,
      { data: 'Hello' },
      inputContext
    );
  });

  it('should delete message if waitToCommit is true after processing', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const anotherRegistry = {
      registeredTasks: [],
      addNewTask: () => {},
      removeTask: () => {},
      getTopics: () => [],
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
        options: {
          waitToCommit: true,
        },
      }),
      emit: sandbox.stub(),
      events: {
        emit: sandbox.stub(),
      },
    };

    const log = logger({ level: 'debug' });
    const config = {
      engine: 'sqs' as const,
      logger: log,
      registry: anotherRegistry,
    };

    const steveo = new Steveo(config);
    // @ts-ignore
    steveo.registry = anotherRegistry;
    // @ts-ignore
    steveo.pool = build(anotherRegistry);

    const anotherRunner = new Runner(steveo);

    // @ts-ignore
    const deleteMessageStub = sandbox
      .stub(anotherRunner.sqs, 'deleteMessage')
      // @ts-ignore
      .returns({ promise: async () => {} });

    await anotherRunner.receive(
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

  it('get all urls for queues', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
      events: {
        emit: sandbox.stub(),
      },
    };

    const config = {
      engine: 'dummy' as const,
    };

    const steveo = new Steveo(config);
    // @ts-ignore
    steveo.registry = anotherRegistry;

    const anotherRunner = new Runner(steveo);
    const getQueueUrlAsyncStub = sandbox
      .stub(anotherRunner.sqs, 'getQueueUrl')
      .returns({
        // @ts-ignore
        promise: async () => ({ QueueUrl: 'https://ap-southeast2.aws.com' }),
      });

    expect(anotherRunner.sqsUrls).to.deep.equal({});
    await anotherRunner.getQueueUrl('test');
    expect(anotherRunner.sqsUrls).to.deep.equal({
      test: 'https://ap-southeast2.aws.com',
    });
    await anotherRunner.getQueueUrl('test');
    expect(getQueueUrlAsyncStub.calledOnce).to.equal(true);
  });

  it('continues to work if queue does not exist', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
      events: {
        emit: sandbox.stub(),
      },
    };

    const config = {
      engine: 'dummy' as const,
    };

    const steveo = new Steveo(config);
    // @ts-ignore
    steveo.registry = anotherRegistry;

    const anotherRunner = new Runner(steveo);
    const getQueueUrlAsyncStub = sandbox
      .stub(anotherRunner.sqs, 'getQueueUrl')
      // @ts-ignore
      .returns({
        promise: async () => {
          throw new Error();
        },
      });

    expect(anotherRunner.sqsUrls).to.deep.equal({});
    await anotherRunner.getQueueUrl('test');
    expect(anotherRunner.sqsUrls).to.deep.equal({});
    await anotherRunner.getQueueUrl('test');
    expect(getQueueUrlAsyncStub.callCount).to.equal(2);
  });

  describe('process', () => {
    it('terminates', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => {},
          subscribe: subscribeStub,
        }),
        getTopics: () => ['test'],
        getTaskTopics: () => ['test'],
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };

      const config = {
        engine: 'dummy' as const,
      };

      const steveo = new Steveo(config);
      // @ts-ignore
      steveo.registry = anotherRegistry;
      const anotherRunner = new Runner(steveo);
      anotherRunner.state = 'terminating';
      await anotherRunner.process();
      expect(anotherRunner.state).to.equal('terminated');
    });

    it('paused', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => {},
          subscribe: subscribeStub,
        }),
        getTopics: () => ['test'],
        getTaskTopics: () => ['test'],
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };

      const config = {
        engine: 'dummy' as const,
      };

      const steveo = new Steveo(config);
      // @ts-ignore
      steveo.registry = anotherRegistry;
      // @ts-ignore
      const anotherRunner = new Runner(steveo);

      const getQueueUrlAsyncStub = sandbox
        .stub(anotherRunner.sqs, 'getQueueUrl')
        .returns({
          // @ts-ignore
          promise: async () => ({ QueueUrl: 'https://ap-southeast2.aws.com' }),
        });

      const receiveMessageAsyncStub = sandbox
        .stub(anotherRunner.sqs, 'receiveMessage')
        .returns({
          // @ts-ignore
          promise: async () => [],
        });

      anotherRunner.state = 'paused';
      await anotherRunner.process();
      expect(getQueueUrlAsyncStub.calledOnce).to.equal(false);
      expect(receiveMessageAsyncStub.calledOnce).to.equal(false);
    });

    it('processes a message', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => {},
          subscribe: subscribeStub,
        }),
        getTopics: () => ['test'],
        getTaskTopics: () => ['test'],
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };

      const config = {
        engine: 'dummy' as const,
      };

      const steveo = new Steveo(config);
      // @ts-ignore
      steveo.registry = anotherRegistry;

      const anotherRunner = new Runner(steveo);

      const getQueueUrlAsyncStub = sandbox
        .stub(anotherRunner.sqs, 'getQueueUrl')
        .returns({
          // @ts-ignore
          promise: async () => ({ QueueUrl: 'https://ap-southeast2.aws.com' }),
        });

      const receiveMessageAsyncStub = sandbox
        .stub(anotherRunner.sqs, 'receiveMessage')
        .returns({
          // @ts-ignore
          promise: async () => [],
        });

      await anotherRunner.process();
      expect(getQueueUrlAsyncStub.calledOnce).to.equal(true);
      expect(receiveMessageAsyncStub.calledOnce).to.equal(true);
    });
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const subscribeStub = sandbox.stub().throws({ some: 'error' });
    const emitStub = sandbox.stub();
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: emitStub,
      events: {
        emit: emitStub,
      },
    };
    const config = {
      engine: 'dummy' as const,
    };

    const steveo = new Steveo(config);
    // @ts-ignore
    steveo.registry = anotherRegistry;

    const anotherRunner = new Runner(steveo);

    const deleteMessageStub = sandbox
      .stub(anotherRunner.sqs, 'deleteMessage')
      // @ts-ignore
      .returns({ promise: async () => {} });

    await anotherRunner.receive(
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
});
