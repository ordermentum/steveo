import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producer/sqs';
import Registry from '../../src/registry';
import sqsConf from '../../src/config/sqs';

describe('SQS Producer', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('should initialize', async () => {
    const registry = new Registry();
    const initStub = sandbox.stub(sqsConf, 'sqs').returns({
      createQueueAsync: sandbox
        .stub()
        .resolves({ data: { QueueUrl: 'kjsdkh' } }),
        getQueueUrlAsync: sandbox.stub().resolves({QueueUrl: null})
    });
    const p = new Producer({}, registry);
    await p.initialize('test');
    expect(initStub.callCount).to.equal(1);
  });

  it('should not recreate queue and send from cached object', async () => {
    const registry = new Registry();
    const createQueueAsyncStub = sandbox
      .stub()
      .resolves({ data: { QueueUrl: 'kjsdkh' } });
    const getQueueUrlAsyncStub = sandbox.stub()
    sandbox.stub(sqsConf, 'sqs').returns({
      createQueueAsync: createQueueAsyncStub,
      getQueueUrlAsync: getQueueUrlAsyncStub.resolves({QueueUrl: null})
    });
    const p = new Producer({}, registry);
    await p.initialize('test');
    expect(createQueueAsyncStub.callCount).to.equal(1);
    getQueueUrlAsyncStub.resolves({QueueUrl: 'test'});
    await p.initialize('test');
    expect(createQueueAsyncStub.callCount).to.equal(1); //Should remain 1, not create queue again
  });

  it('should initialize & send if no sqsUrls ', async () => {
    const registry = new Registry();

    const p = new Producer({}, registry);
    sandbox.spy(p, 'getPayload');
    const sendMessageStub = sandbox.stub().resolves({ hi: 'hello' });
    const initializeStub = sandbox.stub(p, 'initialize').resolves();
    p.producer = { sendMessageAsync: sendMessageStub };
    p.sqsUrls = {
      'test-topic': '',
    };
    await p.send('test-topic', { a: 'payload' });
    expect(initializeStub.callCount).to.equal(1);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should send without initialize if sqsUrls are present', async () => {
    const registry = new Registry();
    const p = new Producer({}, registry);
    sandbox.spy(p, 'getPayload');
    const sendMessageStub = sandbox.stub().resolves({ hi: 'hello' });
    const getQueueUrlAsyncStub = sandbox.stub().resolves({QueueUrl: 'test-topic'})
    const createQueueAsyncStub = sandbox
      .stub()
      .resolves({ data: { QueueUrl: 'kjsdkh' } });
    p.producer = {  createQueueAsync: createQueueAsyncStub, sendMessageAsync: sendMessageStub, getQueueUrlAsync: getQueueUrlAsyncStub };
    p.sqsUrls = {
      'test-topic': 'asdasd',
    };
    await p.send('test-topic', { a: 'payload' });
    expect(createQueueAsyncStub.callCount).to.equal(0);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should send with attributes', async () => {
    const registry = new Registry();

    const p = new Producer({}, registry);
    sandbox.spy(p, 'getPayload');
    registry.addNewTask({
      topic: 'test-topic',
      subscribe: () => { },
      attributes: [
        {
          name: 'Hello',
          dataType: 'String',
          value: 'abc',
        },
      ],
    });
    const sendMessageStub = sandbox.stub().resolves({ hi: 'hello' });
    const getQueueUrlAsyncStub = sandbox.stub().resolves({QueueUrl: 'test-topic'});
    const createQueueAsyncStub = sandbox
      .stub()
      .resolves({ data: { QueueUrl: 'kjsdkh' } });
    p.producer = {  createQueueAsync: createQueueAsyncStub, sendMessageAsync: sendMessageStub,  getQueueUrlAsync: getQueueUrlAsyncStub };
    p.sqsUrls = {
      'test-topic': 'asdasd',
    };
    await p.send('test-topic', { a: 'payload' });
    expect(createQueueAsyncStub.callCount).to.equal(0);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should throw error if initialize rejects', async () => {
    const registry = new Registry();

    const p = new Producer({}, registry);
    sandbox.spy(p, 'getPayload');
    registry.addNewTask({
      topic: 'test-topic',
      subscribe: () => { },
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
    const sendMessageStub = sandbox.stub().resolves({ hi: 'hello' });
    sandbox.stub(p, 'initialize').throws();
    p.producer = { sendMessageAsync: sendMessageStub };
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

    const p = new Producer({}, registry);
    sandbox.spy(p, 'getPayload');
    registry.addNewTask({
      topic: 'test-topic',
      subscribe: () => { },
      attributes: [
        {
          name: 'Hello',
          dataType: 'String',
          value: 'abc',
        },
      ],
    });
    const sendMessageStub = sandbox.stub().throws({ error: 'mate' });
    sandbox.stub(p, 'initialize').resolves();
    p.producer = { sendMessageAsync: sendMessageStub };
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
