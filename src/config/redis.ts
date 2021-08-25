import RedisSMQ from 'rsmq';
import { Configuration, RedisConfiguration } from '../common';

const redis = (config: Configuration): RedisSMQ => {
  const redisConfig = config as RedisConfiguration;
  const instance = new RedisSMQ({
    host: redisConfig.redisHost,
    port: redisConfig.redisPort,
    ns: 'rsmq',
  });
  return instance;
};

export default {
  redis,
};
