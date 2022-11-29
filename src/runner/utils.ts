import util from 'util';

export const getDuration = (start = undefined) => {
  const durationComponents = process.hrtime(start);
  const seconds = durationComponents[0];
  const nanoseconds = durationComponents[1];
  const duration = seconds * 1000 + nanoseconds / 1e6;
  return duration;
};

export const getContext = params => {
  const { _meta: meta } = params;

  if (!meta) {
    return { duration: 0 };
  }

  const duration = getDuration(meta.start);

  return {
    duration,
  };
};

export const sleep = util.promisify(setTimeout);

export const safeParseInt = (concurrency: string, fallback = 1) => {
  if (!concurrency) {
    return fallback;
  }

  const result = parseInt(concurrency, 10);
  if (Number.isNaN(result)) {
    return fallback;
  }

  return result;
};
