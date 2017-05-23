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
    await p.initialize();
  });

  it('should send', async () => {
    const registry = new Registry();
    const p = Producer({}, registry, console);
    const sendStubSqs = sinon.stub(p.sqs, 'sendMessage').callsArg(1);
    await p.send('test-topic', { a: 'payload' });
    expect(sendStubSqs.callCount).to.equal(1);
    sendStubSqs.restore();
  });

  it('should log error on failure', async () => {
    const registry = new Registry();
    const p = Producer({}, registry, console);
    const sendStubSqs = sinon.stub(p.sqs, 'sendMessage').callsArgWith(1, new Error('ohai'));
    let err;
    try {
      await p.send('test-topic', { a: 'payload' });
    } catch (ex) {
      err = true;
      expect(sendStubSqs.callCount).to.equal(1);
    }
    expect(err).to.equal(true);
    sendStubSqs.restore();
  });
});
