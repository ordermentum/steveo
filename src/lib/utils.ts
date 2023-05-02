import util from 'util';

export const sleep = util.promisify(setTimeout);

export const safeParseInt = (concurrency: string | number, fallback = 1) => {
  if (!concurrency) {
    return fallback;
  }

  const value =
    typeof concurrency === 'string' ? concurrency : concurrency.toString();

  const result = parseInt(value, 10);
  if (Number.isNaN(result)) {
    return fallback;
  }

  return result;
};
