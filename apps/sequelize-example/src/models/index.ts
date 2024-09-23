import { Sequelize, ModelCtor } from 'sequelize';
import config from 'config';
import { associable } from '../types';
import logger from '../logger';
import jobModelFactory, { JobInstance } from './job';

export type JobModel = associable<JobInstance> | ModelCtor<JobInstance>;

const databaseUri = config.get<string>('db.uri');
const lagInMinutes = config.get<number>('lagInMinutes');
const blockedInMinutes = config.get<number>('blockedInMinutes');

const sequelize = new Sequelize(databaseUri, {
  dialect: 'postgres',
  logging: logger.debug.bind(logger),
});

export const Job = jobModelFactory(sequelize, lagInMinutes, blockedInMinutes);

const db = {
  Job,
};

Object.values(db).forEach(model => {
  if ('associate' in model && model.associate) {
    model.associate(db);
  }
});

export default {
  sequelize,
  Job,
};
