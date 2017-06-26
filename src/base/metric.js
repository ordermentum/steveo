// @flow

import KafkaMetric from '../metric/kafka';
import SqsMetric from '../metric/sqs';
import type { IMetric, Configuration, Logger } from '../../types';

type MetricType = {
  [key: string]: typeof KafkaMetric | typeof SqsMetric,
};

const Metrics: MetricType = {
  kafka: KafkaMetric,
  sqs: SqsMetric,
};

const getMetric = (
  type: string,
  config: Configuration,
  logger: Logger,
): IMetric => new Metrics[type](config, logger);

export default getMetric;
