import { PrismaClient } from '@prisma/client';

export class Transaction {

  commit(): Promise<void> { return Promise.resolve(); }
  rollback(): Promise<void> { return Promise.resolve(); }
}

export class Database {

  prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasourceUrl: 'postgresql://johndoe:randompassword@localhost:5432/mydb',
    })
  }

  transaction(_fn: () => void): Promise<void> {

    return Promise.resolve();
  }
}



