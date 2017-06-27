import { expect } from 'chai';
import sinon from 'sinon';

import Runner from '../../src/runner/sqs';
import Registry from '../../src/registry';
import sqsConf from '../../src/config/sqs';

describe('SQS Runner', () => {
  let runner;
  let registry;
  beforeEach(() => {
    registry = new Registry({ publishCallback: {
      events: {
        emit: sinon.stub(),
      },
    } });
    runner = new Runner({}, registry, console);
  });

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.process).to.equal('function');
  });

  it('should invoke callback when receives a message on topic', async () => {
    const subscribeStub = sinon.stub().resolves({ some: 'success' });
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sinon.stub(),
      },
    };
    const deleteMessageStub = sinon.stub().resolves();
    sinon.stub(sqsConf, 'sqs').returns({
      deleteMessageAsync: deleteMessageStub,
    });
    const anotherRunner = new Runner({}, anotherRegistry, console);
    await anotherRunner.receive(([{ Body: JSON.stringify({ data: 'Hello' }) }, { Body: JSON.stringify({ data: 'World' }) }]), 'a-topic');
    expect(subscribeStub.callCount).to.equal(2);
    expect(deleteMessageStub.callCount).to.equal(2);
    sqsConf.sqs.restore();
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const subscribeStub = sinon.stub().throws({ some: 'error' });
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sinon.stub(),
      },
    };
    const deleteMessageStub = sinon.stub().resolves();
    sinon.stub(sqsConf, 'sqs').returns({
      deleteMessageAsync: deleteMessageStub,
    });
    const anotherRunner = new Runner({}, anotherRegistry, console);
    let error = false;
    try {
      await anotherRunner.receive(([{ Body: JSON.stringify({ data: 'Hello' }) }, { Body: JSON.stringify({ data: 'World' }) }]), 'a-topic');
    } catch (ex) {
      error = true;
      expect(subscribeStub.callCount).to.equal(1);
      expect(deleteMessageStub.callCount).to.equal(0);
    }
    expect(error);
    sqsConf.sqs.restore();
  });
});
