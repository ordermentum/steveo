import IORedis from 'ioredis';
import { RedisConfiguration } from '../common';

export const getRedisInstance = (config: RedisConfiguration) =>
  new IORedis(config.connectionUrl);
