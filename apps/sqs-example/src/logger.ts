import bunyan from 'bunyan';

export const logger = bunyan.createLogger({ name: 'test-sequelize' });

export default logger;
