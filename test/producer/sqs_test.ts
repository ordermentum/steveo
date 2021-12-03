import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producer/sqs';
import Registry from '../../src/registry';

describe('SQS Producer', () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
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
    const registry = new Registry();
    // @ts-ignore
    const p = new Producer({ engine: 'sqs', bootstrapServers: '' }, registry);

    const createQueueStub = sandbox
      .stub(p.producer, 'createQueue')
      // @ts-ignore
      .returns(promiseResolves({ data: { QueueUrl: 'kjsdkh' } }));

    sandbox
      .stub(p.producer, 'getQueueUrl')
      // @ts-ignore
      .returns(promiseResolves({ QueueUrl: null }));

    await p.initialize('test');
    expect(createQueueStub.callCount).to.equal(1);
  });

  it('should not recreate queue and send from cached object', async () => {
    const registry = new Registry();

    const p = new Producer({ engine: 'kafka', bootstrapServers: '' }, registry);
    const createQueueStub = sandbox
      .stub(p.producer, 'createQueue')
      // @ts-ignore
      .returns(promiseResolves({ data: { QueueUrl: 'kjsdkh' } }));

    const getQueueUrlStub = sandbox.stub(p.producer, 'getQueueUrl');
    // @ts-ignore
    getQueueUrlStub.returns(promiseResolves({ QueueUrl: null }));

    await p.initialize('test');
    expect(createQueueStub.callCount).to.equal(1);
    // @ts-ignore
    getQueueUrlStub.returns(promiseResolves({ QueueUrl: 'test' }));
    await p.initialize('test');
    expect(createQueueStub.callCount).to.equal(1); // Should remain 1, not create queue again
  });

  it('should initialize & send if no sqsUrls', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer({ engine: 'sqs', bootstrapServers: '' }, registry);

    sandbox.spy(p, 'getPayload');
    const sendMessageStub = sandbox
      .stub(p.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));

    const initializeStub = sandbox.stub(p, 'initialize').resolves();
    p.sqsUrls = {
      'test-topic': '',
    };
    await p.send('test-topic', { a: 'payload' });
    expect(initializeStub.callCount).to.equal(1);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should send without initialize if sqsUrls are present', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer({ engine: 'sqs', bootstrapServers: '' }, registry);
    sandbox.spy(p, 'getPayload');
    const sendMessageStub = sandbox
      .stub(p.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));
    sandbox
      .stub(p.producer, 'getQueueUrl')
      // @ts-ignore
      .returns(promiseResolves({ QueueUrl: 'test-topic' }));
    const createQueueStub = sandbox
      .stub(p.producer, 'createQueue')
      // @ts-ignore
      .returns(promiseResolves({ data: { QueueUrl: 'kjsdkh' } }));

    p.sqsUrls = {
      'test-topic': 'asdasd',
    };
    await p.send('test-topic', { a: 'payload' });
    expect(createQueueStub.callCount).to.equal(0);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should send with attributes', async () => {
    const registry = new Registry();

    const p = new Producer({ engine: 'kafka', bootstrapServers: '' }, registry);
    sandbox.spy(p, 'getPayload');
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
      .stub(p.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));
    sandbox
      .stub(p.producer, 'getQueueUrl')
      // @ts-ignore
      .returns(promiseResolves({ QueueUrl: 'test-topic' }));
    const createQueueStub = sandbox
      .stub(p.producer, 'createQueue')
      // @ts-ignore
      .returns(promiseResolves({ data: { QueueUrl: 'kjsdkh' } }));

    p.sqsUrls = {
      'test-topic': 'asdasd',
    };
    await p.send('test-topic', { a: 'payload' });
    expect(createQueueStub.callCount).to.equal(0);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should throw error if initialize rejects', async () => {
    const registry = new Registry();

    const p = new Producer({ engine: 'kafka', bootstrapServers: '' }, registry);
    sandbox.spy(p, 'getPayload');
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
      .stub(p.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));
    sandbox.stub(p, 'initialize').throws();
    p.sqsUrls = {};
    let err = false;
    try {
      await p.send('test-topic', { a: 'payload' });
    } catch (ex) {
      err = true;
      expect(ex).not.eql(undefined);
      expect(ex).not.eql(null);
    }
    expect(err).to.equal(true);
  });

  it('should throw error if sendmessage fails', async () => {
    const registry = new Registry();

    const p = new Producer({ engine: 'kafka', bootstrapServers: '' }, registry);
    sandbox.spy(p, 'getPayload');
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
      .stub(p.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseRejects({ yeah: 'nah' }));
    sandbox.stub(p, 'initialize').resolves();
    p.sqsUrls = {};
    let err = false;
    try {
      await p.send('test-topic', { a: 'payload' });
    } catch (ex) {
      err = true;
      expect(ex).not.eql(undefined);
      expect(ex).not.eql(null);
    }
    expect(err).to.equal(true);
  });
});
