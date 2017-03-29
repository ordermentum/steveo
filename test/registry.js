import { expect } from 'chai';
import Registry from '../src/registry';
import C from '../src/constants';

describe('Registry', () => {
  let registry;
  let runner;
  beforeEach(() => {
    registry = Registry();
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
    await registry.addNewTask({
      topic: 'hello',
      subscribe: () => {},
    }, runner);
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

  it('should have NOOP success & failure callbacks if not defined', () => {
    const reg = Registry({});
    expect(reg.successCallback).to.deep.equal(C.NOOP);
    expect(reg.failureCallback).to.deep.equal(C.NOOP);
  });

  it('should have success & failure callbacks if  defined', () => {
    const reg = Registry({ success: C.NOOP, failure: C.NOOP });
    expect(reg.successCallback).to.deep.equal(C.NOOP);
    expect(reg.failureCallback).to.deep.equal(C.NOOP);
  });
});
