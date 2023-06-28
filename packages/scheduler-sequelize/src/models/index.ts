import { Sequelize, ModelCtor } from 'sequelize';
import { JobScheduler } from '../index';
import { associable } from '../types';

import jobModelFactory, { JobInstance } from './job';

export type JobModel = associable<JobInstance> | ModelCtor<JobInstance>;
export default ({
  databaseUri,
  logger,
  lagInMinutes,
  blockedInMinutes,
}: JobScheduler): {
  sequelize: Sequelize;
  Job: JobModel;
} => {
  /**
   * Note: You'll have to mock sequelize model methods because migrations don't exist in this service
   * This tries to connect to the replica and isn't responsible for migrating relationships
   */
  const sequelize = new Sequelize(databaseUri, {
    dialect: 'postgres',
    logging: logger.debug.bind(logger),
  });

  const Job = jobModelFactory(sequelize, lagInMinutes, blockedInMinutes);

  const db = {
    Job,
  };

  Object.values(db).forEach(model => {
    if ('associate' in model && model.associate) {
      model.associate(db);
    }
  });

  return {
    sequelize,
    Job,
  };
};
