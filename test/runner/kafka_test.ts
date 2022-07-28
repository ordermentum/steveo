import { expect } from 'chai';
import sinon from 'sinon';

import Runner from '../../src/runner/kafka';
import { build } from '../../src/base/pool';
import Registry from '../../src/registry';

describe('Runner', () => {
  let sandbox;
  let runner;
  let registry;
  beforeEach(() => {
    registry = new Registry();
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
    });

    const steveo = {
      // @ts-ignore
      config: {
        bootstrapServers: 'kafka:9200',
        engine: 'kafka',
        securityProtocol: 'plaintext',
      },
      registry,
    };
    // @ts-ignore
    runner = new Runner(steveo);
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.process).to.equal('function');
  });

  it('should initialize consumer, subscribe and consume the first message', async () => {
    const initStub = sinon
      .stub(runner.consumer, 'connect')
      .callsArgWith(1, null);
    sinon.stub(runner.consumer, 'on').callsArgWith(1, 'ready', null, null);
    const subscribeStub = sinon.stub(runner.consumer, 'subscribe').returns({});
    const consumeStub = sinon.stub(runner.consumer, 'consume').returns({});
    await runner.process(['test-topic']);
    expect(initStub.callCount).to.equal(1);
    expect(subscribeStub.callCount).to.equal(1);
    expect(consumeStub.callCount).to.equal(1);
    expect(subscribeStub.args[0][0]).to.eqls(['test-topic']);
    expect(consumeStub.args[0][0]).to.eqls(1);
  });

  it('should invoke callback when receives a message on topic', async () => {
    const subscribeStub = sinon
      .stub()
      .returns(Promise.resolve({ some: 'success' }));
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sandbox.stub(),
      },
    };
    const steveo = {
      config: {
        bootstrapServers: 'kafka:9200',
        engine: 'kafka',
        securityProtocol: 'plaintext',
      },
      // @ts-ignore
      registry: anotherRegistry,
      pool: build(),
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);
    const commitOffsetStub = sandbox.stub(
      anotherRunner.consumer,
      'commitMessage'
    );
    await anotherRunner.receive({
      value: Buffer.from(
        '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D'
      ),
      size: 1000,
      offset: 0,
      topic: 'a-topic',
      partition: 1,
    });
    expect(commitOffsetStub.callCount).to.equal(1);
    expect(subscribeStub.callCount).to.equal(1);
  });

  it('should not commit when the subsribe fails and wait to commit config is true', async () => {
    const subscribeStub = sinon.stub().rejects();
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sandbox.stub(),
      },
    };

    const steveo = {
      config: {
        bootstrapServers: 'kafka:9200',
        engine: 'kafka',
        securityProtocol: 'plaintext',
        waitToCommit: true,
      },
      // @ts-ignore
      registry: anotherRegistry,
      pool: build(),
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);
    const commitOffsetStub = sandbox.stub(
      anotherRunner.consumer,
      'commitMessage'
    );
    await anotherRunner.receive({
      value: Buffer.from(
        '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D'
      ),
      size: 1000,
      offset: 0,
      topic: 'a-topic',
      partition: 1,
    });
    expect(commitOffsetStub.callCount).to.equal(0);
    expect(subscribeStub.callCount).to.equal(1);
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: sandbox.stub().returns(Promise.reject({ some: 'error' })),
      }),
      events: {
        emit: sandbox.stub(),
      },
    };
    const steveo = {
      config: {
        bootstrapServers: 'kafka:9200',
        engine: 'kafka',
        securityProtocol: 'plaintext',
      },
      registry: anotherRegistry,
      pool: build(),
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);
    let error = false;
    let commitOffsetStub;
    try {
      commitOffsetStub = sandbox.stub(anotherRunner.consumer, 'commitMessage');
      await anotherRunner.receive({
        value: Buffer.from(
          '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D'
        ),
        size: 1000,
        offset: 0,
        topic: 'a-topic',
        partition: 1,
      });
    } catch (ex) {
      error = true;
      expect(commitOffsetStub.getTask().callCount).to.equal(1);
    }
    expect(error);
  });
});
