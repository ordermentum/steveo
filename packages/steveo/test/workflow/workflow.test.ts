import { flow } from '../../src/workflow/workflow';
import sinon from 'sinon';

describe('', () => {

  test('should execute flow of two steps', async () => {
    const step1 = sinon.mock();
    const step2 = sinon.mock();

    const definition = flow('test-workflow')
      .next({ task: 'step1-task', exec: step1 })
      .next({ task: 'step2-task', exec: step2 })

    await definition.exec('workflow-1');
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

