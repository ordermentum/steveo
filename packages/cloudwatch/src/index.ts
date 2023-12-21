import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { JobContext as PrismaJobContext, JobScheduler as PrismaScheduler } from "@steveojs/scheduler-prisma";
import { JobScheduler as SequelizeScheduler } from "@steveojs/scheduler-sequelize";
import { JobCreationAttributes, JobInstance } from "@steveojs/scheduler-sequelize/lib/models/job";

type Job = PrismaJobContext['job'] | JobInstance;
type JobAttributes = JobCreationAttributes | PrismaJobContext['job'];

const client = new CloudWatchClient();
const Namespace = 'OM-DB-Jobs';

export const schedulerMetrics = (scheduler: PrismaScheduler | SequelizeScheduler, service: string) => {
  scheduler.events.on('duration', (job: Job, timeSecs: number, success: boolean) => {
    const MetricName = `${job!.name.toUpperCase()}_RUNNING`;
    const command = new PutMetricDataCommand({
      MetricData: [{
        MetricName,
        Dimensions: [{
          Name: 'success',
          Value: success ? 'true' : 'false',
        }, {
          Name: 'service',
          Value: service
        }, {
          Name: 'duration_secs',
          Value: timeSecs.toString()
        }],
        Unit: 'None',
        Timestamp: new Date(),
        Value: 1
      }],
      Namespace
    });

    client.send(command);
  });

  scheduler.events.on('lagged', (jobs: JobAttributes[]) => {
    for (let job of jobs) {
      const MetricName = `${job!.name.toUpperCase()}_STUCK`;
      const command = new PutMetricDataCommand({
        MetricData: [{
          MetricName,
          Dimensions: [{
            Name: 'service',
            Value: service
          }],
          Unit: 'None',
          Timestamp: new Date(),
          Value: 1
        }],
        Namespace
      });

      client.send(command, (err) => {
        if (err) throw err;
      });
    }
  });

  scheduler.events.on('reset', (job: JobAttributes) => {
    const MetricName = `${job!.name.toUpperCase()}_RESTART`;
    const command = new PutMetricDataCommand({
      MetricData: [{
        MetricName,
        Dimensions: [{
          Name: 'service',
          Value: service
        }],
        Unit: 'None',
        Timestamp: new Date(),
        Value: 1
      }],
      Namespace
    });

    client.send(command);
  });
};

export default schedulerMetrics;
