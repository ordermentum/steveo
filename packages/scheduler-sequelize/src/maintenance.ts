import moment from 'moment-timezone';
import { Op, fn } from 'sequelize';
import TypedEventEmitter from 'typed-emitter';
import { JobScheduler, Events } from './index';
import { JobInstance } from './models/job';
import { computeNextRun } from './helpers';

// Default interval for maintenance check (1 minute)
const MAINTENANCE_INTERVAL = 60 * 1000;

export async function resetJob(
  job: JobInstance,
  events: TypedEventEmitter<Events>
): Promise<void> {
  if (!job.repeatInterval) {
    return;
  }
  const nextRunAt = computeNextRun(job.repeatInterval, {
    timezone: job.timezone,
  });
  events.emit('reset', job.get(), nextRunAt);
  await job.update({
    queued: false,
    nextRunAt,
  });
}

/**
 * MaintenanceScheduler handles the health and recovery of scheduled jobs in the system.
 * It runs periodic checks (default every 60 seconds) to identify and fix various job states:
 *
 * Job State Definitions:
 * ---------------------
 * Pending Jobs:
 * - A job is considered "pending" when its nextRunAt time is in the past
 * - The job's queued flag is false (not yet picked up for processing)
 * - These jobs should have started but haven't been queued for execution yet
 * - Usually indicates scheduling delays or system overload
 *
 * Blocked Jobs:
 * - A job is "blocked" when it's been queued (queued=true) but hasn't been accepted/started
 * - Either the acceptedAt is NULL (never started) or is older than the lastRunAt
 * - Detected after being stuck for 5+ minutes in this state
 * - Usually indicates worker crashes during job pickup or queue processing issues
 *
 * Lagged Jobs:
 * - A job is "lagged" when it started executing but hasn't finished in the expected time
 * - Has been accepted (has acceptedAt timestamp) but either:
 *   a) Never finished (lastFinishedAt is NULL) or
 *   b) Last finish time is too old (6+ minutes by default)
 * - Typically indicates hung processes, infinite loops, or worker crashes during execution
 *
 * Recovery Actions:
 * ---------------
 * 1. Pending Jobs Check:
 *    - Identifies jobs past their scheduled run time but haven't been queued
 *    - Groups them by job name and emits 'pending' events for monitoring
 *
 * 2. Blocked Jobs Check (after 5 minutes):
 *    - For Safe Jobs: Automatically resets jobs that are queued but haven't been accepted
 *    - For Risky Jobs: Identifies jobs stuck in queued state for monitoring
 *
 * 3. Lagged Jobs Check (after 6 minutes):
 *    - For Safe Jobs: Resets jobs that started but haven't finished in time
 *    - For Custom Restart Jobs: Checks against custom timeout configurations
 *    - For Other Jobs: Emits 'lagged' events for monitoring
 *
 * The scheduler respects different job categories:
 * - jobsSafeToRestart: Jobs that can be automatically restarted
 * - jobsRiskyToRestart: Jobs that need careful handling when stuck
 * - jobsCustomRestart: Jobs with custom timeout configurations
 */

export class MaintenanceScheduler {
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  private isRunning = false;

  private readonly allJobs: string[];

  constructor(
    private readonly Job: JobScheduler['Job'],
    private readonly logger: JobScheduler['logger'],
    private readonly jobsSafeToRestart: string[],
    private readonly jobsCustomRestart: JobScheduler['jobsCustomRestart'],
    private readonly jobsRiskyToRestart: string[],
    private readonly events: JobScheduler['events']
  ) {
    this.allJobs = [...jobsRiskyToRestart, ...jobsSafeToRestart];
  }

  private scheduleNext = (interval = MAINTENANCE_INTERVAL): void => {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
    this.timeoutHandle = setTimeout(() => {
      this.processMaintenanceIteration().catch(err =>
        this.logger.error('Maintenance run failed:', err)
      );
    }, interval);
  };

  private async runMaintenance(): Promise<void> {
    try {
      // Returns a grouped object of jobs that are pending
      const pendingJobsData =
        this.allJobs.length > 0
          ? await this.Job.findAll({
              where: {
                queued: false,
                nextRunAt: {
                  [Op.lt]: new Date().toISOString(),
                },
                name: {
                  [Op.in]: this.allJobs,
                },
                deletedAt: null,
              },
              attributes: ['name', [fn('COUNT', 'name'), 'count']],
              group: ['name'],
            })
          : [];

      const pendingJobs = Object.fromEntries(
        pendingJobsData.map(job => {
          const data = job.get();
          return [data.name, +(data as any).count];
        })
      );
      this.events.emit('pending', pendingJobs);

      // ** Blocked ** These are jobs that have been queued > 10m ago but not accepted for processing
      // Auto-restart blocked
      await this.Job.scope('blocked').update(
        {
          nextRunAt: new Date().toISOString(),
          queued: false,
          failures: 0,
        },
        {
          where: {
            name: this.jobsSafeToRestart,
          },
        }
      );

      const blockedJobs = await this.Job.scope('blocked').findAll({
        where: {
          name: this.jobsRiskyToRestart,
        },
      });

      // All other blocked jobs - update them to run next time - too risky to just start again
      await Promise.all(
        blockedJobs.map(job =>
          resetJob(job, this.events).catch(e => this.logger.error(e))
        )
      );

      // ** Laggy ** These are jobs that are in accepted state without transitioning to finished/dormant after 6 minutes
      // Auto-restart laggy
      await this.Job.scope('laggy').update(
        {
          lastFinishedAt: new Date().toISOString(),
          nextRunAt: new Date().toISOString(),
          queued: false,
        },
        {
          where: {
            name: this.jobsSafeToRestart,
          },
        }
      );

      // All other laggy jobs
      const laggyJobs = await this.Job.scope('laggy').findAll({
        where: {
          name: {
            [Op.ne]: 'check',
          },
        },
      });

      if (laggyJobs.length) {
        const notifyJobs: JobInstance[] = [];
        const resetJobs: JobInstance[] = [];

        // Final automated reset check for jobs that we consider safe to do so, otherwise notify
        for (const laggyJob of laggyJobs) {
          const restartAfter = this.jobsCustomRestart[laggyJob.name];
          const restartTime = moment(laggyJob.acceptedAt).add(restartAfter);

          if (restartTime > moment()) {
            resetJobs.push(laggyJob);
          } else {
            notifyJobs.push(laggyJob);
          }
        }

        await Promise.all(
          resetJobs.map(job =>
            resetJob(job, this.events).catch(e => this.logger.error(e))
          )
        );

        if (notifyJobs.length) {
          this.events.emit(
            'lagged',
            notifyJobs.map(job => job.get())
          );
        }
      }
    } catch (e) {
      this.logger.warn({ error: e }, 'Maintenance failed');
    }
  }

  private async processMaintenanceIteration(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug(
        'Maintenance check still running, skipping this iteration'
      );
      this.scheduleNext();
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      await this.runMaintenance();
    } finally {
      this.isRunning = false;
      const elapsed = Date.now() - startTime;
      const nextInterval = Math.max(0, MAINTENANCE_INTERVAL - elapsed);
      this.scheduleNext(nextInterval);
    }
  }

  start(): void {
    // Start the maintenance checks
    this.processMaintenanceIteration().catch(err =>
      this.logger.error('Initial maintenance run failed:', err)
    );
  }

  stop(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
}
