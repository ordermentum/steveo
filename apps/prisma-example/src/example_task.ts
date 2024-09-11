// @ts-nocheck
// eslint-disable-next-line no-undef
const exampleTask3 = (jobs: Job[] = []) => {
  const messages = jobs.map(job => Object.assign(job, { jobRowId: job.id }));

  console.log(messages);
};

export default exampleTask3;
