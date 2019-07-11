declare module "null-logger" {
    type Logger = {
      info(...any): void;
      trace(...any): void; 
      debug(...any): void;
      error(...any): void;
    };
    let logger: Logger;
    export = logger;
  }-