import { Storage, Logger, Repositories } from 'steveo';
import { PrismaClient } from '@prisma/client';
import { WorkflowStateRepositoryPostgres } from '../repo/workflow-postgres-repo';
import { PostgresStorageConfig } from './postgres-config';

/**
 *
 */
class PostgresStorage extends Storage {
  prisma: PrismaClient;

  constructor(private config: PostgresStorageConfig, private logger: Logger) {
    super('steveo-postgres');

    this.prisma = new PrismaClient({
      datasourceUrl: this.config.databaseUrl,
    });
  }

  /**
   * Executes the given function under the umbrella of a Postgres transaction.
   * @param fn
   */
  async transaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    this.logger.trace(`Postgres storage transaction begin`);

    return this.prisma.$transaction(
      async client => {
        const repos: Repositories = {
          workflow: new WorkflowStateRepositoryPostgres(client),
        };

        const result = await fn(repos);

        this.logger.trace(`Postgres storage transaction complete`);

        return result;
      },
      {
        timeout: this.config.transactionTimeout,
      }
    );
  }
}

/**
 * Creates a Postgres storage instance with the given config and logger
 */
export function postgresFactory(
  config: PostgresStorageConfig,
  logger: Logger
): Storage {
  return new PostgresStorage(config, logger);
}
