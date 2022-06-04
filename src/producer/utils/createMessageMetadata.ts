import moment from 'moment';
import * as crypto from 'crypto';
import os from 'os';

export const createMessageMetadata = <T = any>(
  message: T,
  traceMetadata?: string
) => {
  const sha1 = crypto.createHash('sha1'); // can we change this to SHA256?
  const signature = sha1
    .update(JSON.stringify(message))
    .digest('hex')
    .substring(0, 8);
  const timestamp = moment().unix();
  const start = process.hrtime();
  const hostname = os.hostname();

  return { hostname, timestamp, traceMetadata, signature, start };
};
