import { Configuration } from '../common';

const redis = (config: Configuration) => {
  const RedisSMQ = require('rsmq'); //eslint-disable-line
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
