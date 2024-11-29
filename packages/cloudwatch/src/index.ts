import {
  CloudWatchClient,
  PutMetricDataCommand,
  PutMetricDataCommandOutput,
} from '@aws-sdk/client-cloudwatch';
import {
  Job as PrismaJob,
  JobScheduler as PrismaScheduler,
} from '@steveojs/scheduler-prisma';
import {
  PendingJobs,
  JobScheduler as SequelizeScheduler,
} from '@steveojs/scheduler-sequelize';
import {
  JobAttributes as SequelizeJob,
  JobInstance,
} from '@steveojs/scheduler-sequelize/lib/models/job';

type Job = PrismaJob | JobInstance;
type JobAttributes = SequelizeJob | PrismaJob;

const Namespace = 'Steveo-DB-Jobs';
const client = new CloudWatchClient({
  region:
    process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
});
const publishCountForService = (
  metricName: string,
  serviceTag: string,
  statusTag: string,
  count: number
): Promise<PutMetricDataCommandOutput> => {
  const command = new PutMetricDataCommand({
    MetricData: [
      {
        MetricName: metricName,
        Dimensions: [
          {
            Name: 'service',
            Value: serviceTag,
          },
          {
            Name: 'status',
            Value: statusTag,
          },
        ],
        Unit: 'Count',
        Timestamp: new Date(),
        Value: count,
      },
    ],
    Namespace,
  });
  return client.send(command);
};

export const schedulerMetrics = (
  scheduler: PrismaScheduler | SequelizeScheduler,
  service: string
) => {
  scheduler.events.on('duration', (job: Job) => {
    try {
      const jobName = job.name.toUpperCase();
      publishCountForService(jobName, service, 'completed', 1);
    } catch (err) {
      scheduler.logger.error(
        `steveo-cloudwatch: Error while putting metrics: ${err}`
      );
      throw err;
    }
  });

  scheduler.events.on('lagged', (jobs: JobAttributes[]) => {
    for (const job of jobs) {
      try {
        const jobName = job.name.toUpperCase();
        publishCountForService(jobName, service, 'stuck', 1);
      } catch (err) {
        scheduler.logger.error(
          `steveo-cloudwatch: Error while putting metrics: ${err}`
        );
        throw err;
      }
    }
  });

  scheduler.events.on('reset', (job: JobAttributes) => {
    try {
      const jobName = job.name.toUpperCase();
      publishCountForService(jobName, service, 'restarted', 1);
    } catch (err) {
      scheduler.logger.error(
        `steveo-cloudwatch: Error while putting metrics: ${err}`
      );
      throw err;
    }
  });

  scheduler.events.on('pending', (data: PendingJobs) => {
    for (const [name, count] of Object.entries(data)) {
      try {
        const jobName = name.toUpperCase();
        if (typeof count !== 'number' || !Number.isFinite(count)) {
          throw new Error(`Recieved invalid argument for count: ${count}`);
        }
        publishCountForService(jobName, service, 'pending', count);
      } catch (err) {
        scheduler.logger.error(
          `steveo-cloudwatch: Error while putting metrics: ${err}`
        );
        throw err;
      }
    }
  });
};

export default schedulerMetrics;
