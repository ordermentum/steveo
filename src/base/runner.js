// @flow

import KafkaRunner from '../runner/kafka';
import type { IRunner, Configuration, IRegistry, Logger } from '../../types';

type RunnersType = {
  [key: string]: typeof KafkaRunner,
}
const Runners: RunnersType = {
  kafka: KafkaRunner,
};

const getRunner = (
  type: string,
  config: Configuration,
  registry: IRegistry,
  logger: Logger,
): IRunner => new Runners[type](config, registry, logger);

export default getRunner;
