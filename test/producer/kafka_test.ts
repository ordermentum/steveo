import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producer/kafka';
import Registry from '../../src/registry';

describe('Kafka Producer', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('should initialize', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer({
      engine:'kafka',
      bootstrapServers: "kafka:9200",
      securityProtocol: 'plaintext'
    }, registry);
    const initStub = sandbox.stub(p.producer, 'connect').resolves();
    try {
      await p.initialize();
    }catch(err) {}
    expect(initStub.callCount).to.equal(1);
  });

  it('should send', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer({
      engine:'kafka',
      bootstrapServers: "kafka:9200",
      securityProtocol: 'plaintext'
    }, registry);
    const sendStub = sandbox.stub(p.producer, 'produce').resolves();
    await p.send('test-topic', { a: 'payload' });
    expect(sendStub.callCount).to.equal(1);
  });

  it('should log error on failure', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer({
      engine:'kafka',
      bootstrapServers: "kafka:9200",
      securityProtocol: 'plaintext'
    }, registry);
    const sendStub = sandbox.stub(p.producer, 'produce').throws();
    let err;
    try {
      await p.send('test-topic', { a: 'payload' });
    } catch (ex) {
      err = true;
      expect(sendStub.callCount).to.equal(1);
    }
    expect(err).to.equal(true);
  });

  it('should send utf-8 strings', async () => {
    const registry = new Registry();
    const p = new Producer({
      engine:'kafka',
      bootstrapServers: "kafka:9200",
      securityProtocol: 'plaintext'
    }, registry);
    registry.addTopic('test-topic');
    const sendStub = sandbox.stub(p.producer, 'produce').resolves();
    await p.send('test-topic', { a: 'payload', b: '¼' });
    expect(sendStub.callCount).to.equal(1);
    const payload = JSON.parse(sendStub.args[0][2].toString('utf8'));
    expect(payload).to.eqls({ a: 'payload', b: '¼' });
  });

  it('should make buffers from string payload', async () => {
    const registry = new Registry();
    const p = new Producer({
      engine:'kafka',
      bootstrapServers: "kafka:9200",
      securityProtocol: 'plaintext'
    }, registry);
    registry.addTopic('test-topic');
    const sendStub = sandbox.stub(p.producer, 'produce').resolves();
    await p.send('test-topic', JSON.stringify({ a: 'payload', b: '¼' }));
    expect(sendStub.args[0][2] instanceof Buffer).to.be.true;
  });
});
