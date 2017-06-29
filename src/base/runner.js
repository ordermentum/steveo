// @flow

import KafkaRunner from '../runner/kafka';
import SqsRunner from '../runner/sqs';
import RedisRunner from '../runner/redis';
import type { IRunner, Configuration, IRegistry, Logger } from '../../types';

type RunnersType = {
  [key: string]: typeof KafkaRunner | typeof SqsRunner | typeof RedisRunner,
}
const Runners: RunnersType = {
  kafka: KafkaRunner,
  sqs: SqsRunner,
  redis: RedisRunner,
};

const getRunner = (
  type: string,
  config: Configuration,
  registry: IRegistry,
  logger: Logger,
): IRunner => new Runners[type](config, registry, logger);

export default getRunner;
