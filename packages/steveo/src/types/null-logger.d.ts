declare module 'null-logger' {
  type Logger = {
    trace(format: any, ...params: any[]): void;
    info(format: any, ...params: any[]): void;
    debug(format: any, ...params: any[]): void;
    error(format: any, ...params: any[]): void;
    child(options: any): Logger;
  };
  let logger: Logger;
  export = logger;
}
