/* eslint-disable no-console */

export type LogEntry =
  | string
  | {
      message: string;
      [key: string]: Object | undefined;
    };

export interface Logger {
  child(options: unknown): Logger;
  trace(format: LogEntry, ...params: any[]): void;
  info(format: LogEntry, ...params: any[]): void;
  debug(format: LogEntry, ...params: any[]): void;
  error(format: LogEntry, ...params: any[]): void;
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
