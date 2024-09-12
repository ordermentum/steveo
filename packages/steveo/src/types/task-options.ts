export type Attribute = {
  name: string;
  dataType: string;
  value: string;
};

export type TaskOptions = {
  attributes?: Attribute[];
  queueName?: string;
  waitToCommit?: boolean;

  fifo?: boolean;
  deadLetterQueue?: boolean;
  maxReceiveCount?: number;

  // num_partitions and replication_factor are used for kafka
  replication_factor?: number;
  num_partitions?: number;
};
