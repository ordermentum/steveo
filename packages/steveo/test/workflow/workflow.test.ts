import { expect } from 'chai';
import { Steveo } from '../../src/index';
import sinon from 'sinon';

// Workflow integration tests
describe('Workflow tests', () => {

  test('should execute flow of two steps', async (done) => {
    //
    const steveo = new Steveo({
      // TODO: SQS to localstack for tests
    });

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

  test('', async () => {

  });

  test('', async () => {

  });

  test('', async () => {

  });

  test('', async () => {

  });

  test('', async () => {

  });
});

