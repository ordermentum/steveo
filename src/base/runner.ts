import KafkaRunner from '../runner/kafka';
import SqsRunner from '../runner/sqs';
import RedisRunner from '../runner/redis';
import { Steveo } from '..';

type RunnersType = {
  [key: string]: typeof KafkaRunner | typeof SqsRunner | typeof RedisRunner;
};
const Runners: RunnersType = {
  kafka: KafkaRunner,
  sqs: SqsRunner,
  redis: RedisRunner,
};

const getRunner = ({ steveo }: { steveo: Steveo }) =>
  new Runners[steveo.config.engine]({ steveo });

export default getRunner;
