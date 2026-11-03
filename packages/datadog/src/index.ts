/* eslint-disable no-underscore-dangle */
import tracer, { SpanOptions } from 'dd-trace';
import { Middleware } from 'steveo';
import { MiddlewareContext } from 'steveo/lib/common';

export type DataDogMiddlewareOptions = {
  // Operation name of the span each consumed message runs in, e.g. `<service>.consume`
  consumeOperationName?: string;
};

export class DataDogMiddleware implements Middleware {
  public readonly DATADOG_CONTEXT_FORMAT: string = 'text_map';

  public readonly consumeOperationName: string;

  constructor(options: DataDogMiddlewareOptions = {}) {
    this.consumeOperationName =
      options.consumeOperationName ?? 'steveo.consume';
  }

  public publish(context, next) {
    const traceOptions = this.createBaseTraceOptionsFromContext(context);
    return tracer.trace(
      'steveo.publish',
      traceOptions,
      (span: tracer.Span | undefined) => {
        const shouldConnectDatadogTrace = typeof context.payload !== 'string';
        if (span && shouldConnectDatadogTrace) {
          const messageMetadata = this.getMetaFromContext(context);
          messageMetadata.datadog = this.getDatadogContextData(span);
          context.payload._meta = messageMetadata;
        }
        next(context);
      }
    );
  }

  // Runs the handler inside a span so logs written by it carry dd.trace_id.
  // Only the topic is tagged: message payloads must not end up in span tags.
  public async consume(context, next) {
    const tracerOptions: tracer.TraceOptions & SpanOptions = {
      resource: context.topic,
      tags: { 'steveo.topic': context.topic },
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

    return tracer.trace(this.consumeOperationName, tracerOptions, () =>
      next(context)
    );
  }

  private getMetaFromContext(context: MiddlewareContext): Record<string, any> {
    return context.payload._meta ?? {};
  }

  private getDatadogContextData(datadogSpan: tracer.Span): Record<string, any> {
    const contextData: Record<string, any> = {};
    tracer.inject(datadogSpan, this.DATADOG_CONTEXT_FORMAT, contextData);
    return contextData;
  }

  private createBaseTraceOptionsFromContext(
    context: MiddlewareContext
  ): tracer.TraceOptions & SpanOptions {
    const shouldAddTags: boolean = typeof context.payload !== 'string';
    const tags = shouldAddTags ? { ...context.payload } : {};

    return {
      resource: context.topic,
      tags,
    };
  }
}

export default DataDogMiddleware;
