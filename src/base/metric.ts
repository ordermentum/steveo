import KafkaMetric from '../metric/kafka';
import SqsMetric from '../metric/sqs';
import RedisMetric from '../metric/redis';
import DummyMetric from '../metric/dummy';

import { IMetric, Configuration, Logger } from '../common';

type MetricType = {
  [key: string]:
    | typeof KafkaMetric
    | typeof SqsMetric
    | typeof RedisMetric
    | typeof DummyMetric;
};

const Metrics: MetricType = {
  kafka: KafkaMetric,
  sqs: SqsMetric,
  dummy: DummyMetric,
  redis: RedisMetric,
};

const getMetric = (
  type: string,
  config: Configuration,
  logger: Logger
): IMetric | null => {
  if (Metrics[type]) {
    return new Metrics[type](config, logger);
  }
  return null;
};

export default getMetric;
