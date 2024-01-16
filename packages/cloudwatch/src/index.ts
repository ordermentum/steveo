import {
  CloudWatchClient,
  PutMetricDataCommand,
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

const client = new CloudWatchClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
});
const Namespace = 'Steveo-DB-Jobs';

export const schedulerMetrics = (
  scheduler: PrismaScheduler | SequelizeScheduler,
  service: string
) => {
  scheduler.events.on('duration', (job: Job) => {
    const MetricName = job.name.toUpperCase();
    const command = new PutMetricDataCommand({
      MetricData: [
        {
          MetricName,
          Dimensions: [
            {
              Name: 'service',
              Value: service,
            },
            {
              Name: 'status',
              Value: 'completed',
            },
          ],
          Unit: 'Count',
          Timestamp: new Date(),
          Value: 1,
        },
      ],
      Namespace,
    });

    client.send(command);
  });

  scheduler.events.on('lagged', (jobs: JobAttributes[]) => {
    for (const job of jobs) {
      const MetricName = job.name.toUpperCase();
      const command = new PutMetricDataCommand({
        MetricData: [
          {
            MetricName,
            Dimensions: [
              {
                Name: 'service',
                Value: service,
              },
              {
                Name: 'status',
                Value: 'stuck',
              },
            ],
            Unit: 'Count',
            Timestamp: new Date(),
            Value: 1,
          },
        ],
        Namespace,
      });

      client.send(command, err => {
        if (err) throw err;
      });
    }
  });

  scheduler.events.on('reset', (job: JobAttributes) => {
    const MetricName = job.name.toUpperCase();
    const command = new PutMetricDataCommand({
      MetricData: [
        {
          MetricName,
          Dimensions: [
            {
              Name: 'service',
              Value: service,
            },
            {
              Name: 'status',
              Value: 'restarted',
            },
          ],
          Unit: 'Count',
          Timestamp: new Date(),
          Value: 1,
        },
      ],
      Namespace,
    });

    client.send(command);
  });

  scheduler.events.on('pending', (data: PendingJobs) => {
    for (const [name, count] of Object.entries(data)) {
      const MetricName = name.toUpperCase();
      const command = new PutMetricDataCommand({
        MetricData: [
          {
            MetricName,
            Dimensions: [
              {
                Name: 'service',
                Value: service,
              },
              {
                Name: 'status',
                Value: 'pending',
              },
            ],
            Unit: 'Count',
            Timestamp: new Date(),
            Value: count,
          },
        ],
        Namespace,
      });

      client.send(command);
    }
  });
};

export default schedulerMetrics;
