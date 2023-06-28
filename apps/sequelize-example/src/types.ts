import { ModelCtor, Sequelize, Model } from 'sequelize';
import { JobInstance } from './models/job';

// Sequelize types
export type dbList = { [modelName: string]: ModelCtor<Model> };
export type associable<T extends Model> = ModelCtor<T> & {
  associate?: (db: dbList) => void;
};

export type modelFactory<T extends Model> = (
  sequelize: Sequelize,
  lagInMinutes: number,
  blockedInMinutes: number
) => associable<T> | ModelCtor<T>;

export type Properties = {
  [key: string]: any;
};

export type JobSet = {
  name: string;
  priority: number;
  total: number;
  items: JobInstance[];
};
