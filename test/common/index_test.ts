/* eslint-disable no-underscore-dangle */
import { expect } from 'chai';
import NULL_LOGGER from 'null-logger';
import sinon from 'sinon';
import Steveo from '../../src';
import DummyProducer from '../../src/producer/dummy';

describe('Index', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  it('handles registering tasks', async () => {
    const steveo = Steveo({ engine: 'dummy' }, NULL_LOGGER, {})();
    const dummy = new DummyProducer({}, steveo.registry, NULL_LOGGER);
    const initializeStub = sandbox.stub(dummy, 'initialize').resolves();
    steveo._producer = dummy;
    await steveo.registerTopic('TEST_TOPIC');
    expect(steveo.registry.topics.size).to.equal(1);
    expect(initializeStub.calledOnce).to.equal(true);
  });
  it('handles registering topics', async () => {
    const steveo = Steveo({ engine: 'dummy' }, NULL_LOGGER, {})();
    const registryStub = sandbox.stub(steveo.registry, 'addNewTask').resolves();
    steveo.task('TEST_TOPIC', () => {});
    expect(registryStub.calledOnce).to.equal(true);
  });
  it('handles publishing topics', async () => {
    const steveo = Steveo({ engine: 'dummy' }, NULL_LOGGER, {})();
    const dummy = new DummyProducer({}, steveo.registry, NULL_LOGGER);
    const initializeStub = sandbox.stub(dummy, 'initialize').resolves();
    steveo._producer = dummy;
    await steveo.publish('TEST_TOPIC', {});
    expect(initializeStub.calledOnce).to.equal(true);
  });
});
