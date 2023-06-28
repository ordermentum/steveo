/* eslint-disable no-underscore-dangle */
import * as Sentry from '@sentry/node';
import { Middleware } from 'steveo';

export class SentryMiddleware implements Middleware {
  async publish(_context, next) {
    return next();
  }

  async consume(context, next) {
    const transaction = Sentry.startTransaction({
      op: 'queue',
      name: context.topic,
    });

    await next().catch(e => {
      Sentry.captureException(e);
      throw e;
    });

    transaction.finish();
  }
}
