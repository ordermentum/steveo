import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

const redisOptions = {
  retryStrategy: (times: number) => {
    // logger.error('attempting to connect/reconnect to redis');
    return Math.min(times * 100, 3000);
  },
  reconnectOnError: (_err: unknown) => {
    // logger.error('connection error', err);
    return true;
  },
} as Record<string, any>;

if (process.env.REDIS_USE_TLS === 'true') {
  redisOptions.tls = true;
}
if (process.env.REDIS_PASSWORD) {
  redisOptions.password = process.env.REDIS_PASSWORD;
}

const client = new Redis({
  host: REDIS_URL,
  keyPrefix: 'payments',
  ...redisOptions,
});

process.on('exit', _code => {
  // logger.info(`exiting with code: ${code}`);
  client.quit();
});

export default client;
