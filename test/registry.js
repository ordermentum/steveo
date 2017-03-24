import { expect } from 'chai';
import sinon from 'sinon';
import Registry from '../src/registry';

describe('Registry', () => {
  let registry;
  const registeredTasks = {};
  let runner;
  beforeEach(() => {
    registry = Registry(registeredTasks);
    runner = {
      initializeConsumer: sinon.stub(),
    };
  });

  it('should add new tasks', () => {
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    expect(Object.keys(registeredTasks).length).to.equal(1);
    expect(runner.initializeConsumer.callCount).to.equal(1);
  });

  it('should not duplicate tasks', () => {
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    expect(Object.keys(registeredTasks).length).to.equal(1);
    expect(runner.initializeConsumer.callCount).to.equal(2);
  });

  it('should remove tasks', () => {
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    registry.removeTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    expect(Object.keys(registeredTasks).length).to.equal(0);
    expect(runner.initializeConsumer.callCount).to.equal(2);
  });
});
