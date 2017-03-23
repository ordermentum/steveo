import { expect } from 'chai';
import uuid from 'uuid';
import kafka from 'no-kafka';
import sinon from 'sinon';

import Runner from '../src/runner';

describe('Runner', () => {
  const runner = Runner({
    CLIENT_ID: uuid.v4(),
    KAFKA_CODEC: kafka.COMPRESSION_GZIP,
    KAFKA_GROUP_ID: '123',
    LOG_LEVEL: 1,
  }, {}, console);
  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.send).to.equal('function');
    expect(typeof runner.receive).to.equal('function');
  });

  it('should send a payload to kafka', () => {
    const sendStub = sinon.stub(runner.kafkaClient.producer, 'send').returns(Promise.resolve());
    runner.send('hello', { pay: 'load' });
    expect(sendStub.callCount).to.equal(1);
    runner.kafkaClient.producer.send.restore();
  });

  it('should log if a payload failed to send to kafka', () => {
    const sendStub = sinon.stub(runner.kafkaClient.producer, 'send').returns(Promise.reject({ error: 'happened' }));
    let err = false;
    try {
      runner.send('hello', { pay: 'load' });
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

  it('should invoke callback when receives a message on topic', () => {
    const registry = {
      'a-topic': {
        publish: () => {},
        subscribe: sinon.stub(),
      },
    };
    const anotherRunner = Runner({
      CLIENT_ID: uuid.v4(),
      KAFKA_CODEC: kafka.COMPRESSION_GZIP,
      KAFKA_GROUP_ID: '123',
      LOG_LEVEL: 1,
    }, registry, console);
    anotherRunner.receive({ it: 'is a payload' }, 'a-topic');
    expect(registry['a-topic'].subscribe.callCount).to.equal(1);
    expect(registry['a-topic'].subscribe.calledWith({ it: 'is a payload' }));
  });
});
