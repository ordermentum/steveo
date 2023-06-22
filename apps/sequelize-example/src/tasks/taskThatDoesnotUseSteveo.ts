import { exampleTask2 } from './taskThatOnlyUsesSteveo';
import { JobInstance } from '../models/job';

const exampleTask3 = (jobs: JobInstance[] = []) => {
  const messages = jobs.map(job => Object.assign(job, { jobRowId: job.id }));

  return exampleTask2.publish(messages);
};

export default exampleTask3;
