import moment from 'moment-timezone';
import { Op, fn } from 'sequelize';
import TypedEventEmitter from 'typed-emitter';
import { JobScheduler, Events } from './index';
import { JobInstance } from './models/job';
/**
 * Maintenace is done as follows:
 * any job i.e.
 * blocked - These are jobs that have been queued > 10m ago but not accepted for processing
 * laggy - These are jobs that are in accepted state without transitioning to finished/dormant after 6 minutes. Fields -> queued == true && (last_finished_at < next_run_at < last_run_at < accepted_at <= (now() - 6m))
 * are restarted
 */
import { computeNextRunAt } from './helpers';

export const resetJob = async (
  job: JobInstance,
  events: TypedEventEmitter<Events>
) => {
  if (!job.repeatInterval) {
    return;
  }
  const nextRunAt = computeNextRunAt(job.repeatInterval, job.timezone);
  events.emit('reset', job.get(), nextRunAt);
  await job.update({
    queued: false,
    nextRunAt,
  });
};

export default function initMaintenance(jobScheduler: JobScheduler) {
  const {
    logger,
    jobsSafeToRestart,
    jobsCustomRestart,
    jobsRiskyToRestart,
    events,
    Job,
  } = jobScheduler;

  const allJobs = [...jobsSafeToRestart, ...jobsRiskyToRestart];

  return async () => {
    try {
      // Returns a grouped object of jobs that are pending (jobs that are not currently running and are due to run)
      const pendingJobs = await Job.findAll({
        where: {
          queued: false,
          nextRunAt: {
            [Op.lt]: new Date().toISOString(),
          },
          name: {
            [Op.in]: allJobs,
          },
          deletedAt: null,
        },
        attributes: ['name', [fn('COUNT', 'name'), 'count']],
        group: ['name'],
      });

      events.emit(
        'pending',
        pendingJobs.reduce((acc, curr) => {
          const job = curr.get();
          // @ts-expect-error
          acc[job.name] = +job.count;
          return acc;
        }, {})
      );

      // ** Blocked ** These are jobs that have been queued > 10m ago but not accepted for processing
      // Auto-restart blocked
      await Job.scope('blocked').update(
        {
          nextRunAt: new Date().toISOString(),
          queued: false,
          failures: 0,
        },
        {
          where: {
            name: jobsSafeToRestart,
          },
        }
      );

      const blockedJobs = await Job.scope('blocked').findAll({
        where: {
          name: jobsRiskyToRestart,
        },
      });

      // All other blocked jobs - update them to run next time - too risky to just start again
      await Promise.all(
        blockedJobs.map(async job =>
          resetJob(job, events).catch(e => logger.error(e))
        )
      );

      // ** Laggy ** These are jobs that are in accepted state without transitioning to finished/dormant after 6 minutes
      // queued == true && (last_finished_at < next_run_at < last_run_at < accepted_at <= (now() - 6m))

      // Auto-restart laggy
      await Job.scope('laggy').update(
        {
          lastFinishedAt: new Date().toISOString(),
          nextRunAt: new Date().toISOString(),
          queued: false,
        },
        {
          where: {
            name: jobsSafeToRestart,
          },
        }
      );

      // All other laggy jobs
      const laggyJobs = await Job.scope('laggy').findAll({
        where: {
          name: {
            [Op.ne]: 'check',
          },
        },
      });

      if (laggyJobs && laggyJobs.length > 0) {
        const notifyJobs: JobInstance[] = [];
        const resetJobs: JobInstance[] = [];

        // Final automated reset check for jobs that we consider safe to do so, otherwise notify
        laggyJobs.forEach(laggyJob => {
          const restartAfter = jobsCustomRestart[laggyJob.name];
          if (restartAfter) {
            if (moment(laggyJob.acceptedAt).add(restartAfter) > moment()) {
              resetJobs.push(laggyJob);
            }
          } else {
            notifyJobs.push(laggyJob);
          }
        });

        await Promise.all(
          resetJobs.map(async job =>
            resetJob(job, events).catch(e => logger.error(e))
          )
        );

        if (notifyJobs.length) {
          events.emit(
            'lagged',
            notifyJobs.map(job => job.get())
          );
        }
      }
    } catch (e) {
      logger.error('Maintenance failed', e);
    }
  };
}
