// @ts-nocheck
import steveo from '../steveo_sqs';

export const exampleTask2 = steveo.task<{}>(
  'example-task-2',
  async ({ id, batchId, reference, attempt = 1 }) => {}
);
