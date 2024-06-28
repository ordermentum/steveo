import steveo from '../steveo_sqs';

export const callback = async (payload: any) => {
  console.log('Running fifo task', payload);
};

export default steveo.task('fifo_example', callback, { fifo: true });
