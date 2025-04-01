import Logger from 'bunyan';
import { EventEmitter } from 'events';
import TypedEmitter from 'typed-emitter';
import { Job, PrismaClient, Prisma } from '@prisma/client';
import { Duration } from 'moment-timezone';
import {
  taskRunner,
  timestampHelperFactory,
  TimestampHelper,
  isHealthy,
} from './helpers';
import { JobSet } from './types';
import { buildEnqueueJobsQuery } from './enqueue_jobs_query';
import initMaintenance from './maintenance';
import { waitForChange } from './utils/wait';

const DEFAULT_LAG = 6; // after 6 minutes, a job is considered laggy
const DEFAULT_BLOCKED_DURATION = 10; // after 10 minutes, a job is considered blocked
const DEFAULT_RUN_INTERVAL = 5000; // run every 5 seconds;
export const DEFAULT_MAX_RESTARTS_ON_FAILURE = 3;
export const DEFAULT_BACKOFF = 60000; // 60 seconds

export type MaintenanceInfo = {
  stuck: number;
  restarted: number;
  completed: number;
};

export type PendingJobs = {
  [name: string]: number;
};

export interface Events {
  /**
   * @description A list of jobs that have lagged and have not been restarted
   */
  lagged: (jobs: Job[]) => void;

  /**
   * @description a job that has been updated to run at the time provided
   */
  reset: (job: Job, nextRunAt: string) => void;

  /**
   * @description Job duration (only available when wrapped with the timestamp helper)
   */
  duration: (job: Job, timeSecs: number, success: boolean) => void;

  /**
   * @description An object of job names against pending jobs to run
   */
  pending: (data: PendingJobs) => void;
}

export type JobContext = {
  job?: Job;
};

export type TaskArguments = {
  [key: string]: any;
  context: JobContext;
};
export type PublishableTask = {
  publish: (...args: any) => Promise<void>;
  [key: string]: any;
};

export type TaskCallback<T, R, C = JobContext> =
  | ((data: T, context?: C) => Promise<R>)
  | ((data?: T, context?: C) => Promise<R>)
  | ((data: T, context: C) => Promise<R>);

export type Tasks = {
  [name: string]: TaskCallback<any, any> | PublishableTask;
};

const MAINTENANCE_JOB_NAME = 'check';
export interface JobSchedulerInterface {
  logger: Logger;

  client: PrismaClient;

  /**
   * @description After how many minutes should the job be considered laggy
   * @default [DEFAULT_LAG=6]
   */
  lagInMinutes?: number;

  /**
   * @description After how many minutes, should the job be considered blocked
   * @default [DEFAULT_BLOCKED_DURATION=10]
   */
  blockedInMinutes?: number;

  /**
   * @description Default run interval time in seconds
   * @default [DEFAULT_RUN_INTERVAL=5000]
   */
  defaultRunInterval?: number;

  /**
   * @description Jobs that are risky to restart, these are restarted according to their runtime rules
   * @example ['payments']
   */
  jobsRiskyToRestart: string[];

  /**
   * @description Jobs that are safe to restart without implications
   * @example ['abandoned-carts-task', 'purge-carts-task']
   */
  jobsSafeToRestart: string[];

  /**
     * @description Custom duration (restart after) setting for jobs
     * @example {
            'order-schedule-reminder': moment.duration(30, 'minutes') //Start after 30 minutes of being laggy
        };
     */
  jobsCustomRestart: {
    [name: string]: Duration;
  };

  /**
   * @description Event emitter for events such as jobs that are laggy, blocked, restarted, etc.
   */
  events?: TypedEmitter<Events>;

  /**
     * @description the name of the job against the function to call
     * @example
     *  {
            'abandoned-carts-task': taskRunner(abandonedCartsTask),
            'purge-carts-task': taskRunner(purgeCartsTask)
        }
     */
  tasks: Tasks;

  /**
   * @description Register all tasks with the timestamp helper
   * Timestamp helper will perform the following:
   * 1. Adds an accepted at timestamp (as the current timestamp) on the job to signal the job was accepted at this time
   * 2. Runs the callback (whatever the task is)
   * 3. When the callback runs successfully without any issues, it calculates the next run at for the job using its ical rrule and adds the following to the job
   * - queued: false //signalling the job is now over and ready to be picked up at the next run time
   * - nextRunAt: timestamp //time to pick up the job
   * - lastFinishedAt: timestamp //when did the job finish
   * 4. If the callback fails for some reason, it adds a failure to the job and reruns it with a backoff
   * NOTE - It doesn't wrap publishable callbacks, to wrap publishable callbacks use the exported {timestampHelperFactory}
   * @default(false)
   */
  wrapAllTasksWithTimestampHelper?: boolean;

  /**
   * @description Number of jobs to enqueue at a time
   */
  enqueueLimit?: number;

  /**
   * @description Backoff timeout for retry
   * @default 60000
   */
  backOffMs?: number;

  /**
   * @description Number of restarts on failure before the job is not retried again
   * @default 3
   */
  maxRestartsOnFailure?: number;

  /**
   * @description Namespace to select jobs (column - namespace)
   * By default jobs are not selected by namespace
   */
  namespace?: string;
}

/**
 * This scheduler works on the assumption that the database provided should have a jobs table with the following schema
 * "column_name","column_default","is_nullable","data_type"
    "id",,"NO","uuid"
    "name",,"NO","character varying"
    "data","'{}'::jsonb","YES","jsonb"
    "last_finished_at",,"YES","timestamp with time zone"
    "last_modified_by",,"YES","character varying"
    "last_run_at",,"YES","timestamp with time zone"
    "next_run_at",,"YES","timestamp with time zone"
    "repeat_interval",,"YES","character varying"
    "type",,"YES","character varying"
    "fail_reason","'{}'::jsonb","YES","jsonb"
    "failed_at",,"YES","timestamp with time zone"
    "queued","false","YES","boolean"
    "created_at","now()","NO","timestamp with time zone"
    "updated_at","now()","NO","timestamp with time zone"
    "deleted_at",,"YES","timestamp with time zone"
    "timezone","'UTC'::character varying","NO","character varying"
    "accepted_at",,"YES","timestamp with time zone"
    "priority","1","NO","integer"
 */
/**
 * @deprecated Use @ordermentum/scheduler instead. See https://github.com/ordermentum/libs/tree/main/packages/scheduler
 */
export class JobScheduler implements JobSchedulerInterface {
  logger: Logger;

  lagInMinutes: number = DEFAULT_LAG;

  blockedInMinutes: number = DEFAULT_BLOCKED_DURATION;

  defaultRunInterval: number = DEFAULT_RUN_INTERVAL;

  jobsRiskyToRestart: string[];

  jobsSafeToRestart: string[];

  jobsCustomRestart: {
    [name: string]: Duration;
  };

  events: TypedEmitter<Events>;

  tasks: Tasks;

  client: PrismaClient;

  allJobs: string[];

  timestampHelper: TimestampHelper;

  wrapAllTasksWithTimestampHelper: boolean = false;

  enqueueLimit: number = 1;

  backOffMs: number = DEFAULT_BACKOFF;

  maxRestartsOnFailure: number = DEFAULT_MAX_RESTARTS_ON_FAILURE;

  paused: boolean = false;

  exiting: boolean = false;

  startupCheck: boolean = false;

  currentTimeout?: ReturnType<typeof setTimeout>;

  namespace?: string;

  enqueueJobsQuery: Prisma.Sql;

  heartbeat: number;

  timeout: number;

  processing: boolean;

  processingCount: number;

  constructor({
    logger,
    client,
    jobsSafeToRestart,
    jobsCustomRestart,
    jobsRiskyToRestart,
    lagInMinutes,
    blockedInMinutes,
    tasks,
    defaultRunInterval,
    wrapAllTasksWithTimestampHelper = false,
    enqueueLimit = 1,
    backOffMs = DEFAULT_BACKOFF,
    maxRestartsOnFailure = DEFAULT_MAX_RESTARTS_ON_FAILURE,
    namespace,
    events = new EventEmitter() as TypedEmitter<Events>,
  }: JobSchedulerInterface) {
    this.logger = logger;
    this.heartbeat = new Date().getTime();
    this.timeout = 60 * 15 * 1000;
    this.processing = false;
    this.processingCount = 0;

    this.client = client;
    this.wrapAllTasksWithTimestampHelper = wrapAllTasksWithTimestampHelper;
    this.enqueueLimit = enqueueLimit;
    this.backOffMs = backOffMs;
    this.maxRestartsOnFailure = maxRestartsOnFailure;
    this.jobsCustomRestart = jobsCustomRestart;
    this.jobsSafeToRestart = jobsSafeToRestart;
    this.jobsRiskyToRestart = jobsRiskyToRestart;
    this.lagInMinutes = lagInMinutes ?? DEFAULT_LAG;
    this.blockedInMinutes = blockedInMinutes ?? DEFAULT_BLOCKED_DURATION;
    this.defaultRunInterval = defaultRunInterval ?? DEFAULT_RUN_INTERVAL;
    this.events = events;
    this.timestampHelper = timestampHelperFactory(this);
    const maintenanceTask = this.timestampHelper(
      this.client,
      initMaintenance(this.client, this)
    );
    this.tasks = {
      ...this.wrapTasks(tasks),
      [MAINTENANCE_JOB_NAME]: maintenanceTask,
    };

    this.allJobs = Array.from(
      new Set([
        ...Object.keys(this.tasks),
        ...Object.keys(jobsCustomRestart),
        ...jobsSafeToRestart,
        ...jobsRiskyToRestart,
      ])
    );
    this.namespace = namespace;
    this.enqueueJobsQuery = buildEnqueueJobsQuery(
      this.allJobs,
      this.enqueueLimit,
      this.namespace
    );
  }

  /**
   * @description Wraps the callbacks with the helpers that do the following:
   * - if a publishable callback, wraps the task with a task runner helper that publishes job data by calling publish on the callback
   * - if {wrapAllTasksWithTimestampHelper} is true, wraps the task with a timestamp helper {timestampHelperFactory}
   */
  wrapTasks = (tasks: Tasks): Tasks =>
    // eslint-disable-next-line unicorn/no-array-reduce
    Object.keys(tasks).reduce((acc, taskName) => {
      const task = tasks[taskName];
      if ('publish' in task) {
        if (this.wrapAllTasksWithTimestampHelper) {
          task.subscribe = this.timestampHelper(this.client, task.subscribe);
        }
        acc[taskName] = taskRunner(task);
        return acc;
      }
      acc[taskName] = this.wrapAllTasksWithTimestampHelper
        ? this.timestampHelper(this.client, task)
        : task;
      return acc;
    }, {} as Tasks);

  fetchAndEnqueueJobs = async (): Promise<JobSet[]> =>
    this.client.$queryRaw<JobSet[]>(this.enqueueJobsQuery);

  /**
   * @description Processes a batch of jobs. Will not exit early if the scheduler is terminating,
   * which is by design to not leave the batch partially processed.
   * @param rows - The batch of jobs to process
   * @returns A boolean indicating whether the jobs were processed successfully
   */
  publishMessages = async (rows: JobSet[]) => {
    if (!rows || !rows.length) {
      return false;
    }

    this.processing = true;
    this.processingCount = rows.length;

    for (const batch of rows) {
      this.beat();
      const { name, items } = batch;
      const task = this.tasks[name];
      if (task) {
        for (const item of items) {
          try {
            // @ts-ignore
            await task(item.data, {
              job: {
                id: item.id,
              },
            });
          } catch (ex) {
            this.logger.error(`action ${name} failed to publish message`, ex);
          }
        }
      } else {
        this.logger.error(
          `no action defined for the supplied task name - ${name}`
        );
      }
    }

    this.processing = false;
    this.processingCount = 0;

    return true;
  };

  beat() {
    this.heartbeat = Math.max(this.heartbeat, new Date().getTime());
  }

  queueScheduledJobs = async () => {
    this.beat();

    try {
      // If the scheduler is terminating, don't process any more jobs
      if (this.exiting) {
        return;
      }

      const jobs = await this.fetchAndEnqueueJobs();
      await this.publishMessages(jobs as JobSet[]);
    } catch (e) {
      this.logger.error(
        { error: e },
        'job_producer failed:- while fetching jobItems from database'
      );

      throw e;
    }
  };

  async pause() {
    this.paused = true;
  }

  async resume() {
    this.paused = false;
  }

  async init() {
    if (this.startupCheck) return;
    this.startupCheck = true;
    const maintenanceJob = await this.client.job.findFirst({
      where: {
        name: MAINTENANCE_JOB_NAME,
      },
    });
    if (!maintenanceJob) {
      await this.client.job.create({
        data: {
          name: MAINTENANCE_JOB_NAME,
          nextRunAt: new Date().toISOString(),
          queued: false,
          data: {},
          repeatInterval: 'FREQ=MINUTELY;INTERVAL=1',
        },
      });
    }
  }

  async healthCheck() {
    if (this.processing) return true;

    const healthy = isHealthy(this.heartbeat, this.timeout);

    if (!healthy) {
      throw new Error(`Not healthy (${this.timeout}s)`);
    }

    return true;
  }

  /**
   * Terminates the scheduler and waits for any currently executing tasks to complete
   */
  async terminate() {
    this.logger.info(
      { processing: this.processing, processingCount: this.processingCount },
      'Terminating scheduler prisma jobs'
    );

    // Signal to the message processing loop that the scheduler is terminating
    this.exiting = true;

    if (this.currentTimeout) clearTimeout(this.currentTimeout);

    // Wait for any currently executing tasks to complete
    await waitForChange(() => this.processing === false);

    this.logger.info(
      { processing: this.processing, processingCount: this.processingCount },
      'Finished terminating scheduler prisma jobs'
    );
  }

  runScheduledJobs = async (
    /**
     * @description In minutes
     */
    waitTime: number = this.defaultRunInterval
  ): Promise<void> => {
    await this.init();
    const loop = async () => {
      if (this.currentTimeout) {
        clearTimeout(this.currentTimeout);
      }

      if (this.exiting) {
        return;
      }

      this.currentTimeout = setTimeout(
        this.runScheduledJobs.bind(this),
        waitTime,
        waitTime
      );
    };

    if (this.paused) {
      this.logger.debug('paused');
      loop();
      return;
    }

    await this.queueScheduledJobs();
    loop();
  };
}

export * from './helpers';
export { Job };
