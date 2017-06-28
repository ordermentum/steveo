// @flow

import RedisSMQ from 'rsmq';
import bluebird from 'bluebird';
import type { Configuration } from '../../types';

const redis = (config: Configuration) => {
  const instance: Object = new RedisSMQ({
    host: config.redisHost,
    port: config.redisPort,
    ns: 'rsmq',
  });
  return bluebird.promisifyAll(instance);
};

export default {
  redis,
};
