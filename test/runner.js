import { expect } from 'chai';
import sinon from 'sinon';

import Runner from '../src/runner';
import Registry from '../src/registry';

describe('Runner', () => {
  let runner;
  let registry;
  beforeEach(() => {
    registry = Registry({ publishCallback: {
      events: {
        emit: sinon.stub(),
      },
    } });
    runner = Runner({
    }, registry, console);
  });

  it.skip('should integrate', async () => {
    // Integration test that actually polls an SQS queue
    const subscribeStub = sinon.stub().returns(Promise.resolve({ some: 'success' }));
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sinon.stub(),
      },
      getTopics: () => ['test-topic'],
    };

    const anotherRunner = Runner({
    }, anotherRegistry, console);

    await anotherRunner.process()
  });

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.process).to.equal('function');
  });

  it('should invoke callback when receives a message on topic', async () => {
    const subscribeStub = sinon.stub().returns(Promise.resolve({ some: 'success' }));
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sinon.stub(),
      },
    };
    const anotherRunner = Runner({
    }, anotherRegistry, console);
    const messageDeletionStub = sinon.stub(anotherRunner.sqs, 'deleteMessage').callsArg(1);
    await anotherRunner.receive([
      { Body: '{"oh": "hai"}', ReceiptHandle: 'wut' },
      { Body: '{"oh": "hai"}', ReceiptHandle: 'wut' },
    ], 'a-topic');
    expect(messageDeletionStub.callCount).to.equal(2);
    expect(subscribeStub.callCount).to.equal(2);
    messageDeletionStub.restore();
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const subscribeStub = sinon.stub().returns(Promise.reject({ some: 'error' }));
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: subscribeStub,
      }),
      events: {
        emit: sinon.stub(),
      },
      getTopics: () => ['test-topic'],
    };
    const anotherRunner = Runner({
    }, anotherRegistry, console);
    let error = false;
    const messageDeletionStub = sinon.stub(anotherRunner.sqs, 'deleteMessage').callsArg(1);
    try {
      await anotherRunner.receive([
        { Body: '{"oh": "hai"}', ReceiptHandle: 'wut' },
      ], 'a-topic');
    } catch (ex) {
      error = true;
    }
    expect(error);
    expect(subscribeStub.callCount).to.equal(1);
    expect(messageDeletionStub.callCount).to.equal(1);
    messageDeletionStub.restore();
  });
});
