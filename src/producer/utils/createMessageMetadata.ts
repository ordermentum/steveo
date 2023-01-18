import moment from 'moment';
import * as crypto from 'crypto';
import os from 'os';
import type { DistributedTraceHeaders, TransactionHandle } from 'newrelic';

export const createMessageMetadata = <T = any>(
  message: T,
  transaction?: TransactionHandle
) => {
  const sha1 = crypto.createHash('sha1'); // can we change this to SHA256?
  const signature = sha1
    .update(JSON.stringify(message))
    .digest('hex')
    .substring(0, 8); // why are we truncating this?
  const timestamp = moment().unix();
  const start = process.hrtime();
  const hostname = os.hostname();

  let traceMetadata: DistributedTraceHeaders | undefined;
  if (transaction) {
    traceMetadata = {};
    transaction.insertDistributedTraceHeaders(traceMetadata);
  }

  return { hostname, timestamp, traceMetadata, signature, start };
};
