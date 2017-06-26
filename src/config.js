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
  secretAccessKey: string;

  constructor(config: Configuration) {
    this.engine = config.engine || 'kafka';
    if (this.engine === 'kafka') {
      this.kafkaConnection = config.kafkaConnection;
      this.clientId = config.clientId;
      this.kafkaGroupId = config.kafkaGroupId || 'STEVEO_TASKS';
      this.kafkaCodec = config.kafkaCodec || kafkaCompression.GZIP;
      this.logLevel = config.logLevel || 5;
      this.kafkaSendAttempts = config.kafkaSendAttempts || 2;
      this.kafkaSendDelayMin = config.kafkaSendDelayMin || 100;
      this.kafkaSendDelayMax = config.kafkaSendDelayMax || 300;
    } else if (config.engine === 'sqs') {
      this.region = config.region;
      this.apiVersion = config.apiVersion;
      this.messageRetentionPeriod = config.messageRetentionPeriod;
      this.receiveMessageWaitTimeSeconds = config.receiveMessageWaitTimeSeconds;
      this.accessKeyId = config.accessKeyId;
      this.secretAccessKey = config.secretAccessKey;
    }
  }
}
