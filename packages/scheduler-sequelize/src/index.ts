import Logger from 'bunyan';
import { EventEmitter } from 'events';
import TypedEmitter from 'typed-emitter';
import Sequelize from 'sequelize';
import { Duration } from 'moment-timezone';
import {
  taskRunner,
  timestampHelperFactory,
  TimestampHelper,
  isHealthy,
} from './helpers';
import { JobAttributes, JobInstance } from './models/job';
import initSequelize, { JobModel } from './models/index';
import { JobSet } from './types';
import { buildEnqueueJobsQuery } from './enqueue_jobs_query';
import initMaintenance from './maintenance';

const DEFAULT_LAG = 6; // after 6 minutes, a job is considered laggy
const DEFAULT_BLOCKED_DURATION = 10; // after 10 minutes, a job is considered blocked
const DEFAULT_RUN_INTERVAL = 5000; // run every 5 seconds;
export const DEFAULT_MAX_RESTARTS_ON_FAILURE = 3;
export const DEFAULT_BACKOFF = 60000; // 60 seconds

export type PendingJobs = {
  [name: string]: number;
};

const MAINTENANCE_JOB_NAME = 'check';

export interface Events {
  /**
   * @description A list of jobs that have lagged and have not been restarted
   */
  lagged: (jobs: JobAttributes[]) => void;

  /**
   * @description a job that has been updated to run at the time provided
   */
  reset: (job: JobAttributes, nextRunAt: string) => void;

  /**
   * @description Job duration (only available when wrapped with the timestamp helper)
   */
  duration: (job: JobInstance, timeSecs: number, success: boolean) => void;

  /**
   * @description An object of job names against pending jobs to run
   */
  pending: (data: PendingJobs) => void;
}

export type JobContext = {
  job?: JobInstance;
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

export interface JobSchedulerInterface {
  logger: Logger;

  databaseUri: string;

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
   * 3. When the callback runs successfully without any issues, it calculates the next run at for the job using its lunartick (https://www.npmjs.com/package/lunartick) rule and adds the following to the job
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
export class JobScheduler implements JobSchedulerInterface {
  logger: Logger;

  lagInMinutes: number = DEFAULT_LAG;

  blockedInMinutes: number = DEFAULT_BLOCKED_DURATION;

  defaultRunInterval: number = DEFAULT_RUN_INTERVAL;

  databaseUri: string;

  jobsRiskyToRestart: string[];

  jobsSafeToRestart: string[];

  jobsCustomRestart: {
    [name: string]: Duration;
  };

  events: TypedEmitter<Events>;

  tasks: Tasks;

  sequelize: Sequelize.Sequelize;

  Job: JobModel;

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

  enqueueJobsQuery: string;

  heartbeat: number;

  timeout: number;

  processing: boolean;

  constructor({
    logger,
    databaseUri,
    jobsSafeToRestart,
    jobsCustomRestart,
    jobsRiskyToRestart,
    lagInMinutes,
    blockedInMinutes,
    tasks,
    defaultRunInterval,
    events = new EventEmitter() as TypedEmitter<Events>,
    wrapAllTasksWithTimestampHelper = false,
    enqueueLimit = 1,
    backOffMs = DEFAULT_BACKOFF,
    maxRestartsOnFailure = DEFAULT_MAX_RESTARTS_ON_FAILURE,
    namespace,
  }: JobSchedulerInterface) {
    this.heartbeat = new Date().getTime();
    this.timeout = 60 * 15 * 1000;
    this.processing = false;

    this.wrapAllTasksWithTimestampHelper = wrapAllTasksWithTimestampHelper;
    this.maxRestartsOnFailure = maxRestartsOnFailure;
    this.enqueueLimit = enqueueLimit;
    this.backOffMs = backOffMs;
    this.logger = logger;
    this.databaseUri = databaseUri;
    this.jobsCustomRestart = jobsCustomRestart;
    this.jobsSafeToRestart = jobsSafeToRestart;
    this.jobsRiskyToRestart = jobsRiskyToRestart;
    this.lagInMinutes = lagInMinutes ?? DEFAULT_LAG;
    this.blockedInMinutes = blockedInMinutes ?? DEFAULT_BLOCKED_DURATION;
    this.defaultRunInterval = defaultRunInterval ?? DEFAULT_RUN_INTERVAL;
    this.events = events;
    const { sequelize, Job } = initSequelize(this);
    this.sequelize = sequelize;
    this.Job = Job;
    this.timestampHelper = timestampHelperFactory(this);
    const maintenanceTask = this.timestampHelper(
      this.Job,
      initMaintenance(this)
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
    this.enqueueJobsQuery = buildEnqueueJobsQuery(namespace);
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
          task.subscribe = this.timestampHelper(this.Job, task.subscribe);
        }
        acc[taskName] = taskRunner(task);
        return acc;
      }
      acc[taskName] = this.wrapAllTasksWithTimestampHelper
        ? this.timestampHelper(this.Job, task)
        : task;
      return acc;
    }, {} as Tasks);

  fetchAndEnqueueJobs = async (): Promise<JobSet[]> =>
    this.sequelize.query(this.enqueueJobsQuery, {
      type: Sequelize.QueryTypes.SELECT,
      replacements: {
        jobEnqueueLimit: this.enqueueLimit,
        jobs: this.allJobs,
        namespace: this.namespace,
      },
    });

  publishMessages = async (rows: JobSet[]) => {
    if (!rows || !rows.length) {
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
            // @ts-ignore
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

  queueScheduledJobs = async () => {
    this.beat();

    try {
      const jobs = await this.fetchAndEnqueueJobs();
      await this.publishMessages(jobs);
    } catch (e) {
      this.logger.error(
        { error: e },
        'job_producer failed:- while fetching jobItems from database'
      );

      throw e;
    }
  };

  beat() {
    this.heartbeat = Math.max(this.heartbeat, new Date().getTime());
  }

  async healthCheck() {
    if (this.processing) {
      return true;
    }

    const healthy = isHealthy(this.heartbeat, this.timeout);

    if (!healthy) {
      throw new Error(`Not healthy (${this.timeout}s)`);
    }

    return true;
  }

  async pause() {
    this.paused = true;
  }

  async resume() {
    this.paused = false;
  }

  async terminate() {
    this.logger.info(`terminating`);
    this.exiting = true;
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
  }

  async init() {
    if (this.startupCheck) return;
    this.startupCheck = true;
    await this.Job.findOrCreate({
      where: {
        name: MAINTENANCE_JOB_NAME,
      },
      paranoid: false,
      defaults: {
        name: MAINTENANCE_JOB_NAME,
        nextRunAt: new Date().toISOString(),
        queued: false,
        data: {},
        repeatInterval: 'FREQ=MINUTELY;INTERVAL=1',
      },
    });
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
