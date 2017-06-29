// @flow

import type { Configuration, IMetric, Logger } from '../../types';

class RedisMetric implements IMetric {
  config: Configuration;
  admin: Object;
  logger: Logger;

  constructor(config: Configuration, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async initialize() {
    this.logger.info('not implmented');
  }
}

export default RedisMetric;
