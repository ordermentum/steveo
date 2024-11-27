import { LogEntry, Logger } from './logger';

export class AppError {
  constructor(
    logger: Logger,
    public message: string,
    public obj: LogEntry = {}
  ) {
    logger.error(obj, message);
  }
}
