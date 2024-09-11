import { expect } from 'chai';
import sinon from 'sinon';
import { NullLogger } from 'null-logger';
import { DummyConfiguration, Steveo, Storage } from '../../src/index';

// Workflow integration tests
describe('Workflow tests', () => {
  const dummy: DummyConfiguration = { engine: 'dummy' };
  const storage = sinon.createStubInstance(Storage);
  const steveo = new Steveo(dummy, new NullLogger(), storage);

  beforeEach(() => {
    sinon.reset();
  });

  test('should execute flow of two steps', async done => {
    const finalMock = sinon.spy();
    const flow = steveo
      .flow('test-workflow')
      .next({
        trigger: 'test-workflow.step1-task',
        execute: (payload: { customerId: string }) =>
          // Demonstrating result augmentation
          ({
            final: 'xyz',
            ...payload,
          }),
      })
      .next({
        trigger: 'test-workflow.step2-task',
        execute: () => {
          finalMock();
        },
      });

    await flow.publish({ order: 123 });

    await steveo.runner().process();

    setTimeout(() => {
      expect(finalMock.callCount).eq(1);
      done();
    }, 100);
  });
});
