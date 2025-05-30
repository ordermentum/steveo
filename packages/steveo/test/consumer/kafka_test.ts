import { expect } from 'chai';
import sinon from 'sinon';
import { randomUUID } from 'crypto';
import Runner from '../../src/consumers/kafka';
import { build } from '../../src/lib/pool';
import Registry from '../../src/runtime/registry';
import { getContext } from '../../src/lib/context';
import { KafkaMessageRoutingOptions } from '../../lib/common';

describe('runner/kafka', () => {
  let sandbox;
  let runner;
  let registry;
  let clock: sinon.SinonFakeTimers;

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
    clock = sinon.useFakeTimers({
      now: 0,
    });
  });

  afterEach(() => {
    clock.restore();
    sandbox.restore();
  });

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
      emit: sandbox.stub(),
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
      // @ts-ignore
      pool: build(anotherRegistry),
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

  it('should invoke callback when with context if context present in message', async () => {
    const subscribeStub = sinon
      .stub()
      .returns(Promise.resolve({ some: 'success' }));
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
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
      // @ts-ignore
      pool: build(anotherRegistry),
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);
    const commitOffsetStub = sandbox.stub(
      anotherRunner.consumer,
      'commitMessage'
    );
    const expectedPayload: any = { attr: 'value' };
    const messageContext: KafkaMessageRoutingOptions = { key: 'context' };
    const messagePayload: Buffer = Buffer.from(
      JSON.stringify({ ...expectedPayload, _meta: messageContext })
    );
    await anotherRunner.receive({
      value: messagePayload,
      size: 1000,
      offset: 0,
      topic: 'a-topic',
      partition: 1,
    });
    const expectedContext: any = {
      duration: 0,
      ...messageContext,
    };
    sinon.assert.called(commitOffsetStub);
    sinon.assert.calledWith(
      subscribeStub,
      { ...expectedPayload, value: expectedPayload },
      expectedContext
    );
  });

  it('should not commit when the subsribe fails and wait to commit config is true', async () => {
    const subscribeStub = sinon.stub().rejects();
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
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
      registry: anotherRegistry,
      // @ts-ignore
      pool: build(anotherRegistry),
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
        subscribe: sandbox.stub().rejects({ some: 'error' }),
      }),
      emit: sandbox.stub(),
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
      // @ts-ignore
      pool: build(anotherRegistry),
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);
    const stub = sandbox
      .stub(anotherRunner.consumer, 'commitMessage')
      .throws({ some: 'error' });

    await anotherRunner.receive({
      value: Buffer.from(
        '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D'
      ),
      size: 1000,
      offset: 0,
      topic: 'a-topic',
      partition: 1,
    });
    expect(stub.called).to.be.true;
  });

  it('should not process a message when the instance in paused mode', async () => {
    const subscribeStub = sinon.stub().rejects();
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
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
      registry: anotherRegistry,
      // @ts-ignore
      pool: build(anotherRegistry),
      manager: {
        state: 'running',
      },
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);

    // Pausing the steveo instance
    anotherRunner.state = 'paused';

    const commitOffsetStub = sandbox.stub(
      anotherRunner.consumer,
      'commitMessage'
    );
    await anotherRunner.consumeCallback(null, [
      {
        value: Buffer.from(
          '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D'
        ),
        size: 1000,
        offset: 0,
        topic: 'a-topic',
        partition: 1,
      },
    ]);
    expect(commitOffsetStub.callCount).to.equal(0);
    expect(subscribeStub.callCount).to.equal(0);
  });

  it('should process a message', async () => {
    const subscribeStub = sinon.stub().rejects();
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
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
      registry: anotherRegistry,
      // @ts-ignore
      pool: build(anotherRegistry),
      manager: {
        state: 'running',
      },
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);

    sandbox.stub(anotherRunner.consumer, 'commitMessage');

    const jobId = randomUUID();
    const messageData = {
      message: 'test runner',
    };
    const messageContext = {
      jobId,
    };

    const messagePayload = { ...messageData, _meta: messageContext };
    await anotherRunner.consumeCallback(null, [
      {
        value: JSON.stringify(messagePayload),
        size: 1000,
        offset: 0,
        topic: 'a-topic',
        partition: 1,
      },
    ]);

    expect(subscribeStub.called).to.be.true;
    const data = subscribeStub.args[0][0];
    const context = subscribeStub.args[0][1];
    expect(data, 'expected data').to.deep.equals({
      ...messageData,
      value: messageData,
    });
    const expectedContext = getContext(messagePayload);
    expect(context, 'expected context').to.deep.equals(expectedContext);
  });

  it('should unpack message value before forward payload to middleware', async () => {
    const subscribeStub = sinon.stub();
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
      events: {
        emit: sandbox.stub(),
      },
    };
    const messagePayload: Record<string, string> = {
      my: 'payload',
    };
    let receivedContext: Record<string, string> = {};
    const steveo = {
      config: {
        bootstrapServers: 'kafka:9200',
        engine: 'kafka',
        securityProtocol: 'plaintext',
        waitToCommit: true,
        middleware: [
          {
            publish: () => {},
            consume: context => {
              receivedContext = context.payload;
            },
          },
        ],
      },
      registry: anotherRegistry,
      // @ts-ignore
      pool: build(anotherRegistry),
      manager: {
        state: 'running',
      },
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);

    sandbox.stub(anotherRunner.consumer, 'commitMessage');

    await anotherRunner.consumeCallback(null, [
      {
        value: JSON.stringify(messagePayload),
        size: 1000,
        offset: 0,
        topic: 'a-topic',
        partition: 1,
      },
    ]);
    expect(messagePayload).to.be.deep.equal(receivedContext);
  });

  it('calculates duration of a task run correctly', async () => {
    clock.restore();
    const startMs = Date.now();
    const subscribeStub = sinon
      .stub()
      .returns(Promise.resolve({ some: 'success' }));
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      emit: sandbox.stub(),
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
      // @ts-ignore
      pool: build(anotherRegistry),
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);
    const commitOffsetStub = sandbox.stub(
      anotherRunner.consumer,
      'commitMessage'
    );
    const expectedPayload: any = { attr: 'value' };
    const messageContext = { key: 'context', startMs };
    const messagePayload: Buffer = Buffer.from(
      JSON.stringify({ ...expectedPayload, _meta: messageContext })
    );

    // Wait a second to avoid flakiness
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });

    await anotherRunner.receive({
      value: messagePayload,
      size: 1000,
      offset: 0,
      topic: 'a-topic',
      partition: 1,
    });
    sinon.assert.called(commitOffsetStub);

    // Greater than or equal to 1 second and less than a reasonable 15 seconds, as the test runs in a few milliseconds
    // To catch calculation errors
    // Note: Duration is in milliseconds
    expect(subscribeStub.args[0][1].duration)
      .to.be.greaterThanOrEqual(1000)
      .lessThan(15000);
  });
});
