import {
  createHash,
} from "node:crypto";
import {
  createRequire,
} from "node:module";
import {
  performance,
} from "node:perf_hooks";

import type {
  Poc3DriverBakeOffManifest,
  Poc3DriverCandidate,
  Poc3GeneratedDriverFixture,
  Poc3SqlRow,
  Poc3SqlStatement,
} from "../../application/storage/poc-3-driver-bake-off-contract";

type DriverConnection = {
  exec(sql: string): void;
  run(statement: Poc3SqlStatement): void;
  query(
    statement: Pick<
      Poc3SqlStatement,
      "sql" | "parameters"
    >,
  ): readonly Poc3SqlRow[];
  backup(
    destinationPath: string,
  ): Promise<void>;
  close(): void;
};

export type Poc3DriverAdapter = {
  readonly candidateId: string;
  readonly moduleSpecifier: string;
  readonly driverVersion: string;
  open(
    databasePath: string,
  ): Promise<DriverConnection>;
};

type BetterStatement = {
  run(...parameters: readonly unknown[]): unknown;
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
};

type BetterDatabase = {
  exec(sql: string): unknown;
  prepare(sql: string): BetterStatement;
  backup(
    destinationPath: string,
  ): Promise<unknown>;
  close(): void;
};

type BetterConstructor = new (
  databasePath: string,
) => BetterDatabase;

type NodeStatement = {
  run(...parameters: readonly unknown[]): unknown;
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
};

type NodeDatabase = {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
  close(): void;
};

type NodeSqliteModule = {
  readonly DatabaseSync: new (
    databasePath: string,
  ) => NodeDatabase;
  backup(
    database: NodeDatabase,
    destinationPath: string,
  ): Promise<unknown>;
};

export type Poc3DriverContractResult = {
  readonly candidateId: string;
  readonly moduleSpecifier: string;
  readonly driverVersion: string;
  readonly sqliteVersion: string;
  readonly contractChecksum: string;
  readonly ledgerChecksum: string;
  readonly backupLedgerChecksum:
    string;
  readonly correctness: {
    readonly pragma: true;
    readonly transaction: true;
    readonly rollback: true;
    readonly foreignKey: true;
    readonly backup: true;
  };
  readonly timingsMs: Readonly<
    Record<string, number>
  >;
};

function normalizeRows(
  rows:
    readonly Record<string, unknown>[],
): readonly Poc3SqlRow[] {
  return rows.map((row) => {
    const normalized:
      Record<
        string,
        string | number | boolean | null
      > = {};
    for (
      const [column, value]
      of Object.entries(row)
    ) {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (
          typeof value === "number" &&
          Number.isSafeInteger(value)
        )
      ) {
        normalized[column] = value;
      } else if (
        typeof value === "bigint" &&
        value <=
          BigInt(Number.MAX_SAFE_INTEGER) &&
        value >=
          BigInt(Number.MIN_SAFE_INTEGER)
      ) {
        normalized[column] =
          Number(value);
      } else {
        throw new Error(
          `POC-3 SQL row has an unsupported value in ${column}`,
        );
      }
    }
    return normalized;
  });
}

function createNodeSqliteAdapter(
  candidate: Poc3DriverCandidate,
): Poc3DriverAdapter {
  const loaded =
    process.getBuiltinModule(
      candidate.moduleSpecifier,
    ) as NodeSqliteModule | undefined;
  if (loaded === undefined) {
    throw new Error(
      `POC-3 candidate did not load as a built-in module: ${candidate.id}`,
    );
  }
  return Object.freeze({
    candidateId: candidate.id,
    moduleSpecifier:
      candidate.moduleSpecifier,
    driverVersion: process.version,
    open: async (
      databasePath: string,
    ) => {
      const database =
        new loaded.DatabaseSync(
          databasePath,
        );
      return Object.freeze({
        exec: (sql: string) =>
          database.exec(sql),
        run: (
          statement:
            Poc3SqlStatement,
        ) => {
          database
            .prepare(statement.sql)
            .run(
              ...statement.parameters,
            );
        },
        query: (
          statement: Pick<
            Poc3SqlStatement,
            "sql" | "parameters"
          >,
        ) =>
          normalizeRows(
            database
              .prepare(statement.sql)
              .all(
                ...statement.parameters,
              ),
          ),
        backup: async (
          destinationPath: string,
        ) => {
          await loaded.backup(
            database,
            destinationPath,
          );
        },
        close: () => database.close(),
      });
    },
  });
}

function createBetterSqliteAdapter(
  candidate: Poc3DriverCandidate,
): Poc3DriverAdapter {
  const runtimeRequire =
    createRequire(__filename);
  const loaded = runtimeRequire(
    candidate.moduleSpecifier,
  ) as BetterConstructor;
  const packageManifest =
    runtimeRequire(
      `${candidate.moduleSpecifier}/package.json`,
    ) as {
      readonly version?: unknown;
    };
  if (
    typeof packageManifest.version !==
      "string" ||
    packageManifest.version.length === 0
  ) {
    throw new Error(
      `POC-3 candidate package version is unavailable: ${candidate.id}`,
    );
  }
  if (
    candidate.expectedPackageVersion !==
      undefined &&
    packageManifest.version !==
      candidate.expectedPackageVersion
  ) {
    throw new Error(
      `POC-3 candidate package version mismatch: ${candidate.id}`,
    );
  }
  return Object.freeze({
    candidateId: candidate.id,
    moduleSpecifier:
      candidate.moduleSpecifier,
    driverVersion:
      packageManifest.version,
    open: async (
      databasePath: string,
    ) => {
      const database = new loaded(
        databasePath,
      );
      return Object.freeze({
        exec: (sql: string) => {
          database.exec(sql);
        },
        run: (
          statement:
            Poc3SqlStatement,
        ) => {
          database
            .prepare(statement.sql)
            .run(
              ...statement.parameters,
            );
        },
        query: (
          statement: Pick<
            Poc3SqlStatement,
            "sql" | "parameters"
          >,
        ) =>
          normalizeRows(
            database
              .prepare(statement.sql)
              .all(
                ...statement.parameters,
              ),
          ),
        backup: async (
          destinationPath: string,
        ) => {
          await database.backup(
            destinationPath,
          );
        },
        close: () => database.close(),
      });
    },
  });
}

export async function createPoc3DriverAdapters(
  candidates:
    readonly Poc3DriverCandidate[],
): Promise<
  readonly Poc3DriverAdapter[]
> {
  return candidates.map((candidate) => {
    if (
      candidate.moduleSpecifier ===
      "node:sqlite"
    ) {
      return createNodeSqliteAdapter(
        candidate,
      );
    }
    if (
      candidate.moduleSpecifier ===
      "better-sqlite3"
    ) {
      return createBetterSqliteAdapter(
        candidate,
      );
    }
    throw new Error(
      `Unsupported POC-3 driver candidate: ${candidate.id}`,
    );
  });
}

function assertRows(
  actual: readonly Poc3SqlRow[],
  expected: readonly Poc3SqlRow[],
  label: string,
): void {
  if (
    JSON.stringify(actual) !==
    JSON.stringify(expected)
  ) {
    throw new Error(
      `${label} returned unexpected rows`,
    );
  }
}

function digestJson(
  algorithm: string,
  value: unknown,
): string {
  return createHash(algorithm)
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

async function timed(
  operation:
    () => void | Promise<void>,
): Promise<number> {
  const startedAt = performance.now();
  await operation();
  return performance.now() - startedAt;
}

function sharedContract(
  manifest:
    Poc3DriverBakeOffManifest,
): unknown {
  return {
    schemaVersion:
      manifest.schemaVersion,
    checksumAlgorithm:
      manifest.checksumAlgorithm,
    databaseFiles:
      manifest.databaseFiles,
    fixtureGeneration:
      manifest.fixtureGeneration,
    pragmaSteps:
      manifest.pragmaSteps,
    schemaStatements:
      manifest.schemaStatements,
    writeTransaction:
      manifest.writeTransaction,
    rollbackTransaction:
      manifest.rollbackTransaction,
    foreignKeyRejection:
      manifest.foreignKeyRejection,
    ledgerVerificationSql:
      manifest.ledgerVerificationSql,
    sqliteVersionQuery:
      manifest.sqliteVersionQuery,
    integrityVerification:
      manifest.integrityVerification,
    measurement:
      manifest.measurement,
    packageProbe:
      manifest.packageProbe,
  };
}

export async function runPoc3DriverCorrectnessContract(
  input: {
    readonly manifest:
      Poc3DriverBakeOffManifest;
    readonly adapter:
      Poc3DriverAdapter;
    readonly fixture:
      Poc3GeneratedDriverFixture;
    readonly databasePath: string;
    readonly backupPath: string;
  },
): Promise<Poc3DriverContractResult> {
  const {
    manifest,
    adapter,
    fixture,
    databasePath,
    backupPath,
  } = input;
  if (
    databasePath.length === 0 ||
    backupPath.length === 0
  ) {
    throw new Error(
      "POC-3 contract requires exact caller database and backup paths",
    );
  }

  let connection:
    DriverConnection | undefined;
  let backupConnection:
    DriverConnection | undefined;
  const timings:
    Record<string, number> = {};
  try {
    timings.open = await timed(
      async () => {
        connection =
          await adapter.open(
            databasePath,
          );
      },
    );
    const primary = connection;
    if (primary === undefined) {
      throw new Error(
        "POC-3 candidate did not open a database connection",
      );
    }

    for (
      const pragma
      of manifest.pragmaSteps
    ) {
      timings[
        `pragma:${pragma.id}`
      ] = await timed(() => {
        primary.exec(
          pragma.applySql,
        );
        assertRows(
          primary.query({
            sql: pragma.verifySql,
            parameters: [],
          }),
          pragma.expectedRows,
          `POC-3 pragma ${pragma.id}`,
        );
      });
    }

    timings.schema = await timed(
      () => {
        for (
          const sql
          of manifest
            .schemaStatements
        ) {
          primary.exec(sql);
        }
      },
    );

    timings.writeTransaction =
      await timed(() => {
        primary.exec(
          manifest.writeTransaction
            .beginSql,
        );
        for (
          const work
          of fixture.works
        ) {
          primary.run({
            sql: manifest
              .writeTransaction
              .insertWorkSql,
            parameters: [
              work.workId,
              work.displayName,
            ],
          });
        }
        for (
          const document
          of fixture.documents
        ) {
          primary.run({
            sql: manifest
              .writeTransaction
              .insertDocumentSql,
            parameters: [
              document.workId,
              document.documentId,
              document.displayName,
            ],
          });
        }
        for (
          const revision
          of fixture.revisions
        ) {
          primary.run({
            sql: manifest
              .writeTransaction
              .insertRevisionSql,
            parameters: [
              revision.workId,
              revision.documentId,
              revision.revisionId,
              revision.sequence,
              revision
                .contentChecksum,
            ],
          });
        }
        primary.exec(
          manifest.writeTransaction
            .commitSql,
        );
      });

    timings.read = await timed(() => {
      assertRows(
        primary.query(
          {
            sql: manifest
              .ledgerVerificationSql,
            parameters: [],
          },
        ),
        fixture.ledgerExpectedRows,
        "POC-3 committed ledger",
      );
    });
    const ledgerRows =
      primary.query(
        {
          sql: manifest
            .ledgerVerificationSql,
          parameters: [],
        },
      );
    const ledgerChecksum =
      digestJson(
        manifest.checksumAlgorithm,
        ledgerRows,
      );

    timings.rollback = await timed(
      () => {
        primary.exec(
          manifest.rollbackTransaction
            .beginSql,
        );
        primary.run({
          sql: manifest
            .rollbackTransaction
            .insertWorkSql,
          parameters: [
            fixture.rollbackWork
              .workId,
            fixture.rollbackWork
              .displayName,
          ],
        });
        primary.exec(
          manifest.rollbackTransaction
            .rollbackSql,
        );
        assertRows(
          primary.query(
            {
              sql: manifest
                .rollbackTransaction
                .verificationSql,
              parameters: [
                fixture.rollbackWork
                  .workId,
              ],
            },
          ),
          [],
          "POC-3 rollback verification",
        );
      },
    );

    timings.foreignKeyRejection =
      await timed(() => {
        primary.exec(
          manifest.foreignKeyRejection
            .beginSql,
        );
        let rejected = false;
        try {
          primary.run(
            {
              sql: manifest
                .foreignKeyRejection
                .insertDocumentSql,
              parameters: [
                fixture
                  .foreignKeyDocument
                  .missingWorkId,
                fixture
                  .foreignKeyDocument
                  .documentId,
                fixture
                  .foreignKeyDocument
                  .displayName,
              ],
            },
          );
        } catch {
          rejected = true;
        } finally {
          primary.exec(
            manifest
              .foreignKeyRejection
              .rollbackSql,
          );
        }
        if (!rejected) {
          throw new Error(
            "POC-3 foreign-key violation was not rejected",
          );
        }
        assertRows(
          primary.query(
            {
              sql: manifest
                .foreignKeyRejection
                .verificationSql,
              parameters: [
                fixture
                  .foreignKeyDocument
                  .documentId,
              ],
            },
          ),
          [],
          "POC-3 foreign-key rejection verification",
        );
      });

    const versionRows =
      primary.query({
        sql: manifest.sqliteVersionQuery
          .sql,
        parameters: [],
      });
    const sqliteVersion =
      versionRows[0]?.[
        manifest.sqliteVersionQuery
          .column
      ];
    if (
      typeof sqliteVersion !==
        "string" ||
      sqliteVersion.length === 0
    ) {
      throw new Error(
        "POC-3 candidate did not report a SQLite version",
      );
    }

    timings.backup = await timed(
      () =>
        primary.backup(backupPath),
    );
    timings.backupIntegrity =
      await timed(async () => {
        backupConnection =
          await adapter.open(
            backupPath,
          );
        const backup =
          backupConnection;
        if (backup === undefined) {
          throw new Error(
            "POC-3 candidate did not open its backup",
          );
        }
        assertRows(
          backup.query(
            manifest
              .integrityVerification,
          ),
          manifest.integrityVerification
            .expectedRows,
          "POC-3 backup integrity",
        );
        assertRows(
          backup.query(
            {
              sql: manifest
                .ledgerVerificationSql,
              parameters: [],
            },
          ),
          fixture.ledgerExpectedRows,
          "POC-3 backup ledger",
        );
      });
    const backupRows =
      backupConnection!.query(
        {
          sql: manifest
            .ledgerVerificationSql,
          parameters: [],
        },
      );

    return Object.freeze({
      candidateId:
        adapter.candidateId,
      moduleSpecifier:
        adapter.moduleSpecifier,
      driverVersion:
        adapter.driverVersion,
      sqliteVersion,
      contractChecksum:
        digestJson(
          manifest.checksumAlgorithm,
          sharedContract(manifest),
        ),
      ledgerChecksum,
      backupLedgerChecksum:
        digestJson(
          manifest.checksumAlgorithm,
          backupRows,
        ),
      correctness: Object.freeze({
        pragma: true,
        transaction: true,
        rollback: true,
        foreignKey: true,
        backup: true,
      }),
      timingsMs:
        Object.freeze({
          ...timings,
        }),
    });
  } finally {
    backupConnection?.close();
    connection?.close();
  }
}
