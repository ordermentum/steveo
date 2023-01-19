import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producer/sqs';
import Registry from '../../src/registry';

describe('SQS Producer', () => {
  const sandbox = sinon.createSandbox();
  let producer;
  let registry;

  beforeEach(() => {
    sandbox.restore();
    registry = new Registry();
    producer = new Producer(
      {
        engine: 'sqs',
      },
      registry
    );
  });

  const promiseResolves = resolves => ({
    promise: async () => resolves,
  });

  const promiseRejects = rejects => ({
    promise: async () => {
      throw rejects;
    },
  });

  afterEach(() => sandbox.restore());

  it('should initialize', async () => {
    const createQueueStub = sandbox
      .stub(producer.producer, 'createQueue')
      // @ts-ignore
      .returns(
        promiseResolves({
          QueueUrl:
            'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test-topic',
        })
      );

    sandbox
      .stub(producer.producer, 'getQueueUrl')
      // @ts-ignore
      .returns(promiseResolves({ QueueUrl: null }));

    await producer.initialize('test');
    expect(createQueueStub.callCount).to.equal(1);
  });

  it('should not recreate queue and send from cached object', async () => {
    const createQueueStub = sandbox
      .stub(producer.producer, 'createQueue')
      // @ts-ignore
      .returns(
        promiseResolves({
          QueueUrl:
            'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test-topic',
        })
      );

    const getQueueUrlStub = sandbox.stub(producer.producer, 'getQueueUrl');
    // @ts-ignore
    getQueueUrlStub.returns(promiseResolves({ QueueUrl: null }));

    await producer.initialize('test');
    expect(createQueueStub.callCount).to.equal(1);
    // @ts-ignore
    getQueueUrlStub.returns(promiseResolves({ QueueUrl: 'test' }));
    await producer.initialize('test');
    expect(createQueueStub.callCount).to.equal(1); // Should remain 1, not create queue again
  });

  it('should initialize & send if no sqsUrls', async () => {
    registry.addTopic('test-topic');
    sandbox.spy(producer, 'getPayload');
    const sendMessageStub = sandbox
      .stub(producer.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));

    const initializeStub = sandbox.stub(producer, 'initialize').resolves();
    // does this line even do anything?? does this test even do anything???
    producer.sqsUrls = {
      'test-topic':
        'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test-topic',
    };
    await producer.send('test-topic', { a: 'payload' });
    expect(initializeStub.callCount).to.equal(1);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  // What does "initialize" mean in this context?
  // initialize() is always called, but createQueue wont be called if it already exists.
  it('should send without initialize if sqsUrls are present', async () => {
    registry.addTopic('test-topic');

    sandbox.spy(producer, 'getPayload');
    const sendMessageStub = sandbox
      .stub(producer.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));

    sandbox
      .stub(producer.producer, 'getQueueUrl')
      // @ts-ignore
      .returns(
        promiseResolves({
          QueueUrl:
            'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test-topic',
        })
      );
    const createQueueStub = sandbox
      .stub(producer.producer, 'createQueue')
      // @ts-ignore
      .returns(
        promiseResolves({
          QueueUrl:
            'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test-topic',
        })
      );

    producer.sqsUrls = {
      'test-topic':
        'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test-topic',
    };
    await producer.send('test-topic', { a: 'payload' });
    expect(createQueueStub.notCalled).to.be.true;
    expect(sendMessageStub.calledOnce).to.be.true;
  });

  it('should send with attributes', async () => {
    sandbox.spy(producer, 'getPayload');
    // @ts-ignore
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
      subscribe: () => {},
      attributes: [
        {
          name: 'Hello',
          dataType: 'String',
          value: 'abc',
        },
      ],
    });
    const sendMessageStub = sandbox
      .stub(producer.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));
    sandbox
      .stub(producer.producer, 'getQueueUrl')
      // @ts-ignore
      .returns(promiseResolves({ QueueUrl: 'test-topic' }));
    const createQueueStub = sandbox
      .stub(producer.producer, 'createQueue')
      // @ts-ignore
      .returns(promiseResolves({ data: { QueueUrl: 'kjsdkh' } }));

    producer.sqsUrls = {
      'test-topic': 'asdasd',
    };
    await producer.send('test-topic', { a: 'payload' });
    expect(createQueueStub.callCount).to.equal(0);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should throw error if initialize rejects', async () => {
    // @ts-ignore
    sandbox.spy(producer, 'getPayload');
    // @ts-ignore
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
      subscribe: () => {},
      attributes: [
        {
          name: 'Hello',
          dataType: '',
          value: 'abc',
        },
        {
          name: 'World',
          dataType: 'String',
          value: 'abc',
        },
      ],
    });
    sandbox
      .stub(producer.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));
    sandbox.stub(producer, 'initialize').throws();
    producer.sqsUrls = {};
    let err = false;
    try {
      await producer.send('test-topic', { a: 'payload' });
    } catch (ex) {
      err = true;
      expect(ex).not.eql(undefined);
      expect(ex).not.eql(null);
    }
    expect(err).to.equal(true);
  });

  it('should throw error if sendmessage fails', async () => {
    sandbox.spy(producer, 'getPayload');
    // @ts-ignore
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
      subscribe: () => {},
      attributes: [
        {
          name: 'Hello',
          dataType: 'String',
          value: 'abc',
        },
      ],
    });
    sandbox
      .stub(producer.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseRejects({ yeah: 'nah' }));
    sandbox.stub(producer, 'initialize').resolves();
    producer.sqsUrls = {};
    let err = false;
    try {
      await producer.send('test-topic', { a: 'payload' });
    } catch (ex) {
      err = true;
      expect(ex).not.eql(undefined);
      expect(ex).not.eql(null);
    }
    expect(err).to.equal(true);
  });

  it('should add New Relic trace metadata iff. New Relic is available', async () => {});
});
