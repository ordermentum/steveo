/**
 * Waits for a specified amount of time
 * @param ms - The amount of time to wait in milliseconds
 * @returns A promise that resolves after the specified time has elapsed
 */
export function waitTime(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Waits for a condition to change
 * @param fn - The condition to wait for
 * @param timeout - The maximum amount of time to wait in milliseconds
 * @param interval - The interval at which to check the condition in milliseconds
 * @returns A promise that resolves when the condition changes
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
