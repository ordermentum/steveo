import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../src/producer';
import Registry from '../src/registry';

describe('Producer', () => {
  it.skip('should integrate', async () => {
    // Integration test that doesn't stub the SQS process so it should actually create a queue and send a message
    const registry = new Registry();
    const p = Producer({}, registry, console);
    const sendStub = sinon.stub(p.producer, 'send').returns(Promise.resolve());
    await p.initialize();
    await p.send('oh-hey-SQS-what-is-up', { a: 'I AM A PAYLOAD' });
  });

  it('should initialize', async () => {
    const registry = new Registry();
    const p = Producer({}, registry, console);
    const initStub = sinon.stub(p.producer, 'init').returns(Promise.resolve());
    await p.initialize();
    expect(initStub.callCount).to.equal(1);
  });

  it('should send', async () => {
    const registry = new Registry();
    const p = Producer({}, registry, console);
    const sendStub = sinon.stub(p.producer, 'send').returns(Promise.resolve());
    const sendStubSqs = sinon.stub(p.sqs, 'sendMessage').callsArg(1);
    await p.send('test-topic', { a: 'payload' });
    expect(sendStub.callCount).to.equal(1);
    expect(sendStubSqs.callCount).to.equal(1);
    sendStubSqs.restore();
  });

  it('should logg error on failure', async () => {
    const registry = new Registry();
    const p = Producer({}, registry, console);
    const sendStub = sinon.stub(p.producer, 'send').returns(Promise.reject());
    const sendStubSqs = sinon.stub(p.sqs, 'sendMessage').callsArg(1);
    let err;
    try {
      await p.send('test-topic', { a: 'payload' });
    } catch (ex) {
      err = true;
      expect(sendStub.callCount).to.equal(1);
    }
    expect(err).to.equal(true);
    sendStubSqs.restore();
  });
});
