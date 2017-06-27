import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producer/sqs';
import Registry from '../../src/registry';
import SqsConf from '../../src/config/sqs';

describe('SQS Producer', () => {
  it('should initialize', async (done) => {
    const registry = new Registry();
    const initStub = sinon.stub(SqsConf, 'sqs').returns({
      createQueue: () => {
        expect(initStub.callCount).to.equal(1);
        done();
      },
    });
    const p = new Producer({}, registry, console);
    await p.initialize('test');
  });

  it('should send', async (done) => {
    const registry = new Registry();

    const p = new Producer({}, registry, console);
    sinon.spy(p, 'getPayload');
    const sendMessageStub = () => {
      expect(p.getPayload.callCount).to.equal(1);
      done();
    };
    p.producer = { sendMessage: sendMessageStub };
    p.sqsUrls = {
      'test-topic': 'dsdfd',
    };
    await p.send('test-topic', { a: 'payload' });
  });
});
