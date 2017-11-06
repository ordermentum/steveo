// @flow

import BaseProducer from './producer/base';
import KafkaProducer from './producer/kafka';
import SqsProducer from './producer/sqs';
import RedisProducer from './producer/redis';

import type { IProducer, Configuration, IRegistry, Logger } from '../types';

type ProducersType = {
  [key: string]: BaseProducer,
};

const Producers: ProducersType = {
  kafka: KafkaProducer,
  sqs: SqsProducer,
  redis: RedisProducer,
};

function getProducer(
  type: string,
  config: Configuration,
  registry: IRegistry,
  logger: Logger,
): IProducer {
  const producer: IProducer = new Producers[type](config, registry, logger);
  return producer;
}

export default getProducer;
