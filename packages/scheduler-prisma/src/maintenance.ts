import moment from 'moment-timezone';
import { Job, PrismaClient, Prisma } from '@prisma/client';
import { JobScheduler } from './index';
import { resetJob } from './helpers';

export default function initMaintenance(
  client: PrismaClient,
  jobScheduler: JobScheduler
) {
  const {
    logger,
    jobsSafeToRestart,
    jobsCustomRestart,
    jobsRiskyToRestart,
    events,
  } = jobScheduler;

  const allJobs = [...jobsRiskyToRestart, ...jobsSafeToRestart];

  return async () => {
    // ** Blocked ** These are jobs that have been queued > 10m ago but not accepted for processing
    // Auto-restart blocked

    const blockedInMinutes = 5;
    const lagInMinutes = 6;

    try {
      // Returns a grouped object of jobs that are pending (jobs that are not currently running and are due to run)
      const pendingJobs = await client.$queryRaw<
        { name: string; count: string }[]
      >`
        SELECT name, count(name) from jobs
        WHERE queued = false AND next_run_at < CURRENT_TIMESTAMP
        AND name in (${Prisma.join(allJobs)})
        AND deleted_at is NULL
        GROUP BY 1
      `;

      events.emit(
        'pending',
        // eslint-disable-next-line unicorn/no-array-reduce
        pendingJobs.reduce((acc, curr) => {
          acc[curr.name] = +curr.count;
          return acc;
        }, {})
      );

      const rows = jobsSafeToRestart.length
        ? await client.$queryRaw<Job[]>`
    SELECT * FROM jobs
    WHERE queued = true AND deleted_at is NULL AND
    (accepted_at < last_run_at OR accepted_at IS NULL)
    AND last_run_at <= CURRENT_TIMESTAMP - ${`'${blockedInMinutes} minutes'`}::TEXT::INTERVAL
    AND name IN (${Prisma.join(jobsSafeToRestart)})
    `
        : [];

      if (rows.length) {
        await client.job.updateMany({
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

      const blockedJobs = jobsRiskyToRestart.length
        ? await client.$queryRaw<Job[]>`
    SELECT * FROM jobs
    WHERE queued = true AND deleted_at is NULL AND
    (accepted_at < last_run_at OR accepted_at IS NULL)
    AND last_run_at <= CURRENT_TIMESTAMP - ${`'${blockedInMinutes} minutes'`}::TEXT::INTERVAL
    AND name IN (${Prisma.join(jobsRiskyToRestart)})
    `
        : [];

      // All other blocked jobs - update them to run next time - too risky to just start again
      await Promise.all(
        blockedJobs.map(async job =>
          resetJob(client, job, events).catch(e => logger.error(e))
        )
      );

      // ** Laggy ** These are jobs that are in accepted state without transitioning to finished/dormant after 6 minutes
      // queued == true && (last_finished_at < next_run_at < last_run_at < accepted_at <= (now() - 6m))
      const laggedRestartJobs = jobsSafeToRestart.length
        ? await client.$queryRaw<Job[]>`
    SELECT * FROM jobs
    WHERE queued = true AND last_run_at < accepted_at
    AND (last_finished_at < CURRENT_TIMESTAMP - ${`'${lagInMinutes} minutes'`}::TEXT::INTERVAL
    OR last_finished_at IS NULL)
    AND accepted_at <= CURRENT_TIMESTAMP - ${`'${lagInMinutes} minutes'`}::TEXT::INTERVAL
    AND name IN (${Prisma.join(jobsSafeToRestart)})`
        : [];

      // Auto-restart laggy
      if (laggedRestartJobs.length) {
        await client.job.updateMany({
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

      const laggyJobs = jobsSafeToRestart.length
        ? await client.$queryRaw<Job[]>`
    SELECT * FROM jobs
    WHERE queued = true AND last_run_at < accepted_at
    AND (last_finished_at < CURRENT_TIMESTAMP - ${`'${lagInMinutes} minutes'`}::TEXT::INTERVAL
    OR last_finished_at IS NULL)
    AND accepted_at <= CURRENT_TIMESTAMP - ${`'${lagInMinutes} minutes'`}::TEXT::INTERVAL
    AND name NOT IN (${Prisma.join(jobsSafeToRestart)}) AND name != 'check'`
        : [];

      if (laggyJobs && laggyJobs.length > 0) {
        const notifyJobs: Job[] = [];
        const resetJobs: Job[] = [];

        // Final automated reset check for jobs that we consider safe to do so, otherwise notify
        for (const laggyJob of laggyJobs) {
          const restartAfter = jobsCustomRestart[laggyJob.name];
          if (restartAfter) {
            if (
              moment(laggyJob.acceptedAt).add(moment.duration(restartAfter)) >
              moment()
            ) {
              resetJobs.push(laggyJob);
            }
          } else {
            notifyJobs.push(laggyJob);
          }
        }

        await Promise.all(
          resetJobs.map(async job =>
            resetJob(client, job, events).catch(e => logger.error(e))
          )
        );

        if (notifyJobs.length) {
          events.emit(
            'lagged',
            notifyJobs.map(job => job)
          );
        }
      }
    } catch (e) {
      logger.error('Maintenance failed', e);
    }
  };
}
