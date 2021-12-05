import bunyan from 'bunyan';

export const logger = bunyan.createLogger({
  level: bunyan.DEBUG,
  name: 'mp',
});
export default logger;
