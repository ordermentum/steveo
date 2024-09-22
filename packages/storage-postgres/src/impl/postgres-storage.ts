import { Storage, Logger, Repositories } from 'steveo';
import { PrismaClient } from 'prisma/prisma-client';
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
      datasourceUrl: this.config.datasourceUrl,
    });
  }

  /**
   * Executes the given function under the umbrella of a Postgres transaction.
   * @param fn
   */
  async transaction(fn: (repos: Repositories) => Promise<void>): Promise<void> {
    this.logger.trace({ msg: `Postgres storage transaction begin` });

    //
    const opts = {
      timeout: 20000,
    };

    await this.prisma.$transaction(async client => {
      const repos: Repositories = {
        workflow: new WorkflowStateRepositoryPostgres(client),
      };

      await fn(repos);

      this.logger.trace({ msg: `Postgres storage transaction complete` });
    }, opts);
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
