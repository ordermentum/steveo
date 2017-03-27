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
      initializeProducer: sinon.stub(),
      initializeGroupAdmin: sinon.stub(),
    };
  });

  it('should add new tasks', async () => {
    await registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    expect(Object.keys(registeredTasks).length).to.equal(1);
    expect(runner.initializeConsumer.callCount).to.equal(1);
  });

  it('should not duplicate tasks', async () => {
    await registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    await registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    expect(Object.keys(registeredTasks).length).to.equal(1);
    expect(runner.initializeConsumer.callCount).to.equal(2);
  });

  it('should remove tasks', async () => {
    await registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    await registry.removeTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
    expect(Object.keys(registeredTasks).length).to.equal(0);
    expect(runner.initializeConsumer.callCount).to.equal(2);
  });
});
