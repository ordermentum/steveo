import { LogEntry, Logger } from './logger';

export class AppError {
  constructor(logger: Logger, public obj: LogEntry) {
    logger.error(obj);
  }
}
