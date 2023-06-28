/* eslint-disable no-underscore-dangle */
import newrelic from 'newrelic';
import { Middleware } from 'steveo';

export class NewrelicMiddleware implements Middleware {
  publish(context, next) {
    const meta = context?.payload?._meta ?? {};

    const traceHeaders = {};
    context.transaction.insertDistributedTraceHeaders(traceHeaders);
    const updatedPayload = {
      ...(context?.payload ?? {}),
      _meta: {
        ...meta,
        traceMetadata: JSON.stringify(traceHeaders),
      },
    };

    context.payload = updatedPayload;

    return next();
  }

  async consume(context, next) {
    const meta = context?.payload?._meta;
    let distributedTraceHeaders;
    if (typeof meta?.traceMetadata === 'string') {
      distributedTraceHeaders = JSON.parse(meta?.traceMetadata);
    }

    return newrelic.startBackgroundTransaction(context.topic, async () => {
      const transaction = newrelic.getTransaction();

      if (distributedTraceHeaders) {
        transaction.acceptDistributedTraceHeaders(
          'Queue',
          distributedTraceHeaders
        );
      }

      await next().catch(e => {
        newrelic.noticeError(e);
        throw e;
      });
    });
  }
}

export default NewrelicMiddleware;
