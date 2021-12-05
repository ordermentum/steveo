import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producer/redis';
import Registry from '../../src/registry';
import redisConf from '../../src/config/redis';

describe('Redis Producer', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  afterEach(() => {
    sandbox.restore();
  });
  it('should initialize', async () => {
    const registry = new Registry();
    const listQueueAsyncStub = sandbox.stub().resolves(['abc']);
    const initStub = sandbox.stub(redisConf, 'redis').returns({
      listQueuesAsync: listQueueAsyncStub,
      createQueueAsync: sandbox.stub().resolves(),
    });
    // @ts-ignore
    const p = new Producer({ engine: 'redis' }, registry);
    await p.initialize('test');
    expect(initStub.callCount).to.equal(1);
    expect(listQueueAsyncStub.callCount).to.equal(1);
  });

  it('should send', async () => {
    const registry = new Registry();
    // @ts-ignore
    const p = new Producer({}, registry);
    sinon.spy(p, 'getPayload');
    // @ts-ignore
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
      subscribe: () => {},
    });
    const sendMessageStub = sandbox.stub().resolves({ hi: 'hello' });
    const getQueueAttributesAsyncStub = sandbox.stub().resolves();
    sandbox.stub(p, 'initialize').resolves();
    // @ts-ignore
    p.producer = {
      sendMessageAsync: sendMessageStub,
      getQueueAttributesAsync: getQueueAttributesAsyncStub,
    };
    await p.send('test-topic', { a: 'payload' });
    // @ts-ignore
    expect(p.initialize.callCount).to.equal(0);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should throw error if initialize rejects', async () => {
    const registry = new Registry();
    // @ts-ignore
    const p = new Producer({}, registry);
    sandbox.spy(p, 'getPayload');
    // @ts-ignore
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
      subscribe: () => {},
    });
    const sendMessageStub = sandbox.stub().resolves({ hi: 'hello' });
    sandbox.stub(p, 'initialize').throws();
    // @ts-ignore
    p.producer = { sendMessageAsync: sendMessageStub };
    // @ts-ignore
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
    // @ts-ignore
    const p = new Producer({}, registry);
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
    const sendMessageStub = sandbox.stub().throws({ error: 'mate' });
    sandbox.stub(p, 'initialize').resolves();
    // @ts-ignore
    p.producer = { sendMessageAsync: sendMessageStub };
    // @ts-ignore
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
