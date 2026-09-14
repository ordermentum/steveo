import { exampleTask2 } from './taskThatOnlyUsesSteveo.js';
import { JobInstance } from '../models/job.js';

const exampleTask3 = (jobs: JobInstance[] = []) => {
  const messages = jobs.map(job => Object.assign(job, { jobRowId: job.id }));

  return exampleTask2.publish(messages);
};

export default exampleTask3;
