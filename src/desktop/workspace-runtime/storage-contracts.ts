

export type NodeSqliteStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
  run(
    ...parameters: readonly unknown[]
  ): {
    readonly changes: number | bigint;
  };
};

export type NodeSqliteDatabase = {
  prepare(sql: string): NodeSqliteStatement;
  exec(sql: string): void;
  close(): void;
};

export type NodeSqliteModule = {
  readonly DatabaseSync: new (
    databasePath: string,
  ) => NodeSqliteDatabase;
};

