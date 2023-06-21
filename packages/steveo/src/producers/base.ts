import { Middleware } from '../common';
import { composePublish } from '../middleware';

export class BaseProducer {
  middleware: Middleware[];

  constructor(middleware: Middleware[]) {
    this.middleware = middleware;
  }

  get wrap() {
    return composePublish(this.middleware ?? []);
  }

  async reconnect() {}

  async stop() {}
}
