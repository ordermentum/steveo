import { expect } from 'chai';
import sinon from 'sinon';
import Registry from '../../src/runtime/registry';

describe('Registry', () => {
  let registry: Registry;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    registry = new Registry();
    sandbox = sinon.createSandbox();
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

  it('call emit', async () => {
    const stub = sandbox.stub(registry.events, 'emit');
    registry.emit('test');
    expect(stub.calledOnce).to.be.true;
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
      options: {
        attributes: [
          {
            name: 'An Attribute',
            dataType: 'string',
            value: 'aaaaa',
          },
        ],
      },
    });

    expect(registry.getTopics().length).to.equal(1);
    expect(registry.getTask('hello')?.name).to.equal('hello');
    expect(registry.items.size).to.equal(1);
    expect(registry.items.has('hello')).to.equal(true);
    expect(registry.getTask('hello')?.options?.attributes).to.deep.equal([
      { name: 'An Attribute', dataType: 'string', value: 'aaaaa' },
    ]);
  });
});
