import KafkaRunner from '../consumers/kafka';
import SqsRunner from '../consumers/sqs';
import RedisRunner from '../consumers/redis';
import { Steveo } from '..';

type RunnersType = {
  [key: string]: typeof KafkaRunner | typeof SqsRunner | typeof RedisRunner;
};
const Runners: RunnersType = {
  kafka: KafkaRunner,
  sqs: SqsRunner,
  redis: RedisRunner,
};

const getRunner = (steveo: Steveo) => new Runners[steveo.config.engine](steveo);

export default getRunner;
