import moment from 'moment-timezone';
import { Job, PrismaClient, Prisma } from '@prisma/client';
import { JobScheduler } from './index';
import { resetJob } from './helpers';

// Default interval for maintenance check (1 minute)
const MAINTENANCE_INTERVAL = 60 * 1000;

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
    private readonly client: PrismaClient,
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

  private async processMaintenanceIteration(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
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

  private async runMaintenance(): Promise<void> {
    try {
      const blockedInMinutes = 5;
      const lagInMinutes = 6;

      // Returns a grouped object of jobs that are pending
      const pendingJobs =
        this.allJobs.length > 0
          ? await this.client.$queryRaw<{ name: string; count: string }[]>`
        SELECT name, count(name) from jobs
        WHERE queued = false AND next_run_at < CURRENT_TIMESTAMP
        AND name IN (${Prisma.join(this.allJobs)})
        AND deleted_at is NULL
        GROUP BY 1
      `
          : [];

      const pendingJobsMap = Object.fromEntries(
        pendingJobs.map(job => [job.name, +job.count])
      );
      this.events.emit('pending', pendingJobsMap);

      const rows = this.jobsSafeToRestart.length
        ? await this.client.$queryRaw<Job[]>`
    SELECT * FROM jobs
    WHERE queued = true AND deleted_at is NULL AND
    (accepted_at < last_run_at OR accepted_at IS NULL)
    AND last_run_at <= CURRENT_TIMESTAMP - ${`'${blockedInMinutes} minutes'`}::TEXT::INTERVAL
    AND name IN (${Prisma.join(this.jobsSafeToRestart)})
    `
        : [];

      if (rows.length) {
        await this.client.job.updateMany({
          data: {
            nextRunAt: new Date().toISOString(),
            queued: false,
          },
          where: {
            id: {
              in: rows.map(r => r.id),
            },
          },
        });
      }

      const blockedJobs = this.jobsRiskyToRestart.length
        ? await this.client.$queryRaw<Job[]>`
    SELECT * FROM jobs
    WHERE queued = true AND deleted_at is NULL AND
    (accepted_at < last_run_at OR accepted_at IS NULL)
    AND last_run_at <= CURRENT_TIMESTAMP - ${`'${blockedInMinutes} minutes'`}::TEXT::INTERVAL
    AND name IN (${Prisma.join(this.jobsRiskyToRestart)})
    `
        : [];

      await Promise.all(
        blockedJobs.map(job =>
          resetJob(this.client, job, this.events).catch(e =>
            this.logger.error(e)
          )
        )
      );

      const laggedRestartJobs = this.jobsSafeToRestart.length
        ? await this.client.$queryRaw<Job[]>`
    SELECT * FROM jobs
    WHERE queued = true AND last_run_at < accepted_at
    AND (last_finished_at < CURRENT_TIMESTAMP - ${`'${lagInMinutes} minutes'`}::TEXT::INTERVAL
    OR last_finished_at IS NULL)
    AND accepted_at <= CURRENT_TIMESTAMP - ${`'${lagInMinutes} minutes'`}::TEXT::INTERVAL
    AND name IN (${Prisma.join(this.jobsSafeToRestart)})`
        : [];

      if (laggedRestartJobs.length) {
        await this.client.job.updateMany({
          data: {
            lastFinishedAt: new Date().toISOString(),
            nextRunAt: new Date().toISOString(),
            queued: false,
          },
          where: {
            id: {
              in: laggedRestartJobs.map(r => r.id),
            },
          },
        });
      }

      const laggyJobs = this.jobsSafeToRestart.length
        ? await this.client.$queryRaw<Job[]>`
    SELECT * FROM jobs
    WHERE queued = true AND last_run_at < accepted_at
    AND (last_finished_at < CURRENT_TIMESTAMP - ${`'${lagInMinutes} minutes'`}::TEXT::INTERVAL
    OR last_finished_at IS NULL)
    AND accepted_at <= CURRENT_TIMESTAMP - ${`'${lagInMinutes} minutes'`}::TEXT::INTERVAL
    AND name NOT IN (
      ${Prisma.join(this.jobsSafeToRestart)}
    ) AND name != 'check'`
        : [];

      if (laggyJobs.length) {
        const notifyJobs: Job[] = [];
        const resetJobs: Job[] = [];

        for (const laggyJob of laggyJobs) {
          const restartAfter = this.jobsCustomRestart[laggyJob.name];
          const restartTime = moment(laggyJob.acceptedAt).add(
            moment.duration(restartAfter)
          );

          if (restartTime > moment()) {
            resetJobs.push(laggyJob);
          } else {
            notifyJobs.push(laggyJob);
          }
        }

        await Promise.all(
          resetJobs.map(job =>
            resetJob(this.client, job, this.events).catch(e =>
              this.logger.error(e)
            )
          )
        );

        if (notifyJobs.length) {
          this.events.emit('lagged', notifyJobs);
        }
      }
    } catch (e) {
      this.logger.warn({ error: e }, 'Maintenance failed');
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
