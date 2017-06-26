// @flow

import KafkaProducer from '../producer/kafka';
import SqsProducer from '../producer/sqs';
import type { IProducer, Configuration, IRegistry, Logger } from '../../types';

type ProducersType = {
  [key: string]: typeof KafkaProducer | typeof SqsProducer,
};

const Producers: ProducersType = {
  kafka: KafkaProducer,
  sqs: SqsProducer,
};

const getProducer = (
  type: string,
  config: Configuration,
  registry: IRegistry,
  logger: Logger,
): IProducer => new Producers[type](config, registry, logger);

export default getProducer;
