import { expect } from 'chai';
import sinon from 'sinon';

import logger from 'pino';
import { v4 } from 'uuid';
import { randomUUID } from 'crypto';
import Runner from '../../src/consumers/sqs';
import { build } from '../../src/lib/pool';
import Registry from '../../src/registry';
import { Steveo } from '../../src';

describe('runner/sqs', () => {
  let runner: Runner;
  let registry: Registry;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers({
      now: 0,
      shouldAdvanceTime: true
    });
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
    clock.restore();
  });

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.process).to.equal('function');
  });

  it('should create queue with fifo suffix if enabled', async () => {
    const anotherRegistry = {
      registeredTasks: [],
      addNewTask: () => {},
      removeTask: () => {},
      getTopics: () => [],
      getTask: () => ({
        options: {
          fifo: true,
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

    const createQueueStub = sandbox
      .stub(anotherRunner.sqs, 'createQueue')
      // @ts-ignore
      .returns({ promise: async () => {} });

    await anotherRunner.createQueue('a-topic');

    expect(createQueueStub.called).to.be.true;

    const createQueueArgs: any = createQueueStub.args[0][0];
    expect(createQueueArgs.QueueName, 'should have fifo suffix').to.eqls(
      'a-topic.fifo'
    );
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
    sandbox
      .stub(anotherRunner.sqs, 'deleteMessage')
      // @ts-ignore
      .returns({ promise: async () => {} });

    const inputContext = { contextKey: 'contextValue' };
    const messageBody = { data: 'Hello', _meta: inputContext }
    await anotherRunner.receive(
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
      ...inputContext
    };

    sinon.assert.calledWith(
      subscribeStub,
      { data: 'Hello' },
      expectedContext
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

  it('should delete message using the FIFO QueueUrl if enabled in task', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const anotherRegistry = {
      registeredTasks: [],
      addNewTask: () => {},
      removeTask: () => {},
      getTopics: () => [],
      getTaskTopics: () => [],
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
        options: {
          fifo: true,
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
      .resolves({});

    const randomId = randomUUID();
    sandbox.stub(anotherRunner.sqs, 'getQueueUrl').resolves({
        QueueUrl: `https://ap-southeast2.aws.com/${randomId}/a-topic.fifo`,
      });

    const url: string = await anotherRunner.getQueueUrl('a-topic');
  
    await anotherRunner.receive(
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
      .stub(anotherRunner.sqs, 'getQueueUrl').resolves({ QueueUrl: 'https://ap-southeast2.aws.com' });

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
      .stub(anotherRunner.sqs, 'getQueueUrl').rejects(new Error());

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
        .stub(anotherRunner.sqs, 'getQueueUrl').resolves({ QueueUrl: 'https://ap-southeast2.aws.com' });

      const receiveMessageAsyncStub = sandbox
        .stub(anotherRunner.sqs, 'receiveMessage').resolves([]);

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
        .stub(anotherRunner.sqs, 'getQueueUrl').resolves({ QueueUrl: 'https://ap-southeast2.aws.com' });

      const receiveMessageAsyncStub = sandbox
        .stub(anotherRunner.sqs, 'receiveMessage').resolves([]);

      await anotherRunner.process();
      expect(getQueueUrlAsyncStub.calledOnce).to.equal(true);
      expect(receiveMessageAsyncStub.calledOnce).to.equal(true);
    });

    it('processes a message from a FIFO queue', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => {},
          subscribe: subscribeStub,
          options: {
            fifo: true,
          },
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

      const randomId = randomUUID();
      const getQueueUrlAsyncStub = sandbox
        .stub(anotherRunner.sqs, 'getQueueUrl')
        // if are logic is correct, and that it appends .fifo to the plain `test` topic
        //  this would be the argument passed on the getQueueUrl to SQS
        .withArgs({ QueueName: 'test.fifo' }).resolves({
            QueueUrl: `https://ap-southeast2.aws.com/${randomId}/test.fifo`,
          });

      const receiveMessageAsyncStub = sandbox
        .stub(anotherRunner.sqs, 'receiveMessage').resolves([]);

      await anotherRunner.process();
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
