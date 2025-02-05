import { Middleware } from '../common';
import { composePublish } from '../middleware';

export class BaseProducer {
  middleware: Middleware[];

  constructor(middleware: Middleware[]) {
    this.middleware = middleware;
  }

  get wrap() {
    return composePublish(this.middleware);
  }

  // eslint-disable-next-line no-empty-function
  async reconnect() {}

  // eslint-disable-next-line no-empty-function
  async stop() {}
}
