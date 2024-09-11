import { Storage, Logger, WorkflowStateRepository } from 'steveo';
import { PrismaClient } from '@prisma/client';
import { WorkflowStateRepositoryPostgres } from '../repo/workflow-postgres-repo';
import { PostgresStorageConfig } from './postgres-config';

/**
 *
 */
class PostgresStorage extends Storage {
  workflow: WorkflowStateRepository;

  prisma: PrismaClient;

  constructor(private config: PostgresStorageConfig, private logger: Logger) {
    super('steveo-postgres');

    this.prisma = new PrismaClient({
      datasourceUrl: this.config.datasourceUrl,
    });

    this.workflow = new WorkflowStateRepositoryPostgres(this.prisma);
  }

  /**
   * Executes the given function under the umbrella of a Postgres transaction.
   * @param fn
   */
  async transaction(fn: () => Promise<void>): Promise<void> {
    this.logger.trace({ msg: `Postgres storage transaction begin` });

    //
    await this.prisma.$transaction(async () => {
      await fn();

      this.logger.trace({ msg: `Postgres storage transaction complete` });
    });
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
