import KafkaProducer from '../producers/kafka';
import SqsProducer from '../producers/sqs';
import RedisProducer from '../producers/redis';
import {
  IRegistry,
  KafkaConfiguration,
  RedisConfiguration,
  SQSConfiguration,
} from '../common';
import { Logger } from './logger';

const getProducer = (
  type: 'kafka' | 'redis' | 'sqs',
  config: KafkaConfiguration | RedisConfiguration | SQSConfiguration,
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
  throw new Error('Invalid producer type');
};

export default getProducer;
