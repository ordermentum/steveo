"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const steveo_1 = __importDefault(require("steveo"));
const https_1 = __importDefault(require("https"));
const config_1 = __importDefault(require("config"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
const workerCount = config_1.default.get('steveoWorkerCount');
const steveoPollInterval = config_1.default.get('steveoPollInterval');
const nodeEnv = config_1.default.get('nodeEnv');
const awsAccessKey = config_1.default.has('awsAccessKey')
    ? config_1.default.get('awsAccessKey')
    : undefined;
const awsSecretKey = config_1.default.has('awsSecretKey')
    ? config_1.default.get('awsSecretKey')
    : undefined;
const awsRegion = config_1.default.get('awsRegion');
const sandbox = config_1.default.get('sandbox');
const sqsEndpoint = config_1.default.has('sqsEndpoint')
    ? config_1.default.get('sqsEndpoint')
    : undefined;
const steveoConfig = {
    region: awsRegion,
    apiVersion: '2012-11-05',
    receiveMessageWaitTimeSeconds: '20',
    messageRetentionPeriod: '604800',
    engine: 'sqs',
    queuePrefix: sandbox ? 'testing' : `${nodeEnv}`,
    accessKeyId: awsAccessKey,
    secretAccessKey: awsSecretKey,
    shuffleQueue: false,
    endpoint: sqsEndpoint,
    maxNumberOfMessages: 1,
    workerConfig: {
        max: workerCount,
    },
    visibilityTimeout: 180,
    waitTimeSeconds: 2,
    consumerPollInterval: steveoPollInterval,
    httpOptions: nodeEnv === 'development'
        ? {
            agent: new https_1.default.Agent({
                rejectUnauthorized: false,
            }),
        }
        : undefined,
    tasksPath: path_1.default.resolve(__dirname, './tasks'),
    upperCaseNames: true,
};
const steveo = (0, steveo_1.default)(steveoConfig, logger_1.default);
steveo.events.on('runner_failure', async (topic, ex, params) => {
    logger_1.default.error(ex, { tags: { topic }, params });
});
steveo.events.on('producer_failure', async (topic, ex, params) => {
    logger_1.default.error(ex, { tags: { topic }, params });
});
steveo.events.on('producer_success', async (topic, data) => {
    logger_1.default.info('Message succesfully produced', topic, data);
});
steveo.events.on('task_failure', async (topic, ex, params) => {
    logger_1.default.error(ex, { tags: { topic }, params });
});
exports.default = steveo;
