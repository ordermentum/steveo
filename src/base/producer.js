// @flow

import KafkaProducer from '../producer/kafka';
import type { IProducer, Configuration, IRegistry, Logger } from '../../types';

type ProducersType = {
  [key: string]: typeof KafkaProducer,
};

const Producers: ProducersType = {
  kafka: KafkaProducer,
};

const getProducer = (
  type: string,
  config: Configuration,
  registry: IRegistry,
  logger: Logger,
): IProducer => new Producers[type](config, registry, logger);

export default getProducer;
