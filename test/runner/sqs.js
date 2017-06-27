import { expect } from 'chai';
import uuid from 'uuid';
import kafka from 'no-kafka';
import sinon from 'sinon';

import Runner from '../../src/runner/sqs';
import Registry from '../../src/registry';

describe.skip('Runner', () => {
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

  it('should initialize consumer', async () => {
    const initStub = sinon.stub(runner.consumer, 'init').returns(Promise.resolve({ yeah: 'created' }));
    await runner.process(['test-topic']);
    expect(initStub.callCount).to.equal(1);
    runner.consumer.init.restore();
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
    const anotherRunner = new Runner({
      clientId: uuid.v4(),
      kafkaCoded: kafka.COMPRESSION_GZIP,
      kafkaGroupId: '123',
      logLevel: 1,
    }, anotherRegistry, console);
    const commitOffsetStub = sinon.stub(anotherRunner.consumer, 'commitOffset');
    await anotherRunner.receive([{ message: { value: '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D' }, offset: 1 },
    { message: { value: '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D' }, offset: 2 }], 'a-topic', 0);
    expect(commitOffsetStub.callCount).to.equal(2);
    expect(subscribeStub.callCount).to.equal(2);
  });

  it('should invoke capture error when callback throws error on receiving a message on topic', async () => {
    const anotherRegistry = {
      getTask: () => ({
        publish: () => {},
        subscribe: sinon.stub().returns(Promise.reject({ some: 'error' })),
      }),
      events: {
        emit: sinon.stub(),
      },
    };
    const anotherRunner = new Runner({
      clientId: uuid.v4(),
      kafkaCodec: kafka.COMPRESSION_GZIP,
      kafkaGroupId: '123',
      logLevel: 1,
    }, anotherRegistry, console);
    let error = false;
    let commitOffsetStub;
    try {
      commitOffsetStub = sinon.stub(anotherRunner.consumer, 'commitOffset');
      await anotherRunner.receive([{ message: { value: '\x7B\x20\x22\x61\x22\x3A\x20\x22\x31\x32\x33\x22\x20\x7D' }, offset: 1 }], 'a-topic', 0);
    } catch (ex) {
      error = true;
      expect(anotherRegistry.subscribe.callCount).to.equal(1);
      expect(commitOffsetStub.getTask().callCount).to.equal(1);
    }
    expect(error);
  });
});
