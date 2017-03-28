import { expect } from 'chai';
import sinon from 'sinon';
import Task from '../src/task';

describe('Task', () => {
  let registry;
  let task;
  let mockRunner;
  beforeEach(() => {
    mockRunner = {
      send: sinon.stub().returns(Promise.resolve()),
    };
    registry = {
      addNewTask: sinon.stub(),
      removeTask: sinon.stub(),
      successCallback: sinon.stub(),
      failureCallback: sinon.stub(),
    };
    task = Task(registry, mockRunner, console);
  });

  it('should create a new task instance', () => {
    expect(typeof task).to.equal('object');
    expect(typeof task.define).to.equal('function');
    expect(typeof task.publish).to.equal('function');
    expect(typeof task.subscribe).to.equal('function');
  });

  it('should be able to define new task', () => {
    task.define('a-simple-task', () => {});
    expect(registry.addNewTask.callCount).to.equal(1);
  });

  it('should be able to publish', async () => {
    task.define('a-simple-task', () => {});
    await task.publish({ payload: 'something-big' });
    expect(mockRunner.send.callCount).to.equal(1);
  });

  it('should be able to publish with callback on failure', async () => {
    const failureRunner = {
      send: sinon.stub().returns(Promise.reject()),
    };
    const failTask = Task(registry, failureRunner, console);
    failTask.define('a-simple-task', () => {});
    let err = false;
    try {
      await failTask.publish({ payload: 'something-big' });
    } catch (ex) {
      expect(registry.failureCallback.callCount).to.equal(1);
      expect(failureRunner.send.callCount).to.equal(1);
      err = true;
    }
    expect(err).to.equal(true);
  });

  it('should be have subscribe method to invoke', () => {
    const subscribeStub = sinon.stub();
    task.define('a-simple-task', subscribeStub);
    task.subscribe({ payload: 'something-small' });
    expect(subscribeStub.callCount).to.equal(1);
  });
});
