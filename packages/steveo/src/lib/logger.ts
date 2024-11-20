/* eslint-disable no-console */

export type LogEntry =
  | string
  | {
      [key: string]: unknown | undefined;
    };

export interface Logger {
  child(options: unknown): Logger;
  trace(format: LogEntry, ...params: unknown[]): void;
  info(format: LogEntry, ...params: unknown[]): void;
  debug(format: LogEntry, ...params: unknown[]): void;
  error(format: LogEntry, ...params: unknown[]): void;
}

function factory<T>(baseEntry?: T): Logger {
  //
  function output(entry: LogEntry): void {
    const isString = typeof entry === 'string';
    const line = {
      ...(isString ? { message: entry } : entry),
      ...baseEntry,
    };

    console.log(JSON.stringify(line, null, 2));
  }

  return {
    child<ChildOptions>(parentEntries: ChildOptions): Logger {
      return factory({ ...baseEntry, ...parentEntries });
    },
    trace: output,
    info: output,
    debug: output,
    error: output,
  };
}

export const consoleLogger = factory();
