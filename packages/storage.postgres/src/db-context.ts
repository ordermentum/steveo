

export class Transaction {

  commit(): Promise<void> { return Promise.resolve(); }
  rollback(): Promise<void> { return Promise.resolve(); }
}

export class Database {
  transaction(): Promise<Transaction> {
    return Promise.resolve(new Transaction());
  }
}



