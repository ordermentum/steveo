import { expect } from 'chai';
import sinon from 'sinon';

import { build } from '../../src/lib/pool';
import Runner from '../../src/consumers/redis';
import Registry from '../../src/registry';
import redisConf from '../../src/config/redis';

describe('runner/redis', () => {
  let runner;
  let registry;
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    registry = new Registry();

    const steveo = {
      // @ts-ignore
      config: {},
      registry,
      pool: build(),
    };
    // @ts-ignore
    runner = new Runner(steveo);
  });
  afterEach(() => sandbox.restore());
  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.process).to.equal('function');
  });

  it('should invoke callback when receives a message on topic', async () => {
    const subscribeStub = sandbox.stub().resolves({ some: 'success' });
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
    const deleteMessageStub = sandbox.stub().resolves();
    sandbox.stub(redisConf, 'redis').returns({
      deleteMessageAsync: deleteMessageStub,
    });

    const steveo = {
      // @ts-ignore
      config: {},
      // @ts-ignore
      registry: anotherRegistry,
      pool: build(),
    };

    // @ts-ignore
    const anotherRunner = new Runner(steveo);
    await anotherRunner.receive(
      [
        { message: JSON.stringify({ data: 'Hello' }) },
        { message: JSON.stringify({ data: 'World' }) },
      ],
      'a-topic'
    );
    expect(subscribeStub.callCount).to.equal(2);
    expect(deleteMessageStub.callCount).to.equal(2);
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const subscribeStub = sandbox.stub().throws({ some: 'error' });
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
    const deleteMessageStub = sandbox.stub().resolves();
    sandbox.stub(redisConf, 'redis').returns({
      deleteMessageAsync: deleteMessageStub,
    });
    const steveo = {
      // @ts-ignore
      config: {},
      // @ts-ignore
      registry: anotherRegistry,
      pool: build(),
    };
    // @ts-ignore
    const anotherRunner = new Runner(steveo);
    let error = false;
    try {
      await anotherRunner.receive(
        [
          { Body: JSON.stringify({ data: 'Hello' }) },
          { Body: JSON.stringify({ data: 'World' }) },
        ],
        'a-topic'
      );
    } catch (ex) {
      error = true;
      expect(subscribeStub.callCount).to.equal(1);
      expect(deleteMessageStub.callCount).to.equal(0);
    }
    expect(error);
  });
});
