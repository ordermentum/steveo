import moment from 'moment';
import * as crypto from 'crypto';
import os from 'os';

export const getMeta = message => {
  const sha1 = crypto.createHash('sha1');
  const signature = sha1
    .update(JSON.stringify(message))
    .digest('hex')
    .substring(0, 8);
  const timestamp = moment().unix();
  const start = process.hrtime();
  const hostname = os.hostname();
  return { hostname, timestamp, signature, start };
};
