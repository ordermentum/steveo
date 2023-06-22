const bunyan = require('bunyan');

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  sandbox: process.env.SANDBOX || false,
  logger: {
    level: bunyan.INFO,
  },
  serviceName: 'netsuite',
  // Token for segment analytics
  segmentToken: process.env.SEGMENT_TOKEN || '0000',
  useSegment: process.env.USE_SEGMENT || false,
  jwtSecret: process.env.JWT_SECRET || 'testsecret',
  steveoWorkerCount: process.env.STEVEO_WORKER_COUNT || 1,
  sentryDSN: process.env.SENTRY_DSN || 'netsuite',
  steveoPollInterval: process.env.STEVEO_POLL_INTERVAL || 1000,
  awsAccessKey: process.env.AWS_ACCESS_KEY,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  kafka: {
    bootstrapServers: process.env.KAFKA_BOOTSTRAP_SERVERS || '',
    consumerGroupId:
      process.env.KAFKA_CONSUMER_GROUP_ID || 'netsuite_CONSUMERS',
    defaultPartitions: 3,
  },
  db: {
    uri: process.env.DATABASE_URI,
    initializationUri: process.env.DATABASE_INITIALIZATION_URI,
    name: 'netsuite',
  },
  defaultJobRunInterval: process.env.DEFAULT_JOB_LAG || 5000, // seconds
};
