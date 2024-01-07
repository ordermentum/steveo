/**
 * Note: This is a replica of https://github.com/ordermentum/ordermentum/blob/main/src/models/job.ts
 */
import Sequelize from 'sequelize';
import { associable, modelFactory, Properties } from '../types';

const { Op } = Sequelize;

export interface JobAttributes {
  id?: string;
  name: string;
  data?: Properties;
  lastFinishedAt?: string;
  lastRunAt?: string;
  lastModifiedBy?: string;
  nextRunAt?: string;
  acceptedAt?: string;
  repeatInterval?: string;
  type?: string;
  failReason?: Properties;
  failedAt?: string | null;
  priority?: number;
  failures?: number;
  queued?: boolean;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export type JobModel = JobAttributes & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  data: Properties;
  failReason: Properties;
  queued: boolean;
  timezone: string;
  priority: number;
  failures: number;
};

export interface JobInstance extends Sequelize.Model<JobAttributes>, JobModel {
}

const jobModelFactory: modelFactory<JobInstance> = (
  sequelize: Sequelize.Sequelize,
  lagInMinutes: number,
  blockedInMinutes: number
) => {
  const Job: associable<JobInstance> = sequelize.define<JobInstance>(
    'Job',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      data: { type: Sequelize.JSONB, defaultValue: {} },

      lastFinishedAt: { type: Sequelize.DATE, field: 'last_finished_at' },
      lastRunAt: { type: Sequelize.DATE, field: 'last_run_at' },

      lastModifiedBy: { type: Sequelize.STRING, field: 'last_modified_by' },
      nextRunAt: { type: Sequelize.DATE, field: 'next_run_at' },
      acceptedAt: {
        type: Sequelize.DATE,
        field: 'accepted_at',
        allowNull: true,
      },
      repeatInterval: { type: Sequelize.STRING, field: 'repeat_interval' },
      type: { type: Sequelize.STRING },
      priority: { type: Sequelize.INTEGER, defaultValue: 1 },
      failReason: {
        type: Sequelize.JSONB,
        field: 'fail_reason',
        defaultValue: {},
      },
      failedAt: { type: Sequelize.DATE, field: 'failed_at' },
      queued: { type: Sequelize.BOOLEAN, defaultValue: false },
      timezone: {
        type: Sequelize.STRING,
        defaultValue: 'UTC',
        allowNull: false,
      },
      failures: {
        defaultValue: 0,
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      createdAt: { type: Sequelize.DATE, field: 'created_at' },
      updatedAt: { type: Sequelize.DATE, field: 'updated_at' },
      deletedAt: { type: Sequelize.DATE, field: 'deleted_at' },
    },
    {
      tableName: 'jobs',
      paranoid: false,
      timestamps: true,
      underscored: true,
    }
  );
  // This specifically refers to jobs that have been in run state for longer than {blockedInMinutes} minutes without being accepted
  // where run:    queued == true && (accepted_at < last_finished_at < next_run_at < last_run_at < now())
  // and accepted: queued == true && (last_finished_at < next_run_at < last_run_at < accepted_at <= now())
  // First run case: accepted_at is null, last_finished_at is null, last_run_at is set
  Job.addScope('blocked', () => ({
    where: {
      queued: true,
      deletedAt: null,
      acceptedAt: {
        [Op.or]: {
          [Op.lte]: { [Op.col]: 'last_run_at' },
          [Op.eq]: null,
        },
      },
      lastRunAt: {
        [Op.lte]: Sequelize.literal(
          `CURRENT_TIMESTAMP - INTERVAL '${blockedInMinutes} minutes'`
        ),
      },
    },
  }));

  // These are jobs that were accepted > {lagInMinutes} minutes ago but never completed
  // e.g. highly likely that something has gone wrong and they haven't exited cleanly
  Job.addScope('laggy', () => ({
    where: {
      queued: true,
      lastRunAt: {
        [Op.lt]: {
          [Op.col]: 'accepted_at',
        },
      },
      lastFinishedAt: {
        [Op.or]: {
          [Op.lte]: Sequelize.literal(
            `CURRENT_TIMESTAMP - INTERVAL '${lagInMinutes} minutes'`
          ),
          [Op.eq]: null,
        },
      },
      acceptedAt: {
        [Op.lte]: Sequelize.literal(
          `CURRENT_TIMESTAMP - INTERVAL '${lagInMinutes} minutes'`
        ),
      },
    },
  }));

  return Job;
};

export default jobModelFactory;
