import Logger from 'bunyan';
import { EventEmitter } from 'events';
import TypedEmitter from 'typed-emitter';
import { Job, PrismaClient, Prisma } from '@prisma/client';
import { Duration } from 'moment-timezone';
import {
  timestampHelperFactory,
  TimestampHelper,
  isHealthy,
} from './helpers';
import { JobSet } from './types';
import { buildEnqueueJobsQuery } from './enqueue_jobs_query';
import { MaintenanceScheduler } from './maintenance';
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
  job: Job;
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
  [name: string]: TaskCallback<any, any>;
};

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

  enqueueLimit: number;

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

  private maintenanceScheduler?: MaintenanceScheduler;

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
    enqueueLimit = 4,
    backOffMs = DEFAULT_BACKOFF,
    maxRestartsOnFailure = DEFAULT_MAX_RESTARTS_ON_FAILURE,
    namespace,
    events = new EventEmitter() as TypedEmitter<Events>,
  }: JobSchedulerInterface) {
    this.logger = logger;
    this.heartbeat = new Date().getTime();
    this.timeout = 60 * 15 * 1000;
    this.processing = false;
    this.client = client;
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
    this.tasks = tasks;
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

  fetchAndEnqueueJobs = async (): Promise<JobSet[]> =>
    this.client.$queryRaw<JobSet[]>(this.enqueueJobsQuery);

  /**
   * @description Processes a batch of jobs. Will not exit early if the scheduler is terminating,
   * which is by design to not leave the batch partially processed.
   * @param rows - The batch of jobs to process
   * @returns A boolean indicating whether the jobs were processed successfully
   */
  publishMessages = async (rows: JobSet[]) => {
    if (!rows.length) {
      return false;
    }

    this.processing = true;
    for (const batch of rows) {
      this.beat();
      const { name, items } = batch;
      const task = this.tasks[name];
      if (task) {
        for (const item of items) {
          try {
            await task(item.data, {
              job: item,
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

    // Start maintenance check
    this.maintenanceScheduler = new MaintenanceScheduler(
      this.client,
      this.logger,
      this.jobsSafeToRestart,
      this.jobsCustomRestart,
      this.jobsRiskyToRestart,
      this.events
    );
    this.maintenanceScheduler.start();
  }

  async stopMaintenance() {
    this.maintenanceScheduler?.stop();
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
    this.logger.info('terminating');

    // Signal to the message processing loop that the scheduler is terminating
    this.exiting = true;

    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    await this.stopMaintenance();

    // Wait for any currently executing tasks to complete
    await waitForChange(() => this.processing === false);
  }

  runScheduledJobs = async (
    /**
     * @description In minutes
     */
    waitTime: number = this.defaultRunInterval
  ): Promise<void> => {
    await this.init();
    const loop = () => {
      if (this.currentTimeout) {
        clearTimeout(this.currentTimeout);
      }

      if (this.exiting) {
        return;
      }

      this.currentTimeout = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.runScheduledJobs(waitTime);
      }, waitTime);
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
