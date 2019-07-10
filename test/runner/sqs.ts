import { expect } from 'chai';
import sinon from 'sinon';

import Runner from '../../src/runner/sqs';
import { build } from '../../src/base/pool';
import Registry from '../../src/registry';
import sqsConf from '../../src/config/sqs';

describe('SQS Runner', () => {
  let runner;
  let registry;
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    registry = new Registry();
    runner = new Runner({}, registry, null);
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
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sandbox.stub(),
      },
    };
    const deleteMessageStub = sandbox.stub().resolves();
    sandbox.stub(sqsConf, 'sqs').returns({
      deleteMessageAsync: deleteMessageStub,
    });
    const anotherRunner = new Runner({}, anotherRegistry, build());
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

    const getQueueUrlAsyncStub = sandbox
      .stub()
      .resolves({ QueueUrl: 'https://ap-southeast2.aws.com' });
    sandbox.stub(sqsConf, 'sqs').returns({
      getQueueUrlAsync: getQueueUrlAsyncStub,
    });

    const anotherRunner = new Runner({}, anotherRegistry, build());
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

    const getQueueUrlAsyncStub = sandbox.stub().rejects();
    sandbox.stub(sqsConf, 'sqs').returns({
      getQueueUrlAsync: getQueueUrlAsyncStub,
    });

    const anotherRunner = new Runner({}, anotherRegistry, build());
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
      events: {
        emit: sandbox.stub(),
      },
    };

    const getQueueUrlAsyncStub = sandbox
      .stub()
      .resolves({ QueueUrl: 'https://ap-southeast2.aws.com' });
    const receiveMessageAsyncStub = sandbox.stub().resolves([]);

    sandbox.stub(sqsConf, 'sqs').returns({
      getQueueUrlAsync: getQueueUrlAsyncStub,
      receiveMessageAsync: receiveMessageAsyncStub,
    });

    const anotherRunner = new Runner(
      { shuffleQueue: true },
      anotherRegistry,
      build()
    );
    await anotherRunner.process();
    expect(getQueueUrlAsyncStub.calledOnce).to.equal(true);
    expect(receiveMessageAsyncStub.calledOnce).to.equal(true);
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const subscribeStub = sandbox.stub().throws({ some: 'error' });
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sandbox.stub(),
      },
    };
    const deleteMessageStub = sandbox.stub().resolves();
    sandbox.stub(sqsConf, 'sqs').returns({
      deleteMessageAsync: deleteMessageStub,
    });
    const anotherRunner = new Runner({}, anotherRegistry, build());
    let error = false;
    try {
      await anotherRunner.receive(
        [
          { Body: JSON.stringify({ data: 'Hello' }) },
          { Body: JSON.stringify({ data: 'World' }) },
        ],
        'a-topic'
      );
    } catch (ex) {
      error = true;
      expect(subscribeStub.callCount).to.equal(1);
      expect(deleteMessageStub.callCount).to.equal(0);
    }
    expect(error);
  });
});
