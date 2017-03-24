import { expect } from 'chai';
import Registry from '../src/registry';

describe('Registry', () => {
  let registry;
  const registeredTasks = {};
  beforeEach(() => {
    registry = Registry(registeredTasks);
  });
  it('should add new tasks', () => {
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    });
    expect(Object.keys(registeredTasks).length).to.equal(1);
  });

  it('should not duplicate tasks', () => {
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    });
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    });
    expect(Object.keys(registeredTasks).length).to.equal(1);
  });

  it('should remove tasks', () => {
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    });
    registry.removeTask({
      topic: 'hello',
      subscribe: () => {},
    });
    expect(Object.keys(registeredTasks).length).to.equal(0);
  });
});
