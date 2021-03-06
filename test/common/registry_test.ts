import { expect } from 'chai';
import Registry from '../../src/registry';

describe('Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  it('should add new tasks', () => {
    // @ts-ignore
    registry.addNewTask({
      name: 'hello',
      topic: 'hello',
      subscribe: () => {},
    });

    expect(registry.getTopics().length).to.equal(1);
    expect(registry.getTask('hello')?.name).to.equal('hello');
  });

  it('should not duplicate tasks', async () => {
    // @ts-ignore
    await registry.addNewTask({
      name: 'hello',
      topic: 'hello',
      subscribe: () => {},
    });
    // @ts-ignore
    await registry.addNewTask({
      name: 'hello',
      topic: 'hello',
      subscribe: () => {},
    });
    expect(registry.getTopics().length).to.equal(1);
  });

  it('should remove tasks', async () => {
    // @ts-ignore
    await registry.addNewTask({
      name: 'hello',
      topic: 'hello',
      subscribe: () => {},
    });
    // @ts-ignore
    await registry.removeTask({
      name: 'hello',
      topic: 'hello',
      subscribe: () => {},
    });
    expect(registry.getTopics().length).to.equal(0);
  });

  it('should add new tasks with attributes', () => {
    // @ts-ignore
    registry.addNewTask({
      name: 'hello',
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
    expect(registry.getTask('hello')?.name).to.equal('hello');
    expect(registry.items.size).to.equal(1);
    expect(registry.items.has('hello')).to.equal(true);
    expect(registry.getTask('hello')?.attributes).to.deep.equal([
      { name: 'An Attribute', dataType: 'string', value: 'aaaaa' },
    ]);
  });
});
