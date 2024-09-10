import Redlock from 'redlock';
import client from './redis';

/**
 *
 */
const redlock = new Redlock(
  // you should have one client for each independent redis node
  // or cluster
  [client],
  {
    // the expected clock drift; for more details
    // see http://redis.io/topics/distlock
    driftFactor: 0.01, // time in ms

    // the max number of times Redlock will attempt
    // to lock a resource before erroring
    retryCount: 10,

    // the time in ms between attempts
    retryDelay: 100, // time in ms

    // the max time in ms randomly added to retries
    // to improve performance under high contention
    // see https://www.awsarchitectureblog.com/2015/03/backoff.html
    retryJitter: 200, // time in ms
  }
);

redlock.on('clientError', (_err: Error) => {
  // logger.error(`ERR! Redlock error`, err);
});

/**
 * A mutex can be used to coordinate access to a shared resource ([Wikipedia](https://en.wikipedia.org/wiki/Lock_(computer_science)))
 * across process or machine boundaries. It uses [redlock](https://redis.io/docs/latest/develop/use/patterns/distributed-locks/)
 * under the hood to ensure distributed code executions against a common
 * resource; analogous to how a database transaction can lock a row
 * pessimistically, but lightweight in terms of its execution.
 *
 * Reference: https://en.wikipedia.org/wiki/Semaphore_(programming)
 */
export async function mutex<T>(name: string, task: () => Promise<T>) {
  const lock = await redlock.acquire([name], 2000);
  try {
    return task();
  } finally {
    // Release the lock.
    await lock.unlock();
  }
}

