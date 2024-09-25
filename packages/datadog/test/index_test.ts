import { expect } from 'chai';
import { Steveo } from 'steveo';
import DataDogMiddleware from '../src';

import sinon from 'sinon';
import tracer from 'dd-trace';
import {MiddlewareCallback, MiddlewareContext} from 'steveo/lib/common';

describe('DataDogMiddleware', () => {
  let middleware: DataDogMiddleware;

  beforeEach(() => {
    middleware = new DataDogMiddleware();
  });

  afterEach(() => {
    sinon.restore(); // Restore original functionality after each test
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

      const injectStub = sinon.stub(tracer, "inject");
      injectStub.calledWith(sinon.match.typeOf('SpanContext'), 'text_map', {})

      const fakeSpanData = {
        spanId: '12345678910',
        traceId: '10987654321',
      }
      sinon.stub(DataDogMiddleware.prototype, <any>'getDatadogContextData')
        .returns(fakeSpanData);

      const expectedDatadogContext = {
        datadog: fakeSpanData
      }
      const next: MiddlewareCallback = (context: MiddlewareContext): Promise<void> => {
        expect(expectedDatadogContext).to.be.deep.equal(context.payload._meta)
        return Promise.resolve();
      };

      const context: MiddlewareContext = {
        payload: { key: 'value' },
        topic: 'test-topic',
      };
      middleware.publish(context, next);
    });
  });
});

describe('DataDogMiddleware', () => {
  it('add to steveo', () => {
    const middleware = new DataDogMiddleware();
    const steveo = new Steveo({
      engine: 'dummy',
      middleware: [middleware],
    });

    expect(steveo.middleware.length).to.equal(1);
  });
});
