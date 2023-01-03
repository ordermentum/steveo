import moment from 'moment';
import * as crypto from 'crypto';
import os from 'os';
import newrelic from 'newrelic';

export const generateMessageMetadata = <T = any>(message: T, transaction?: newrelic.TransactionHandle) => {
  const sha1 = crypto.createHash('sha1');
  const signature = sha1
    .update(JSON.stringify(message))
    .digest('hex')
    .substring(0, 8); // why are we truncating this?
  const timestamp = moment().unix();
  const start = process.hrtime();
  const hostname = os.hostname();

  let traceMetadata: newrelic.DistributedTraceHeaders | undefined;
  if (transaction) {
    traceMetadata = {};
    transaction.insertDistributedTraceHeaders(traceMetadata);
  }

  return { hostname, timestamp, traceMetadata, signature, start };
};
