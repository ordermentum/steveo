import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producers/kafka';
import Registry from '../../src/registry';

describe('Kafka Producer', () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('should initialize', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer(
      {
        engine: 'kafka',
        bootstrapServers: 'kafka:9200',
        securityProtocol: 'plaintext',
        tasksPath: '',
      },
      registry
    );
    const initStub = sandbox.stub(p.producer, 'connect').resolves();
    try {
      await p.initialize();
    } catch (err) {}
    expect(initStub.callCount).to.equal(1);
  });

  it('should send', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer(
      {
        engine: 'kafka',
        bootstrapServers: 'kafka:9200',
        securityProtocol: 'plaintext',
        tasksPath: '',
      },
      registry
    );
    const sendStub = sandbox.stub(p.producer, 'produce').callsArgWith(5);
    await p.send('test-topic', { a: 'payload' });
    expect(sendStub.callCount).to.equal(1);
  });

  it('should log error on failure', async () => {
    const registry = new Registry();
    registry.addTopic('test-topic');
    const p = new Producer(
      {
        engine: 'kafka',
        bootstrapServers: 'kafka:9200',
        securityProtocol: 'plaintext',
        tasksPath: '',
      },
      registry
    );
    const sendStub = sandbox
      .stub(p.producer, 'produce')
      .callsArgWith(5, 'error');
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
    const p = new Producer(
      {
        engine: 'kafka',
        bootstrapServers: 'kafka:9200',
        securityProtocol: 'plaintext',
        tasksPath: '',
      },
      registry
    );
    registry.addTopic('test-topic');
    const sendStub = sandbox.stub(p.producer, 'produce').callsArgWith(5);
    await p.send('test-topic', { a: 'payload', b: '¼' });
    expect(sendStub.callCount).to.equal(1);
    const payload = JSON.parse(sendStub.args[0][2].toString('utf8'));

    // eslint-disable-next-line no-underscore-dangle
    expect(payload?._meta).to.exist;
    expect(payload?.a).to.equal('payload');
    expect(payload?.b).to.equal('¼');
  });

  it('should make buffers from string payload', async () => {
    const registry = new Registry();
    const p = new Producer(
      {
        engine: 'kafka',
        bootstrapServers: 'kafka:9200',
        securityProtocol: 'plaintext',
        tasksPath: '',
      },
      registry
    );
    registry.addTopic('test-topic');
    const sendStub = sandbox.stub(p.producer, 'produce').callsArgWith(5);
    await p.send('test-topic', JSON.stringify({ a: 'payload', b: '¼' }));
    expect(sendStub.args[0][2] instanceof Buffer).to.be.true;
  });
});
