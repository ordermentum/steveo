/**
 *
 * @param ms
 * @returns
 */
export function waitTime(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 *
 * @param fn
 * @param timeout
 * @param interval
 * @returns
 */
export function waitForChange(
  fn: () => boolean,
  timeout = 5000,
  interval = 50
) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkCondition = () => {
      if (fn()) {
        resolve(true);
        return;
      }

      // If timeout has been exceeded, reject with an error.
      if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout exceeded while waiting for variable change'));
        return;
      }

      // Otherwise, check again after the specified interval.
      setTimeout(checkCondition, interval);
    };

    checkCondition();
  });
}
