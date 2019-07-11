import { Configuration, IMetric, Logger } from '../../types';

class SqsMetric implements IMetric {
  config: Configuration;

  admin: any;

  logger: Logger;

  constructor(config: Configuration, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async initialize() {
    this.logger.debug('not implmented');
  }
}

export default SqsMetric;
