import { expect } from 'chai';
import { DummyConfiguration, Steveo, Storage, WorkflowStateRepository } from '../../src/index';
import sinon from 'sinon';
import { NullLogger } from 'null-logger';

// Workflow integration tests
describe('Workflow tests', () => {
  const dummy: DummyConfiguration = { engine: 'dummy' };
  const storage = sinon.createStubInstance(Storage);
  const steveo = new Steveo(dummy, new NullLogger(), storage);

  beforeEach(() => {
    sinon.reset();
  })

  test('should execute flow of two steps', async (done) => {
    const finalMock = sinon.spy();
    const flow = steveo
      .flow('test-workflow')
      .next({ trigger: 'test-workflow.step1-task', execute: (payload: { customerId: string }) => {
        // Demonstrating result augmentation
        return {
          final: 'xyz',
          ...payload
        };
      } })
      .next({ trigger: 'test-workflow.step2-task', execute: () => {
        finalMock();
      } })

    await flow.publish({ order: 123 });

    await steveo.runner().process();

    setTimeout(() => {
      expect(finalMock.callCount).eq(1);
      done();
    }, 100);
  });

  test('', async () => {

  });

  test('', async () => {

  });

  test('', async () => {

  });

});

