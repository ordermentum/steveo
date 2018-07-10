// @flow

import KafkaRunner from '../runner/kafka';
import SqsRunner from '../runner/sqs';
import RedisRunner from '../runner/redis';
import type { Hooks, IRunner, Pool, Configuration, IRegistry, Logger } from '../../types';

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
  pool: Pool,
  logger: Logger,
  hooks: Hooks,
): IRunner => new Runners[type](config, registry, pool, logger, hooks);

export default getRunner;
