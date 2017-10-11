// @flow

import KafkaMetric from './metric/kafka';
import SqsMetric from './metric/sqs';
import RedisMetric from './metric/redis';

import type { IMetric, Configuration, Logger } from '../types';

type MetricType = {
  [key: string]: typeof KafkaMetric | typeof SqsMetric | typeof RedisMetric,
};

const Metrics: MetricType = {
  kafka: KafkaMetric,
  sqs: SqsMetric,
  redis: RedisMetric,
};

const getMetric = (
  type: string,
  config: Configuration,
  logger: Logger,
): IMetric => new Metrics[type](config, logger);

export default getMetric;
