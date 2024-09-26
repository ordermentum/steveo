import { expect } from 'chai';
import { Steveo } from 'steveo';

import sinon from 'sinon';
import tracer, { SpanOptions } from 'dd-trace';
import { MiddlewareCallback, MiddlewareContext } from 'steveo/lib/common';
import DataDogMiddleware from '../src';

describe('DataDogMiddleware', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('add to steveo', () => {
    const middleware = new DataDogMiddleware();
    const steveo = new Steveo({
      engine: 'dummy',
      middleware: [middleware],
    });

    expect(steveo.middleware.length).to.equal(1);
  });

  describe('publish', () => {
    it('should call tracer.trace and inject datadogContextData into context.payload._meta if span exists', () => {
      const middleware: DataDogMiddleware = new DataDogMiddleware();
      const injectStub = sinon.stub(tracer, 'inject');
      injectStub.calledWith(
        sinon.match.typeOf('SpanContext'),
        middleware.DATADOG_CONTEXT_FORMAT,
        {}
      );

      const fakeSpanData = {
        spanId: '12345678910',
        traceId: '10987654321',
      };
      sinon
        .stub(DataDogMiddleware.prototype, <any>'getDatadogContextData')
        .returns(fakeSpanData);

      const expectedDatadogContext: Record<string, any> = {
        datadog: fakeSpanData,
      };
      const next: MiddlewareCallback = (
        context: MiddlewareContext
      ): Promise<void> => {
        expect(expectedDatadogContext).to.be.deep.equal(context.payload._meta);
        return Promise.resolve();
      };

      const context: MiddlewareContext = {
        payload: { key: 'value' },
        topic: 'test-topic',
      };
      middleware.publish(context, next);
    });

    it('should make sure tracer.tracer calls the next function with context as argument', async () => {
      const context: MiddlewareContext = {
        topic: 'test-topic',
        payload: {
          _meta: {},
        },
      };

      const middleware: DataDogMiddleware = new DataDogMiddleware();
      middleware.publish(
        context,
        (middlewareContext: MiddlewareContext): Promise<void> => {
          expect(middlewareContext).to.be.deep.equal(context);
          return Promise.resolve();
        }
      );
    });
  });

  describe('consume', () => {
    it('should call tracer.trace without childOf when spanContext does not exist', async () => {
      const context: MiddlewareContext = {
        topic: 'test-topic',
        payload: {
          _meta: {},
        },
      };
      const expectedTracerOptions: tracer.TraceOptions & SpanOptions = {
        resource: context.topic,
        tags: {
          ...context.payload,
        },
      };
      const middleware: DataDogMiddleware = new DataDogMiddleware();
      const tracerStub = sinon.stub(tracer);
      tracerStub.extract.callsFake((format: string, carrier: any) => {
        expect(middleware.DATADOG_CONTEXT_FORMAT).to.be.equal(format);
        expect({}).to.be.deep.equal(carrier);
        return null;
      });
      tracerStub.trace.callsFake(
        (name: string, options: tracer.TraceOptions, _) => {
          expect(name).to.be.equal('steveo.consume');
          expect(options).to.be.deep.equal(expectedTracerOptions);
        }
      );

      await middleware.consume(
        context,
        (_: MiddlewareContext): Promise<void> => Promise.resolve()
      );
    });

    it('should call tracer.trace with childOf when spanContext exists', async () => {
      const expectedContext: MiddlewareContext = {
        payload: {
          _meta: {
            datadog: {
              traceId: 'abc123',
              spanId: '321abc',
            },
          },
        },
        topic: 'test-topic',
      };

      const tracerStub = sinon.stub(tracer, 'trace');
      tracerStub.callsFake((name: string, options: tracer.TraceOptions, _) => {
        expect(name).to.be.equal('steveo.consume');
        expect(options).to.have.property('childOf');
      });

      const middleware: DataDogMiddleware = new DataDogMiddleware();
      await middleware.consume(
        expectedContext,
        (_: MiddlewareContext): Promise<void> => Promise.resolve()
      );
    });

    it('should make sure tracer.tracer calls the next function with context as argument', async () => {
      const context: MiddlewareContext = {
        topic: 'test-topic',
        payload: {
          _meta: {},
        },
      };

      const middleware: DataDogMiddleware = new DataDogMiddleware();
      await middleware.consume(
        context,
        (middlewareContext: MiddlewareContext): Promise<void> => {
          expect(middlewareContext).to.be.deep.equal(context);
          return Promise.resolve();
        }
      );
    });
  });
});
