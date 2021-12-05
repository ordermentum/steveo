import KafkaRunner from '../runner/kafka';
import SqsRunner from '../runner/sqs';
import RedisRunner from '../runner/redis';
import { Hooks, Pool, Configuration, IRegistry, Logger } from '../common';

type RunnersType = {
  [key: string]: typeof KafkaRunner | typeof SqsRunner | typeof RedisRunner;
};
const Runners: RunnersType = {
  kafka: KafkaRunner,
  sqs: SqsRunner,
  redis: RedisRunner,
};

const getRunner = ({
  config,
  registry,
  pool,
  logger,
  hooks,
}: {
  config: Configuration;
  registry: IRegistry;
  pool: Pool<any>;
  logger: Logger;
  hooks?: Hooks;
}) => new Runners[config.engine]({ config, registry, pool, logger, hooks });

export default getRunner;
