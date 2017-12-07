import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producer/redis';
import Registry from '../../src/registry';
import redisConf from '../../src/config/redis';

describe('Redis Producer', () => {
  it('should initialize', async () => {
    const registry = new Registry();
    const listQueueAsyncStub = sinon.stub().resolves(['abc']);
    const initStub = sinon.stub(redisConf, 'redis').returns({
      listQueuesAsync: listQueueAsyncStub,
      createQueueAsync: sinon.stub().resolves(),
    });
    const p = new Producer({ engine: 'redis' }, registry, console);
    await p.initialize('test');
    expect(initStub.callCount).to.equal(1);
    expect(listQueueAsyncStub.callCount).to.equal(1);
    redisConf.redis.restore();
  });

  it('should send', async () => {
    const registry = new Registry();

    const p = new Producer({}, registry, console);
    sinon.spy(p, 'getPayload');
    registry.addNewTask({
      topic: 'test-topic',
      subscribe: () => {},
    });
    const sendMessageStub = sinon.stub().resolves({ hi: 'hello' });
    const getQueueAttributesAsyncStub = sinon.stub.resolves();
    sinon.stub(p, 'initialize').resolves();
    p.producer = { sendMessageAsync: sendMessageStub,
      getQueueAttributesAsync: getQueueAttributesAsyncStub };
    await p.send('test-topic', { a: 'payload' });
    expect(p.initialize.callCount).to.equal(0);
    expect(sendMessageStub.callCount).to.equal(1);
  });

  it('should throw error if initialize rejects', async () => {
    const registry = new Registry();

    const p = new Producer({}, registry, console);
    sinon.spy(p, 'getPayload');
    registry.addNewTask({
      topic: 'test-topic',
      subscribe: () => {},
    });
    const sendMessageStub = sinon.stub().resolves({ hi: 'hello' });
    sinon.stub(p, 'initialize').throws();
    const getQueueAttributesAsyncStub = sinon.stub.resolves();
    p.producer = { sendMessageAsync: sendMessageStub,
      getQueueAttributesAsync: getQueueAttributesAsyncStub };
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

    const p = new Producer({}, registry, console);
    sinon.spy(p, 'getPayload');
    registry.addNewTask({
      topic: 'test-topic',
      subscribe: () => {},
      attributes: [{
        name: 'Hello',
        dataType: 'String',
        value: 'abc',
      }],
    });
    const sendMessageStub = sinon.stub().throws({ error: 'mate' });
    sinon.stub(p, 'initialize').resolves();
    const getQueueAttributesAsyncStub = sinon.stub.resolves();
    p.producer = { sendMessageAsync: sendMessageStub,
      getQueueAttributesAsync: getQueueAttributesAsyncStub };
    p.sqsUrls = {};
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
