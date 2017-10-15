import { expect } from 'chai';
import sinon from 'sinon';
import Task from '../src/task';
import BaseProducer from '../src/producer/base';
import Registry from '../src/registry';

describe('Task', () => {
  let registry;
  let task;
  let producer;
  let subscribe;
  let sandbox = null;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    registry = Registry.getInstance();
    producer = new BaseProducer({}, registry);
    producer.send = sandbox.stub().resolves();
    producer.initialize = sandbox.stub().resolves();
    registry.producer = producer;
    sandbox.stub(registry.events, 'emit').resolves();
    subscribe = sandbox.stub();
    task = new Task('a-simple-task', subscribe, registry);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should be able to publish array', async () => {
    await task.publish([{ payload: 'something-big' }]);
    expect(producer.send.callCount).to.equal(1);
    expect(registry.events.emit.callCount).to.equal(1);
  });

  it('should be able to publish object', async () => {
    await task.publish({ payload: 'something-big' });
    expect(producer.send.callCount).to.equal(1);
    expect(registry.events.emit.callCount).to.equal(1);
  });

  it('should accept non-promise methods', async () => {
    let x = null;
    const functionTask = new Task('test', () => {
      x = 1;
    }, registry);

    await functionTask.subscribe({ payload: 'something-big' });
    expect(x).to.equal(1);
  });

  it('should be able to publish with callback on failure', async () => {
    const failureSend = sinon.stub().rejects();
    producer.send = failureSend;
    const failTask = new Task('a-simple-task', subscribe, registry);
    let err = false;
    try {
      await failTask.publish([{ payload: 'something-big' }]);
    } catch (ex) {
      expect(failureSend.callCount).to.equal(1);
      expect(registry.events.emit.callCount).to.equal(1);
      err = true;
    }
    expect(err).to.equal(true);
  });

  it('should have subscribe method to invoke', () => {
    task.subscribe({ payload: 'something-small' });
    expect(subscribe.callCount).to.equal(1);
  });
});
