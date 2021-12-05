const sqsConfig = {
    region: process.env.AWS_REGION,
    apiVersion: '2012-11-05',
    receiveMessageWaitTimeSeconds: '20',
    messageRetentionPeriod: '604800',
    engine: 'sqs',
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    maxNumberOfMessages: 1,
    visibilityTimeout: 180,
    waitTimeSeconds: 20,
};

const kafkaConfig = {
    bootstrapServers: process.env.KAFKA_BROKERS,
};

const redisConfig = {
    redisHost: process.env.REDIS_HOST,
    redisPort: process.env.REDIS_PORT,
    engine: 'redis',
};

const steveoConfig = {
    kafka: kafkaConfig,
    sqs: sqsConfig,
    redis: redisConfig,
};

module.exports = steveoConfig;
