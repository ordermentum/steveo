import { expect } from 'chai';
import sinon from 'sinon';
import Task from '../src/task';

describe('Task', () => {
  let registry;
  let task;
  let producer;
  let subscribe;
  let sandbox;

  afterEach(() => sandbox.restore());

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    producer = {
      send: sandbox.stub().resolves(),
      initialize: sandbox.stub().resolves(),
    };
    registry = {
      addNewTask: sandbox.stub(),
      removeTask: sandbox.stub(),
      events: {
        emit: sandbox.stub(),
      },
    };
    subscribe = sandbox.stub();
    task = new Task({}, registry, producer, 'a-simple-task', subscribe);
  });

  it('should create a new task instance', () => {
    expect(typeof task).to.equal('object');
    expect(typeof task.publish).to.equal('function');
    expect(typeof task.subscribe).to.equal('function');
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
    const functionTask = new Task({}, registry, producer, 'test', () => {
      x = 1;
    });

    await functionTask.subscribe({ payload: 'something-big' });
    expect(x).to.equal(1);
  });

  it('should be able to publish with callback on failure', async () => {
    const failureProducer = {
      send: sandbox.stub().throws(),
      initialize: sandbox.stub().resolves(),
    };
    const failTask = new Task(
      {},
      registry,
      failureProducer,
      'a-simple-task',
      subscribe
    );
    let err = false;
    try {
      await failTask.publish([{ payload: 'something-big' }]);
    } catch (ex) {
      expect(failureProducer.send.callCount).to.equal(1);
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
