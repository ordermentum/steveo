import { expect } from 'chai';
import sinon from 'sinon';

import { build } from '../../src/base/pool';
import Runner from '../../src/runner/redis';
import Registry from '../../src/registry';
import redisConf from '../../src/config/redis';

describe('Redis Runner', () => {
  let runner;
  let registry;
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    registry = new Registry();
    runner = new Runner({}, registry, build());
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
      events: {
        emit: sandbox.stub(),
      },
    };
    const deleteMessageStub = sandbox.stub().resolves();
    sandbox.stub(redisConf, 'redis').returns({
      deleteMessageAsync: deleteMessageStub,
    });
    // @ts-ignore
    const anotherRunner = new Runner({}, anotherRegistry, build());
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
      events: {
        emit: sandbox.stub(),
      },
    };
    const deleteMessageStub = sandbox.stub().resolves();
    sandbox.stub(redisConf, 'redis').returns({
      deleteMessageAsync: deleteMessageStub,
    });
    // @ts-ignore
    const anotherRunner = new Runner({}, anotherRegistry, build());
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
