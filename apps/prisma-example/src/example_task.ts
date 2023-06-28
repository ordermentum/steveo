// @ts-nocheck
const exampleTask3 = (jobs: Job[] = []) => {
  const messages = jobs.map(job => Object.assign(job, { jobRowId: job.id }));

  console.log(messages);
};

export default exampleTask3;
