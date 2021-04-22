import KafkaProducer from '../producer/kafka';
import SqsProducer from '../producer/sqs';
import RedisProducer from '../producer/redis';
import { Configuration, IRegistry, Logger } from '../common';
import DummyProducer from '../producer/dummy';

type ProducersType = {
  [key: string]:
    | typeof KafkaProducer
    | typeof SqsProducer
    | typeof DummyProducer
    | typeof RedisProducer;
};

const Producers: ProducersType = {
  kafka: KafkaProducer,
  sqs: SqsProducer,
  redis: RedisProducer,
  dummy: DummyProducer,
};

const getProducer = (
  type: string,
  config: Configuration,
  registry: IRegistry,
  logger: Logger
) => new Producers[type](config, registry, logger);

export default getProducer;
