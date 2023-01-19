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

  it('should create queues if required when initializing a topic', async () => {
    const registry = new Registry();
    // @ts-ignore
    const p = new Producer(
      { engine: 'sqs', tasksPath: '' },
      registry
    );

    const mockQueues = new Set();
    const createQueueStub = sandbox
      .stub(p.producer, "createQueue")
      .callsFake( // @ts-ignore
        ({ QueueName }) => // @ts-ignore
          new Promise((resolve) => {
            mockQueues.add(QueueName);
            resolve({
              QueueUrl: `https://sqs.ap-southeast-2.amazonaws.com/123456123456/${topic}`,
            });
          })
      );
    const getQueueUrlStub = sandbox
      .stub(p.producer, "getQueueUrl")
      .callsFake( // @ts-ignore
        ({ QueueName }) => // @ts-ignore
          new Promise((resolve, reject) => {
            if (mockQueues[QueueName]) {
              resolve({
                QueueUrl: `https://sqs.ap-southeast-2.amazonaws.com/123456123456/${topic}`,
              });
            } else { reject('Queue does not exist'); }
          })
      );

      // todo - move to sinon and call sinon.reset + setup up stubs + vals again before each

    // sandbox
    //   .stub(p.producer, 'getQueueUrl')
    //   // @ts-ignore
    //   .returns(promiseResolves({ QueueUrl: 'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test' }));

    await p.initialize('test'); // @ts-ignore
    expect(createQueueStub.calledOnceWith({ QueueUrl: 'test' }));
  });

  it('should not recreate queue and send from cached object', async () => {
    const registry = new Registry();

    const p = new Producer(
      { engine: 'sqs', tasksPath: '' },
      registry
    );
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
    const p = new Producer(
      { engine: 'sqs', tasksPath: '' },
      registry
    );
    sandbox.spy(p, 'getPayload');
    const sendMessageStub = sandbox
      .stub(p.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));

    const initializeStub = sandbox.stub(p, 'initialize').resolves();
    // does this line even do anything?? does this test even do anything???
    // p.sqsUrls = {
    //   'test-topic': '',
    // };
    await p.send('test-topic', { a: 'payload' });
    expect(initializeStub.callCount).to.equal(1);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  // This does not happen. We always call initialize().
  it('should send without looking up the queue URL if the sqs URL is already set', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer(
      { engine: 'sqs' },
      registry
    );

    sandbox.spy(p, 'getPayload');
    const sendMessageStub = sandbox
      .stub(p.producer, 'sendMessage')
      // @ts-ignore
      .returns(promiseResolves({ hi: 'hello' }));
    const getQueueUrlStub = sandbox
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
    expect(getQueueUrlStub.callCount).to.equal(0);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should send with attributes', async () => {
    const registry = new Registry();

    const p = new Producer(
      { engine: 'kafka', bootstrapServers: '', tasksPath: '' },
      registry
    );
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

    // @ts-ignore
    const p = new Producer(
      { engine: 'kafka', bootstrapServers: '', tasksPath: '' },
      registry
    );
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

    const p = new Producer(
      { engine: 'kafka', bootstrapServers: '', tasksPath: '' },
      registry
    );
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

  // it('should add New Relic trace metadata iff. New Relic is available', async () => {
    
  // })
});
