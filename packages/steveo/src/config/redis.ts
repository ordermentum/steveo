import RedisSMQ from 'rsmq';
import { RedisConfiguration } from '../common';

export const redis = (config: RedisConfiguration): RedisSMQ => {
  const instance = new RedisSMQ({
    host: config.redisHost,
    port: config.redisPort,
    ns: config.namespace ?? 'steveo',
  });

  return instance;
};

export default {
  redis,
};
