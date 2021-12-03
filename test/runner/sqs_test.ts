import { expect } from 'chai';
import sinon from 'sinon';

import Runner from '../../src/runner/sqs';
import { build } from '../../src/base/pool';
import Registry from '../../src/registry';

describe('SQS Runner', () => {
  let runner;
  let registry;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    registry = new Registry();
    // @ts-ignore
    runner = new Runner({}, registry, build());
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
      events: {
        emit: sandbox.stub(),
      },
    };

    // @ts-ignore
    const anotherRunner = new Runner({}, anotherRegistry, build());
    const deleteMessageStub = sandbox
      .stub(anotherRunner.sqs, 'deleteMessage')
      // @ts-ignore
      .returns({ promise: async () => {} });

    await anotherRunner.receive(
      [
        { Body: JSON.stringify({ data: 'Hello' }) },
        { Body: JSON.stringify({ data: 'World' }) },
      ],
      'a-topic'
    );
    expect(subscribeStub.callCount).to.equal(2);
    expect(deleteMessageStub.callCount).to.equal(2);
  });

  it('get all urls for queues', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sandbox.stub(),
      },
    };

    // @ts-ignore
    const anotherRunner = new Runner({}, anotherRegistry, build());
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
      events: {
        emit: sandbox.stub(),
      },
    };

    // @ts-ignore
    const anotherRunner = new Runner({}, anotherRegistry, build());
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

  it('process', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });

    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      getTopics: () => ['test'],
      getTaskTopics: () => ['test'],
      events: {
        emit: sandbox.stub(),
      },
    };
    const anotherRunner = new Runner(
      // @ts-ignore
      { shuffleQueue: true },
      // @ts-ignore
      anotherRegistry,
      build()
    );
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

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const subscribeStub = sandbox.stub().throws({ some: 'error' });
    const emitStub = sandbox.stub();
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: emitStub,
      },
    };
    // @ts-ignore
    const anotherRunner = new Runner({}, anotherRegistry, build());

    const deleteMessageStub = sandbox
      .stub(anotherRunner.sqs, 'deleteMessage')
      // @ts-ignore
      .returns({ promise: async () => {} });

    await anotherRunner.receive(
      [
        { Body: JSON.stringify({ data: 'Hello' }) },
        { Body: JSON.stringify({ data: 'World' }) },
      ],
      'a-topic'
    );
    expect(subscribeStub.callCount).to.equal(2);
    expect(deleteMessageStub.callCount).to.equal(2);
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
