import { RRuleSet } from 'rrule-rust';
import moment from 'moment-timezone';
import { JobModel } from './models/index';
import { JobInstance } from './models/job';
import {
  TaskCallback,
  DEFAULT_BACKOFF,
  DEFAULT_MAX_RESTARTS_ON_FAILURE,
  JobContext,
  JobScheduler,
} from './index';

import { Properties } from './types';

export const isHealthy = (heartbeat: number, timeout: number) =>
  new Date().getTime() - timeout < heartbeat;

// interval should be iCal String.
export const computeNextRunAt = (
  interval: string,
  timezone = 'UTC'
): string => {
  if (!interval) {
    throw new Error('Invalid interval argument supplied to computeNextRunAt');
  }

  const rule = interval
    .split(';')
    .filter(b => !b.includes('TZID'))
    .join(';');
  const timeISO8601 = moment().tz(timezone).format('YYYYMMDDTHHmmss');
  const rrule = RRuleSet.parse(
    `DTSTART;TZID=${timezone}:${timeISO8601}\nRRULE:${rule}\nEXDATE;TZID=${timezone}:${timeISO8601}`
  );
  return new Date(rrule.all(1)[0]).toISOString();
};

/**
 * @description }
 * @param task {SteveoTask}
 * @returns
 */
export const taskRunner =
  (task: any) => (payload: Properties, context?: JobContext) =>
    task.publish({ ...payload, context });

const updateStartTask = async (job?: JobInstance | null) => {
  if (!job) {
    return;
  }
  await job.update({
    acceptedAt: new Date().toISOString(),
  });
};

export type TimestampHelper = <
  T extends { context?: JobContext } = any,
  R = any
>(
  job: JobModel,
  task: TaskCallback<T, R>
) => (args: T, context: JobContext) => Promise<any>;

const retryDelay = (
  attempt: number,
  backoff = 1000,
  factor = 2,
  jitter = true
) => Math.round((jitter ? Math.random() : 1) * backoff * factor ** attempt);

const updateFailure = async (job: JobInstance, jobScheduler: JobScheduler) => {
  if (!job) {
    return;
  }
  const {
    backOffMs = DEFAULT_BACKOFF,
    jobsSafeToRestart = [],
    maxRestartsOnFailure = DEFAULT_MAX_RESTARTS_ON_FAILURE,
  } = jobScheduler;

  if (
    job.failures < maxRestartsOnFailure &&
    (!jobsSafeToRestart || jobsSafeToRestart.includes(job.name))
  ) {
    const backoff = retryDelay(job.failures, backOffMs);
    const nextRunAt = moment()
      .tz(job.timezone)
      .add(backoff, 'milliseconds')
      .toISOString();

    await job.update({
      queued: false,
      nextRunAt,
      failures: job.failures + 1,
      failedAt: moment().toISOString(),
    });
    return;
  }

  await job.update({
    failures: job.failures + 1,
    failedAt: moment().toISOString(),
  });
};

const updateFinishTask = async (job?: JobInstance | null) => {
  if (!job) {
    return;
  }
  if (!job.repeatInterval) {
    await job.destroy({
      force: true,
    });
  } else {
    const nextRunAt = computeNextRunAt(job.repeatInterval, job.timezone);
    await job.update({
      queued: false,
      nextRunAt,
      lastFinishedAt: new Date().toISOString(),
      failures: 0,
      failedAt: null,
    });
  }
};

/**
 * @description This helper function is used to manipulate the timestamps on the job row in the DB
 * It does the following:
 * 1. Adds an accepted at timestamp (as the current timestamp) on the job to signal the job was accepted at this time
 * 2. Runs the callback (whatever the task is)
 * 3. When the callback runs successfully without any issues, it calculates the next run at for the job using its lunartick (https://www.npmjs.com/package/lunartick) rule and adds the following to the job
 * - queued: false //signalling the job is now over and ready to be picked up at the next run time
 * - nextRunAt: timestamp //time to pick up the job
 * - lastFinishedAt: timestamp //when did the job finish
 * 4. If the callback fails for some reason, it adds a failure to the job and reruns it with a backoff
 * @returns Promise<void>
 */
export const timestampHelperFactory =
  (jobScheduler: JobScheduler): TimestampHelper =>
  <T extends { context?: JobContext } = any, R = any>(
    job: JobModel,
    task: TaskCallback<T, R>
  ) =>
  async (args: T, context: JobContext): Promise<any> => {
    const jobId = args?.context?.job?.id ?? context?.job?.id;

    if (!jobId) {
      try {
        return task(args, context);
      } catch (e) {
        return null;
      }
    }
    const jobInstance = await job?.findByPk(jobId);

    if (!jobInstance) {
      try {
        return task(args, context);
      } catch (e) {
        return null;
      }
    }

    const start = process.hrtime();
    let success = false;
    let result;
    await updateStartTask(jobInstance);
    try {
      result = await task(args, context);
      await updateFinishTask(jobInstance);
      success = true;
    } catch (err) {
      await updateFailure(jobInstance, jobScheduler);
      result = null;
      success = false;
    } finally {
      const end = process.hrtime(start);
      jobScheduler.events.emit(
        'duration',
        jobInstance,
        (end[0] * 1e9 + end[1]) / 1e9,
        success
      );
    }
    return result;
  };
