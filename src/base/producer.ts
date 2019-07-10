import KafkaProducer from '../producer/kafka';
import SqsProducer from '../producer/sqs';
import RedisProducer from '../producer/redis';
import { IProducer, Configuration, IRegistry, Logger } from '../../types';

type ProducersType = {
  [key: string]:
    | typeof KafkaProducer
    | typeof SqsProducer
    | typeof RedisProducer;
};

const Producers: ProducersType = {
  kafka: KafkaProducer,
  sqs: SqsProducer,
  redis: RedisProducer,
};

const getProducer = (
  type: string,
  config: Configuration,
  registry: IRegistry,
  logger: Logger
) => new Producers[type](config, registry, logger);

export default getProducer;
