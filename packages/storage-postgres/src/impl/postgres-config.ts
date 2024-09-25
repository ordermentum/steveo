/**
 *
 */
export interface PostgresStorageConfig {
  /**
   * Database connection string
   * Used the postgres:// schema and include authentication details
   */
  databaseUrl: string;

  /**
   * Timeout for database transactions
   */
  transactionTimeout: number;
}
