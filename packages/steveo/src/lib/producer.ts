import KafkaProducer from '../producers/kafka';
import SqsProducer from '../producers/sqs';
import RedisProducer from '../producers/redis';
import {
  DummyConfiguration,
  IRegistry,
  KafkaConfiguration,
  Logger,
  RedisConfiguration,
  SQSConfiguration,
} from '../common';
import DummyProducer from '../producers/dummy';

const getProducer = (
  type: 'kafka' | 'redis' | 'sqs' | 'dummy',
  config:
    | KafkaConfiguration
    | RedisConfiguration
    | SQSConfiguration
    | DummyConfiguration,
  registry: IRegistry,
  logger: Logger
) => {
  if (type === 'kafka') {
    return new KafkaProducer(config as KafkaConfiguration, registry, logger);
  }
  if (type === 'redis') {
    return new RedisProducer(config as RedisConfiguration, registry, logger);
  }
  if (type === 'sqs') {
    return new SqsProducer(config as SQSConfiguration, registry, logger);
  }

  return new DummyProducer(config as DummyConfiguration, registry, logger);
};

export default getProducer;
