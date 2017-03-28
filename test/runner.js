import { expect } from 'chai';
import uuid from 'uuid';
import kafka from 'no-kafka';
import sinon from 'sinon';

import Runner from '../src/runner';

describe('Runner', () => {
  let runner;
  beforeEach(() => {
    runner = Runner({
      clientId: uuid.v4(),
      kafkaCodec: kafka.COMPRESSION_GZIP,
      kafkaGroupId: '123',
      logLevel: 1,
      kafkaSendAttempts: 1,
      kafkaSendDelayMin: 100,
      kafkaSendDelayMax: 300,
      publishCallback: {
        success: sinon.stub(),
        failure: sinon.stub(),
      },
    }, {}, console);
  });

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
    expect(typeof runner.send).to.equal('function');
    expect(typeof runner.receive).to.equal('function');
    expect(typeof runner.initializeConsumer).to.equal('function');
    expect(typeof runner.initializeGroupAdmin).to.equal('function');
    expect(typeof runner.initializeProducer).to.equal('function');
    expect(typeof runner.fetchConsumerLag).to.equal('function');
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

  it('should initialize consumer', async () => {
    const initStub = sinon.stub(runner.kafkaClient.consumer, 'init').returns(Promise.resolve({ yeah: 'created' }));
    await runner.initializeConsumer(['test-topic']);
    expect(initStub.callCount).to.equal(1);
    runner.kafkaClient.consumer.init.restore();
  });

  it('should initialize group admin', async () => {
    const initStub = sinon.stub(runner.kafkaClient.admin, 'init').returns(Promise.resolve({ yeah: 'admin' }));
    await runner.initializeGroupAdmin();
    expect(initStub.callCount).to.equal(1);
    runner.kafkaClient.admin.init.restore();
  });

  it('should initialize producer', async () => {
    const initStub = sinon.stub(runner.kafkaClient.producer, 'init').returns(Promise.resolve({ yeah: 'created' }));
    await runner.initializeProducer();
    expect(initStub.callCount).to.equal(1);
    runner.kafkaClient.producer.init.restore();
  });

  it('should fetch fetchConsumerLag', async () => {
    const fetchConsumerLagStub = sinon.stub(runner.kafkaClient.admin, 'fetchConsumerLag').returns(Promise.resolve({ lag: '0' }));
    await runner.fetchConsumerLag();
    expect(fetchConsumerLagStub.callCount).to.equal(1);
    runner.kafkaClient.admin.fetchConsumerLag.restore();
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
    const commitOffsetStub = sinon.stub(anotherRunner.kafkaClient.consumer, 'commitOffset');
    await anotherRunner.receive([{ message: { value: '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D' } }], 'a-topic', 0);
    expect(commitOffsetStub.callCount).to.equal(1);
    expect(registry['a-topic'].subscribe.callCount).to.equal(1);
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
    let commitOffsetStub;
    try {
      commitOffsetStub = sinon.stub(anotherRunner.kafkaClient.consumer, 'commitOffset');
      await anotherRunner.receive([{ message: { value: '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D' } }], 'a-topic', 0);
    } catch (ex) {
      error = true;
      expect(registry['a-topic'].subscribe.callCount).to.equal(1);
      expect(registry['a-topic'].subscribe.calledWith({ it: 'is a payload' }));
      expect(commitOffsetStub.callCount).to.equal(1);
    }
    expect(error);
  });
});
