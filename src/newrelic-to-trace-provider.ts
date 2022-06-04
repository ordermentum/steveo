import type {
  getTransaction,
  noticeError,
  startBackgroundTransaction,
  startSegment,
} from 'newrelic';
import { inspect } from 'util';
import type { TraceProvider } from './common';

// OVERALL FLOW
// first wrapHandler: producer | ctx in undefined                 | ctx exposed {txName,transaction} | message context set
// second wrapHandler: runner  | ctx in {distributedTraceHeaders} | ctx exposed {txName,transaction}

// do we need to expose ctx.transaction at all?

export const getTraceProvider = (newrelic: {
  getTransaction: typeof getTransaction;
  noticeError: typeof noticeError;
  startBackgroundTransaction: typeof startBackgroundTransaction;
  startSegment: typeof startSegment;
}): TraceProvider | undefined => {
  if (!newrelic) {
    return undefined;
  }

  return {
    /**
     * Used to create a New Relic transaction that encompasses the work done
     * within the provided callback.
     */
    wrapHandler: async (
      txName: string,
      traceContext: unknown,
      callback: (traceContext: unknown) => Promise<any>
    ) => {
      const context: any = traceContext || {};
      context.txName = txName;

      await newrelic.startBackgroundTransaction(txName, async () => {
        context.transaction = newrelic.getTransaction();
        if (context.distributedTraceHeaders) {
          context.transaction.acceptDistributedTraceHeaders(
            'Queue',
            context.distributedTraceHeaders
          );
          delete context.distributedTraceHeaders;
        }
        await callback(context);
      });
    },

    /**
     * @description Used inside the wrapHandler callback to wrap a specfic unit
     * of work.
     */
    wrapHandlerSegment: async (
      segmentName: string,
      traceContext: any,
      callback: (...args: any[]) => any
    ): Promise<void> => {
      await newrelic.startSegment(
        segmentName || `${traceContext?.txName}-segment`,
        true,
        callback
      );
    },

    // if this doesnt work try a fn, and then
    // I'll need to pass newrelic in the context as a fn arg
    onError: async (err: Error, _) => {
      newrelic.noticeError(err);
    },

    /**
     * @description Used to propagate traces. Accepts a traceContext instance
     * and returns a serialised trace metadata string that can be included in
     * a message payload. The trace metadata can then be deserialised by the
     * message consumer.
     */
    serializeTraceMetadata: async (traceContext: unknown): Promise<string> => {
      const context: any = traceContext;
      if (!context?.transaction) {
        throw new Error('Property `transaction` missing from context');
      }

      const traceHeaders = {};
      context.transaction.insertDistributedTraceHeaders(traceHeaders);
      return JSON.stringify(traceHeaders);
    },

    /**
     * @description Used to propagate traces. Accepts a serialised trace
     * metadata string and returns a traceContext instance that can be passed
     * to the wrapHandler.
     */
    deserializeTraceMetadata: async (
      traceMetadata: string
    ): Promise<unknown> => ({
      distributedTraceHeaders: JSON.parse(traceMetadata),
    }),
  };
};
