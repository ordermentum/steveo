import { expect } from 'chai';
import uuid from 'uuid';
import kafka from 'no-kafka';
import sinon from 'sinon';

import Runner from '../src/runner';

describe('Runner', () => {
  const runner = Runner({
    clientId: uuid.v4(),
    kafkaCodec: kafka.COMPRESSION_GZIP,
    kafkaGroupId: '123',
    logLevel: 1,
    kafkaSendAttempts: 1,
    kafkaSendDelayMin: 100,
    kafkaSendDelayMax: 300,
  }, {}, console);
  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.send).to.equal('function');
    expect(typeof runner.receive).to.equal('function');
  });

  it('should send a payload to kafka', async () => {
    const sendStub = sinon.stub(runner.kafkaClient.producer, 'send').returns(Promise.resolve());
    await runner.send('hello', { pay: 'load' });
    expect(sendStub.callCount).to.equal(1);
    runner.kafkaClient.producer.send.restore();
  });

  it('should log if a payload failed to send to kafka', async () => {
    const sendStub = sinon.stub(runner.kafkaClient.producer, 'send').returns(Promise.reject({ error: 'happened' }));
    let err = false;
    try {
      await runner.send('hello', { pay: 'load' });
    } catch (ex) {
      err = true;
      expect(sendStub.callCount).to.equal(1);
    }
    expect(err);
    runner.kafkaClient.producer.send.restore();
  });

  it('should initialize consumer', () => {
    const initStub = sinon.stub(runner.kafkaClient.consumer, 'init').returns(Promise.resolve({ yeah: 'created' }));
    runner.initializeConsumer(['test-topic']);
    expect(initStub.callCount).to.equal(1);
    runner.kafkaClient.consumer.init.restore();
  });

  it('should invoke callback when receives a message on topic', async () => {
    const registry = {
      'a-topic': {
        publish: () => {},
        subscribe: sinon.stub().returns(Promise.resolve()),
      },
    };
    const anotherRunner = Runner({
      clientId: uuid.v4(),
      kafkaCoded: kafka.COMPRESSION_GZIP,
      kafkaGroupId: '123',
      logLevel: 1,
    }, registry, console);
    await anotherRunner.receive({ it: 'is a payload' }, 'a-topic');
    expect(registry['a-topic'].subscribe.callCount).to.equal(1);
    expect(registry['a-topic'].subscribe.calledWith({ it: 'is a payload' }));
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const registry = {
      'a-topic': {
        publish: () => {},
        subscribe: sinon.stub().returns(Promise.reject({ some: 'error' })),
      },
    };
    const anotherRunner = Runner({
      clientId: uuid.v4(),
      kafkaCodec: kafka.COMPRESSION_GZIP,
      kafkaGroupId: '123',
      logLevel: 1,
    }, registry, console);
    let error = false;
    try {
      await anotherRunner.receive({ it: 'is a payload' }, 'a-topic');
    } catch (ex) {
      error = true;
      expect(registry['a-topic'].subscribe.callCount).to.equal(1);
      expect(registry['a-topic'].subscribe.calledWith({ it: 'is a payload' }));
    }
    expect(error);
  });
});
