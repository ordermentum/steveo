// @flow

import type { Configuration, Engine } from '../types';
import { kafkaCompression } from './index';

export default class Config {
  kafkaConnection: string;
  clientId: string;
  kafkaGroupId: string;
  kafkaCodec: number | string;
  logLevel: number;
  kafkaSendAttempts: number;
  kafkaSendDelayMin: number;
  kafkaSendDelayMax: number;
  engine: Engine;
  region: string;
  apiVersion: string;
  messageRetentionPeriod: string;
  receiveMessageWaitTimeSeconds: string;
  accessKeyId: string;
  shuffleQueue: boolean;
  secretAccessKey: string;
  maxNumberOfMessages: number;
  visibilityTimeout: number;
  waitTimeSeconds: number;
  redisHost: string;
  redisPort: string;
  redisMessageMaxsize: number;
  consumerPollInterval: number;
  workerConfig: Object;

  constructor(config: Configuration) {
    this.engine = config.engine || 'kafka';
    this.shuffleQueue = false || config.shuffleQueue;
    this.workerConfig = {} || config.workerConfig;

    if (this.engine === 'kafka') {
      this.kafkaConnection = config.kafkaConnection;
      this.clientId = config.clientId;
      this.kafkaGroupId = config.kafkaGroupId || 'STEVEO_TASKS';
      this.kafkaCodec = config.kafkaCodec || kafkaCompression.GZIP;
      this.logLevel = config.logLevel || 5;
      this.kafkaSendAttempts = config.kafkaSendAttempts || 2;
      this.kafkaSendDelayMin = config.kafkaSendDelayMin || 100;
      this.kafkaSendDelayMax = config.kafkaSendDelayMax || 300;
      this.consumerPollInterval = config.consumerPollInterval || 1000;
    } else if (config.engine === 'sqs') {
      this.region = config.region;
      this.apiVersion = config.apiVersion;
      this.messageRetentionPeriod = config.messageRetentionPeriod;
      this.receiveMessageWaitTimeSeconds = config.receiveMessageWaitTimeSeconds;
      this.accessKeyId = config.accessKeyId;
      this.secretAccessKey = config.secretAccessKey;
      this.maxNumberOfMessages = config.maxNumberOfMessages;
      this.visibilityTimeout = config.visibilityTimeout;
      this.waitTimeSeconds = config.waitTimeSeconds;
    } else if (config.engine === 'redis') {
      this.redisHost = config.redisHost;
      this.redisPort = config.redisPort;
      this.visibilityTimeout = config.visibilityTimeout || 604800;
      this.redisMessageMaxsize = config.redisMessageMaxsize || 65536;
      this.consumerPollInterval = config.consumerPollInterval || 1000;
    }
  }
}
