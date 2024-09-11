import moment from 'moment-timezone';
import { RRuleSet } from 'rrule-rust';
import TypedEventEmitter from 'typed-emitter';
import { Job, PrismaClient } from '@prisma/client';
import {
  DEFAULT_BACKOFF,
  DEFAULT_MAX_RESTARTS_ON_FAILURE,
  Events,
  TaskCallback,
  JobContext,
  JobScheduler,
  PublishableTask,
} from './index';
import { Properties } from './types';

const SIX_MONTHS_IN_MS = 15778476000;

export const isHealthy = (heartbeat: number, timeout: number) =>
  new Date().getTime() - timeout < heartbeat;

const getValidRule = (recurrence: string, timezone?: string) => {
  const isICalRule = recurrence.startsWith('DTSTART');
  if (isICalRule) return recurrence;

  let derivedTimezone = timezone ?? 'UTC';
  let dateStart = moment().toISOString();
  const rule = recurrence
    .split(';')
    .filter(b => {
      const [key, value] = b.split('=');
      if (key === 'TZID') {
        derivedTimezone = value;
      }
      if (key === 'DTSTART') {
        dateStart = value;
      }
      return key !== 'TZID' && key !== 'DTSTART';
    })
    .join(';');

  const timeISO8601 = moment(dateStart)
    .tz(derivedTimezone)
    .format('YYYYMMDDTHHmmss');
  return `DTSTART;TZID=${derivedTimezone}:${timeISO8601}\nRRULE:${rule}`;
};

export const computeNextRuns = (
  interval: string,
  {
    /**
     * @description Timezone to compute the next runs
     * @default UTC
     */
    timezone = 'UTC',
    /**
     * @description Start date to compute the next runs
     * @default now()
     */
    startDate = moment().toISOString(),
    /**
     * @description The number of runs to compute
     * @default 1
     * @max 30
     */
    count = 1,
  } = {}
): string[] => {
  if (!interval) {
    throw new Error('Need a valid interval to compute next runs');
  }

  const rule = getValidRule(interval, timezone);
  const rrule = RRuleSet.parse(rule);
  const runCount = Math.min(count, 30);

  const start = moment(startDate).valueOf();
  const end = moment(start).add(SIX_MONTHS_IN_MS, 'ms').valueOf();
  return rrule
    .between(start, end, true)
    .slice(0, runCount)
    .map(run => new Date(run).toISOString());
};

// interval should be iCal String.
// This function should be in sync with packages/scheduler-sequelize/src/helpers.ts
export const computeNextRun = (
  interval: string,
  {
    /**
     * @description Timezone to compute the next run
     * @default UTC
     */
    timezone = 'UTC',
    /**
     * @description Start date to compute the next run
     * @default now()
     */
    startDate = moment().toISOString(),
  } = {}
): string => {
  if (!interval) {
    throw new Error('Need a valid interval to compute next run');
  }

  const [nextRun] = computeNextRuns(interval, {
    timezone,
    startDate,
    count: 1,
  });
  return nextRun;
};

/**
 * @description Loops through all the job rows with the name provided and publishes the task
 * @param task {SteveoTask}
 * @returns
 */
export const taskRunner =
  (task: PublishableTask) => (payload: Properties, context?: JobContext) =>
    task.publish(payload, context);

/**
 * Maintenace is done as follows:
 * any job i.e.
 * blocked - These are jobs that have been queued > 10m ago but not accepted for processing
 * laggy - These are jobs that are in accepted state without transitioning to finished/dormant after 6 minutes. Fields -> queued == true && (last_finished_at < next_run_at < last_run_at < accepted_at <= (now() - 6m))
 * are restarted
 */

export const resetJob = async (
  client: PrismaClient,
  job: Job,
  events: TypedEventEmitter<Events>
) => {
  const nextRunAt = computeNextRun(job.repeatInterval, {
    timezone: job.timezone,
  });
  events.emit('reset', job, nextRunAt);
  return client.job.update({
    // @ts-expect-error namespace is an optional feature
    where: job.namespace
      ? // @ts-expect-error
        { id_namespace: { id: job.id, namespace: job.namespace } }
      : { id: job.id },
    data: { queued: false, nextRunAt, failures: 0 },
  });
};

const retryDelay = (
  attempt: number,
  backoff = 1000,
  factor = 2,
  jitter = true
) => Math.round((jitter ? Math.random() : 1) * backoff * factor ** attempt);

export type TimestampHelper = <
  T extends { context?: JobContext } = any,
  R = any
>(
  client: PrismaClient,
  task: TaskCallback<T, R>
) => (args: T, context: JobContext) => Promise<any>;

const updateStartTask = async (
  client: PrismaClient,
  id: string | null = null,
  namespace: string | null = null
) => {
  if (!id) {
    return;
  }
  await client.job.update({
    where: namespace
      ? // @ts-expect-error namespace is an optional feature
        { id_namespace: { id, namespace } }
      : { id },
    data: { acceptedAt: moment().toISOString() },
  });
};

const updateFailure = async (
  client: PrismaClient,
  // eslint-disable-next-line default-param-last
  id: string | null = null,
  jobScheduler: JobScheduler
) => {
  if (!id) {
    return;
  }
  const job = await client.job.findUnique({
    where: jobScheduler.namespace
      ? // @ts-expect-error namespace is an optional feature
        { id_namespace: { id, namespace: jobScheduler.namespace } }
      : { id },
  });

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
    await client.job.update({
      where: jobScheduler.namespace
        ? // @ts-expect-error namespace is an optional feature
          { id_namespace: { id, namespace: jobScheduler.namespace } }
        : { id },
      data: {
        queued: false,
        nextRunAt,
        failures: job.failures + 1,
        failedAt: moment().toISOString(),
      },
    });
  }

  await client.job.update({
    // @ts-expect-error namespace is an optional feature
    where: job.namespace
      ? // @ts-expect-error
        { id_namespace: { id: job.id, namespace: job.namespace } }
      : { id: job.id },
    data: {
      failures: job.failures + 1,
      failedAt: moment().toISOString(),
    },
  });
};

const updateFinishTask = async (
  client: PrismaClient,
  id: string | null = null,
  namespace: string | null = null
) => {
  if (!id) {
    return;
  }
  const job = await client.job.findUnique({
    where: namespace
      ? // @ts-expect-error namespace is an optional feature
        { id_namespace: { id, namespace } }
      : { id },
  });

  if (!job) {
    return;
  }
  if (!job.repeatInterval) {
    await client.job.delete({
      where: namespace
        ? // @ts-expect-error namespace is an optional feature
          { id_namespace: { id, namespace } }
        : { id },
    });
  }
  const nextRunAt = computeNextRun(job.repeatInterval, {
    timezone: job.timezone,
  });
  await client.job.update({
    where: namespace
      ? // @ts-expect-error namespace is an optional feature
        { id_namespace: { id, namespace } }
      : { id },
    data: {
      queued: false,
      nextRunAt,
      lastFinishedAt: new Date().toISOString(),
      failures: 0,
      failedAt: null,
    },
  });
};

/**
 * @description This helper function is used to manipulate the timestamps on the job row in the DB
 * It does the following:
 * 1. Adds an accepted at timestamp (as the current timestamp) on the job to signal the job was accepted at this time
 * 2. Runs the callback (whatever the task is)
 * 3. When the callback runs successfully without any issues, it calculates the next run at for the job using its recurrence rule and adds the following to the job
 * - queued: false //signalling the job is now over and ready to be picked up at the next run time
 * - nextRunAt: timestamp //time to pick up the job
 * - lastFinishedAt: timestamp //when did the job finish
 * 4. If the callback fails for some reason, it adds a failure to the job and reruns it with a backoff
 * @returns Promise<void>
 */
export const timestampHelperFactory =
  (jobScheduler: JobScheduler): TimestampHelper =>
  <
    T extends {
      context?: JobContext;
    } = any,
    R = any
  >(
    client: PrismaClient,
    task: TaskCallback<T, R>
  ) =>
  async (args: T, context: JobContext): Promise<any> => {
    const jobId = args.context?.job?.id ?? context.job?.id;

    if (!jobId) {
      try {
        return task(args, context);
      } catch (e) {
        return null;
      }
    }

    const jobInstance = await client.job.findUnique({
      where: jobScheduler.namespace
        ? // @ts-expect-error namespace is an optional feature
          { id_namespace: { id: jobId, namespace: jobScheduler.namespace } }
        : { id: jobId },
    });

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
    await updateStartTask(client, jobId, jobScheduler.namespace);
    try {
      result = await task(args, context);
      await updateFinishTask(client, jobId, jobScheduler.namespace);
      success = true;
    } catch (err) {
      await updateFailure(client, jobId, jobScheduler);
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
