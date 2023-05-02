/* eslint-disable no-underscore-dangle */
import { expect } from 'chai';
import NULL_LOGGER from 'null-logger';
import sinon from 'sinon';
import create, { Steveo } from '../../src';
import DummyProducer from '../../src/producers/dummy';

describe('Index', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('handles registering tasks', async () => {
    // @ts-ignore
    const steveo = create({ engine: 'dummy' }, NULL_LOGGER, {});
    // @ts-ignore
    const dummy = new DummyProducer({}, steveo.registry, NULL_LOGGER);
    const initializeStub = sandbox.stub(dummy, 'initialize').resolves();
    steveo._producer = dummy;
    await steveo.registerTopic('TEST_TOPIC', 'TEST_TOPIC');
    expect(steveo.registry.items.size).to.equal(1);
    expect(initializeStub.calledOnce).to.equal(true);
  });
  it('handles registering topics', async () => {
    // @ts-ignore
    const steveo = create({ engine: 'dummy' }, NULL_LOGGER, {});
    const registryStub = sandbox.stub(steveo.registry, 'addNewTask').resolves();
    steveo.task('TEST_TOPIC', () => {});
    expect(registryStub.calledOnce).to.equal(true);
  });
  it('handles publishing topics', async () => {
    // @ts-ignore
    const steveo = create({ engine: 'dummy' }, NULL_LOGGER, {});
    steveo.registry.addTopic('TEST_TOPIC');
    // @ts-ignore
    const dummy = new DummyProducer({}, steveo.registry, NULL_LOGGER);
    const sendStub = sandbox.stub(dummy, 'send').resolves();
    steveo._producer = dummy;
    await steveo.publish('TEST_TOPIC', {});
    expect(sendStub.calledOnce).to.equal(true);
  });

  it('handles publishing to named topics', async () => {
    // @ts-ignore
    const steveo = create({ engine: 'dummy' }, NULL_LOGGER, {});
    steveo.registry.addTopic('TEST_TOPIC', 'PRODUCTION_TEST_TOPIC');
    // @ts-ignore
    const dummy = new DummyProducer({}, steveo.registry, NULL_LOGGER);
    const sendStub = sandbox.stub(dummy, 'send').resolves();
    steveo._producer = dummy;
    await steveo.publish('TEST_TOPIC', { hello: 'world' });
    expect(sendStub.calledOnce).to.equal(true);
    expect(
      sendStub.calledWith('PRODUCTION_TEST_TOPIC', { hello: 'world' })
    ).to.equal(true);
  });

  describe('lifecycle methods', () => {
    it('terminates', async () => {
      const disconnectStub = sandbox
        // @ts-ignore
        .stub(Steveo.prototype, 'disconnect')
        .resolves();
      const steveo = create(
        // @ts-ignore
        {
          engine: 'dummy',
          tasksPath: __filename,
        },
        NULL_LOGGER,
        {}
      );
      await steveo.terminate();
      expect(steveo.exiting).to.equal(true);
      expect(disconnectStub.callCount).to.eqls(1);
    });

    it('pause and resume', async () => {
      const steveo = create(
        // @ts-ignore
        {
          engine: 'dummy',
          tasksPath: __filename,
        },
        NULL_LOGGER,
        {}
      );

      const pause = sandbox.stub().resolves();
      const resume = sandbox.stub().resolves();
      // @ts-ignore
      steveo._runner = {
        pause,
        resume,
      };

      await steveo.pause();
      expect(pause.callCount).to.eqls(1);
      await steveo.resume();
      expect(resume.callCount).to.eqls(1);
    });
  });
});
