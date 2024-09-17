/* eslint-disable no-underscore-dangle */
import tracer, { SpanOptions } from 'dd-trace';
import { Middleware } from 'steveo';
import { MiddlewareContext } from 'steveo/lib/common';

export class DataDogMiddleware implements Middleware {
  public publish(context, next) {
    return tracer.trace(
      'steveo.publish',
      {
        resource: context.topic,
        tags: {
          ...context.payload,
        },
      },
      (span: tracer.Span | undefined) => {
        if (span) {
          const datadogContextData: Record<string, any> = {};
          tracer.inject(span, 'text_map', datadogContextData);
          const meta = this.getMetaFromContext(context);
          meta.datadog = datadogContextData;
          context.payload._meta = meta;
        }
        next(context);
      }
    );
  }

  public async consume(context, next) {
    const tracerOptions: tracer.TraceOptions & SpanOptions = {
      resource: context.topic,
      tags: {
        ...context.payload,
      },
    };

    const meta: Record<string, any> = this.getMetaFromContext(context);
    const datadogContext = meta.datadog ?? {};
    const spanContext: tracer.SpanContext | null = tracer.extract(
      'text_map',
      datadogContext
    );
    if (spanContext) {
      tracerOptions.childOf = spanContext;
    }

    return tracer.trace('steveo.consume', tracerOptions, () => next(context));
  }

  private getMetaFromContext(context: MiddlewareContext): Record<string, any> {
    return context.payload._meta ?? {};
  }
}

export default DataDogMiddleware;
