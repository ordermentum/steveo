import RedisSMQ from 'rsmq';
import { Configuration } from '../common';

const redis = (config: Configuration): RedisSMQ => {
  const instance = new RedisSMQ({
    host: config.redisHost,
    port: config.redisPort,
    ns: 'rsmq',
  });
  return instance;
};

export default {
  redis,
};
