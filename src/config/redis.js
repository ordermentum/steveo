// @flow

import bluebird from 'bluebird';
import type { Configuration } from '../../types';

const redis = (config: Configuration) => {
  const RedisSMQ = require('rsmq'); //eslint-disable-line
  const instance: Object = new RedisSMQ({
    host: config.redisHost,
    port: config.redisPort,
    ns: 'rsmq',
  });
  bluebird.promisifyAll(instance);
  return instance;
};

export default {
  redis,
};
