/* eslint-disable no-underscore-dangle */
import tracer, { SpanOptions } from 'dd-trace';
import { Middleware } from 'steveo';
import { MiddlewareContext } from 'steveo/lib/common';

export class DataDogMiddleware implements Middleware {
  public readonly DATADOG_CONTEXT_FORMAT: string = 'text_map';

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
          const messageMetadata = this.getMetaFromContext(context);
          const datadogContextData: Record<string, any> =
            this.getDatadogContextData(span);
          messageMetadata.datadog = datadogContextData;
          context.payload._meta = messageMetadata;
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

    const messageMetadata: Record<string, any> =
      this.getMetaFromContext(context);
    const datadogContext: Record<string, any> = messageMetadata.datadog ?? {};
    const spanContext: tracer.SpanContext | null = tracer.extract(
      this.DATADOG_CONTEXT_FORMAT,
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

  private getDatadogContextData(datadogSpan: tracer.Span): Record<string, any> {
    const contextData: Record<string, any> = {};
    tracer.inject(datadogSpan, this.DATADOG_CONTEXT_FORMAT, contextData);
    return contextData;
  }
}

export default DataDogMiddleware;
