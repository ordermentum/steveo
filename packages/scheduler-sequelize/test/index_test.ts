import { expect } from 'chai';
import sinon from 'sinon';
import { createTestScheduler } from './fixtures/test_scheduler.fixture';
import { waitForChange, waitTime } from '../src/utils/wait';

describe('JobScheduler', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should wait for publish messages when terminated', async () => {
    // ARRANGE

    // This is the control latch between the task and the outer test.
    let testTaskCompleted = false;

    const scheduler = createTestScheduler(sandbox, {
      tasks: {
        test: async () => {
          // Wait for the scheduler to start terminating
          await waitForChange(() => scheduler.exiting);

          // Wait for 100ms to allow the scheduler to terminate without
          // waiting on this task if it's acting improperly.
          await waitTime(100);

          // Signal to the outer test that the task has completed
          testTaskCompleted = true;

          return Promise.resolve();
        },
      },
    });

    // This is intentionally doesn't await the promise as we want
    // the task to be executing in the background.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    scheduler.publishMessages([
      {
        name: 'test',
        items: [
          // @ts-expect-error missing properties
          { id: '1', data: {} },
        ],
      },
    ]);

    // Ensure the scheduler is processing the task
    await waitForChange(() => scheduler.processing);

    // ACT
    // Attempt to pull the rug from under the executing task
    // Expected behaviour is awaiting terminate should allow the task to complete
    await scheduler.terminate();

    // ASSERT
    expect(testTaskCompleted).equal(true);
  });
});
