/* eslint-disable no-underscore-dangle */
import {
  propagation,
  context as otelContext,
  trace,
  Context,
  Tracer,
  Span,
  SpanKind,
} from '@opentelemetry/api';
import { Middleware, MiddlewareContext, Logger } from 'steveo';

export class OpenTelemetryMiddleware implements Middleware {
  tracer: Tracer;

  logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.tracer = trace.getTracer('steveo');
  }

  publish(context: MiddlewareContext, next) {
    const meta = context?.payload?._meta ?? {};

    const traceHeaders = {};
    propagation.inject(otelContext.active(), traceHeaders);
    const updatedPayload = {
      ...(context?.payload ?? {}),
      _meta: {
        ...meta,
        traceMetadata: JSON.stringify(traceHeaders),
      },
    };

    context.payload = updatedPayload;

    return this.tracer.startActiveSpan(
      context.topic,
      { kind: SpanKind.PRODUCER },
      async (span: Span) => {
        await next(context).catch(e => {
          span.recordException(e);
          throw e;
        });
      }
    );
  }

  async consume(context: MiddlewareContext, next) {
    const meta = context?.payload?._meta;
    let activeContext: Context = otelContext.active();
    if (typeof meta?.traceMetadata === 'string') {
      try {
        const distributedTraceHeaders = JSON.parse(meta?.traceMetadata);
        activeContext = propagation.extract(
          activeContext,
          distributedTraceHeaders
        );
      } catch (error) {
        this.logger.error('Error parsing trace metadata', error);
      }
    }

    return this.tracer.startActiveSpan(
      context.topic,
      { kind: SpanKind.CONSUMER },
      activeContext,
      async (span: Span) => {
        await next(context).catch(e => {
          span.recordException(e);
          throw e;
        });
      }
    );
  }
}

export default OpenTelemetryMiddleware;
