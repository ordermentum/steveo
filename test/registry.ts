import { expect } from 'chai';
import Registry from '../src/registry';

describe('Registry', () => {
  let registry;
  let runner;
  beforeEach(() => {
    registry = new Registry();
  });

  it('should add new tasks', () => {
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    });

    expect(registry.getTopics().length).to.equal(1);
    expect(registry.getTask('hello').topic).to.equal('hello');
  });

  it('should not duplicate tasks', async () => {
    await registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    });
    await registry.addNewTask(
      {
        topic: 'hello',
        subscribe: () => {},
      },
      runner
    );
    expect(registry.getTopics().length).to.equal(1);
  });

  it('should remove tasks', async () => {
    await registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    });
    await registry.removeTask({
      topic: 'hello',
      subscribe: () => {},
    });
    expect(registry.getTopics().length).to.equal(0);
  });

  it('should add new tasks with attributes', () => {
    registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
      attributes: [
        {
          name: 'An Attribute',
          dataType: 'string',
          value: 'aaaaa',
        },
      ],
    });

    expect(registry.getTopics().length).to.equal(1);
    expect(registry.getTask('hello').topic).to.equal('hello');
    expect(registry.getTask('hello').attributes).to.deep.equal([
      { name: 'An Attribute', dataType: 'string', value: 'aaaaa' },
    ]);
  });
});
