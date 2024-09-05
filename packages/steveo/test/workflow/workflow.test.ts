import { Steveo } from '../../src/index';
import sinon from 'sinon';

// Workflow integration tests
describe('Workflow tests', () => {

  test('should execute flow of two steps', async () => {
    //
    const steveo = new Steveo({
      // TODO: SQS to localstack for tests
    });

    const step1 = sinon.mock();
    const step2 = sinon.mock();

    steveo
      .flow('test-workflow', 'test-topic')
      .next({ task: 'step1-task', exec: step1 })
      .next({ task: 'step2-task', exec: step2 })


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

