

export class Transaction {

  commit(): Promise<void> { return Promise.resolve(); }
  rollback(): Promise<void> { return Promise.resolve(); }
}

// TODO: Add abstracted database for other
export class Database {
  transaction(): Promise<Transaction> {
    return Promise.resolve(new Transaction());
  }
}



