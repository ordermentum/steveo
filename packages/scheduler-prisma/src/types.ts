import { Job } from '@prisma/client';

export type Properties = {
  [key: string]: any;
};

export type JobSet = {
  name: string;
  priority: number;
  total: number;
  items: Job[];
};
