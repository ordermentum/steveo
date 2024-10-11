import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producers/kafka';
import Registry from '../../src/runtime/registry';
import { createMessageMetadata } from '../../src/lib/context';

describe('Kafka Producer', () => {
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers({
      now: 0,
      shouldAdvanceTime: true,
    });
  });

  afterEach(() => {
    sandbox.restore();
    clock.restore();
  });

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
    } catch (err) {
      // Test catch body
    }
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

  it('should merge the context object into payload metadata if context given', async () => {
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
    const messageContext = { any: 'context' };
    const messagePayload: any = { a: 'payload' };
    const expectedMessage = JSON.stringify({
      ...messagePayload,
      _meta: { ...createMessageMetadata(messagePayload), ...messageContext },
    });

    const sendStub = sandbox.stub(p.producer, 'produce').callsArgWith(5);
    await p.send('test-topic', messagePayload, null, messageContext);

    const inputMessageBuffer: Buffer = sendStub.args[0][2];
    expect(inputMessageBuffer.toString()).to.be.equal(expectedMessage);
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

  it('should terminate cleanly if the producer is connected', async () => {
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
    sandbox.stub(p.producer, 'isConnected').resolves(true);
    const disconnectStub = sandbox.stub(p.producer, 'disconnect');
    await p.stop();
    expect(disconnectStub.callCount).to.equal(1);
  });

  it('should terminate cleanly if the producer is not connected', async () => {
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
    const disconnectStub = sandbox.spy(p.producer, 'disconnect');
    await p.stop();
    expect(disconnectStub.callCount).to.equal(0);
  });

});
