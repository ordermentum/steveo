// @flow

import type { Configuration } from '../types';
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

  constructor(config: Configuration) {
    this.kafkaConnection = config.kafkaConnection;
    this.clientId = config.clientId;
    this.kafkaGroupId = config.kafkaGroupId || 'STEVEO_TASKS';
    this.kafkaCodec = config.kafkaCodec || kafkaCompression.GZIP;
    this.logLevel = config.logLevel || 5;
    this.kafkaSendAttempts = config.kafkaSendAttempts || 2;
    this.kafkaSendDelayMin = config.kafkaSendDelayMin || 100;
    this.kafkaSendDelayMax = config.kafkaSendDelayMax || 300;
  }
}
