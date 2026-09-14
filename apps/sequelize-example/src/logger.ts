import pino from 'pino';

export const logger = pino({ name: 'test-sequelize' });

export default logger;
