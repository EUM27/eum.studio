import {
  fork,
  type ChildProcess,
} from "node:child_process";
import {
  createHash,
  getHashes,
  randomUUID,
} from "node:crypto";
import {
  once,
} from "node:events";
import {
  lstat,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  join,
  resolve,
  sep,
} from "node:path";
import {
  DatabaseSync,
} from "node:sqlite";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  checksumPoc3MigrationCrashGateProfile,
  parsePoc3MigrationCrashGateProfile,
  type Poc3MigrationCrashGateProfile,
} from "../../src/desktop/poc-3-migration-crash-gate-profile";
import type {
  NodeSqliteMigrationChecksumAdapter,
} from "../../src/platform/storage/node-sqlite-migration";
import {
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";
import type {
  Poc3RequestedSqliteSettings,
  Poc3SqliteReadbackValue,
} from "../../src/platform/storage/node-sqlite-ledger-profile";

type LedgerFixture = {
  readonly requestedSettings:
    Poc3RequestedSqliteSettings;
  readonly targetSchemaVersion:
    number;
};

type MigrationFixture = {
  readonly counts: {
    readonly migrationStepCount:
      number;
    readonly schemaVersionIncrement:
      number;
    readonly statementCountPerStep:
      number;
  };
};

type RuntimeCatalog = {
  readonly catalog:
    Poc3MigrationCrashGateProfile[
      "migration"
    ][
      "catalog"
    ];
  readonly targetSchemaVersion:
    number;
};

type LogicalDatabaseSnapshot = {
  readonly counts:
    Readonly<Record<string, number>>;
  readonly checksumValue: string;
};

const deadlineInput =
  process.env
    .EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS;
const callerDeadline = Number(
  deadlineInput,
);
if (
  deadlineInput === undefined ||
  deadlineInput.length === 0 ||
  !Number.isSafeInteger(
    callerDeadline,
  ) ||
  callerDeadline <= Date.now()
) {
  throw new Error(
    "EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS must be a caller-provided future epoch millisecond safe integer",
  );
}
const callerTestTimeout =
  callerDeadline - Date.now();

async function readJsonFixture<T>(
  relativePath: string,
): Promise<T> {
  return JSON.parse(
    await readFile(
      new URL(
        relativePath,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as T;
}

function selectRuntimeHash():
string {
  for (const candidate of getHashes()) {
    try {
      const digest =
        createHash(candidate)
          .update(randomUUID())
          .digest("hex");
      if (digest.length > 0) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  throw new Error(
    "Current runtime exposes no usable hash algorithm",
  );
}

function quoteSqlIdentifier(
  value: string,
): string {
  return `"${value.replaceAll(
    "\"",
    "\"\"",
  )}"`;
}

function quoteSqlLiteral(
  value: string,
): string {
  return `'${value.replaceAll(
    "'",
    "''",
  )}'`;
}

function checksumAdapter(
  identity: string,
  algorithm: string,
): NodeSqliteMigrationChecksumAdapter {
  const encoder =
    new TextEncoder();
  return Object.freeze({
    identity,
    canonicalTextBytes: (
      value: string,
    ) =>
      encoder.encode(value),
    checksum: (
      bytes: Uint8Array,
    ) =>
      createHash(algorithm)
        .update(bytes)
        .digest("hex"),
  });
}

function createRuntimeCatalog(input: {
  readonly fixture:
    MigrationFixture;
  readonly sourceSchemaVersion:
    number;
  readonly checksum:
    NodeSqliteMigrationChecksumAdapter;
  readonly tableIdentity: string;
  readonly keyColumnIdentity:
    string;
  readonly valueColumnIdentity:
    string;
  readonly baselineRowCount:
    number;
}): RuntimeCatalog {
  let currentVersion =
    input.sourceSchemaVersion;
  const table =
    quoteSqlIdentifier(
      input.tableIdentity,
    );
  const keyColumn =
    quoteSqlIdentifier(
      input.keyColumnIdentity,
    );
  const valueColumn =
    quoteSqlIdentifier(
      input.valueColumnIdentity,
    );
  const catalog =
    Array.from(
      {
        length:
          input.fixture.counts
            .migrationStepCount,
      },
      (_unused, index) => {
        const migrationId =
          randomUUID();
        const fromSchemaVersion =
          currentVersion;
        const toSchemaVersion =
          fromSchemaVersion +
          input.fixture.counts
            .schemaVersionIncrement;
        currentVersion =
          toSchemaVersion;
        const insertedKey =
          randomUUID();
        const insertedValue =
          randomUUID();
        const countIdentity =
          randomUUID();
        const statements =
          Object.freeze([
            `
              INSERT INTO ${table} (
                ${keyColumn},
                ${valueColumn}
              )
              VALUES (
                ${quoteSqlLiteral(
                  insertedKey,
                )},
                ${quoteSqlLiteral(
                  insertedValue,
                )}
              )
            `,
          ]);
        if (
          statements.length !==
          input.fixture.counts
            .statementCountPerStep
        ) {
          throw new Error(
            "Caller migration fixture statement count does not match the runtime catalog",
          );
        }
        const verification =
          Object.freeze({
            query: `
              SELECT COUNT(*) AS ${
                quoteSqlIdentifier(
                  countIdentity,
                )
              }
              FROM ${table}
            `,
            expectedRows:
              Object.freeze([
                Object.freeze({
                  [countIdentity]:
                    input
                      .baselineRowCount +
                    (index + 1) *
                      statements.length,
                }),
              ]),
          });
        const logicalSnapshot =
          Object.freeze({
            scopeIdentity:
              randomUUID(),
            query: `
              SELECT
                ${keyColumn},
                ${valueColumn}
              FROM ${table}
              ORDER BY ${keyColumn}
            `,
            verifyAfterChecksumOnNoOp:
              true,
          });
        const definitionBytes =
          input.checksum
            .canonicalTextBytes(
              JSON.stringify([
                migrationId,
                fromSchemaVersion,
                toSchemaVersion,
                statements,
                verification,
                logicalSnapshot,
              ]),
            );
        const startedAt =
          new Date(
            Date.now() +
            index *
              input.fixture
                .counts
                .schemaVersionIncrement,
          ).toISOString();
        const completedAt =
          new Date(
            Date.parse(
              startedAt,
            ) +
            input.fixture
              .counts
              .schemaVersionIncrement,
          ).toISOString();
        return Object.freeze({
          migrationId,
          fromSchemaVersion,
          toSchemaVersion,
          definitionBytes:
            Object.freeze(
              Array.from(
                definitionBytes,
              ),
            ),
          expectedDefinitionChecksumValue:
            input.checksum
              .checksum(
                definitionBytes,
              ),
          statements,
          verification,
          logicalSnapshot,
          startedAt,
          completedAt,
          receiptId: randomUUID(),
        });
      },
    );
  return Object.freeze({
    catalog:
      Object.freeze(catalog),
    targetSchemaVersion:
      currentVersion,
  });
}

function normalizedCell(
  value: unknown,
): unknown {
  if (typeof value === "bigint") {
    return [
      typeof value,
      value.toString(),
    ];
  }
  if (value instanceof Uint8Array) {
    return [
      value.constructor.name,
      Buffer.from(value)
        .toString("base64"),
    ];
  }
  return value;
}

function logicalDatabaseSnapshot(
  databasePath: string,
  checksumAlgorithm: string,
): LogicalDatabaseSnapshot {
  const database =
    new DatabaseSync(
      databasePath,
      {
        readOnly: true,
      },
    );
  try {
    const tableRows =
      database.prepare(
        `
          SELECT name
          FROM sqlite_schema
          WHERE
            type = 'table'
            AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `,
      ).all();
    const counts:
      Record<string, number> = {};
    const payload =
      tableRows.map((tableRow) => {
        const tableName =
          tableRow.name;
        if (
          typeof tableName !==
            "string" ||
          tableName.length === 0
        ) {
          throw new Error(
            "SQLite returned an invalid table identity",
          );
        }
        const quotedTable =
          quoteSqlIdentifier(
            tableName,
          );
        const columnRows =
          database.prepare(
            `PRAGMA table_info(${quotedTable})`,
          ).all();
        const columns =
          columnRows.map((row) => {
            if (
              typeof row.name !==
                "string" ||
              row.name.length ===
                0
            ) {
              throw new Error(
                "SQLite returned an invalid column identity",
              );
            }
            return row.name;
          });
        const rows =
          database.prepare(
            `SELECT * FROM ${quotedTable}`,
          ).all()
            .map((row) =>
              columns.map((column) =>
                normalizedCell(
                  row[column],
                ),
              ),
            )
            .map((row) =>
              JSON.stringify(row),
            )
            .sort();
        counts[tableName] =
          rows.length;
        return [
          tableName,
          columns,
          rows,
        ] as const;
      });
    return Object.freeze({
      counts:
        Object.freeze(counts),
      checksumValue:
        createHash(
          checksumAlgorithm,
        )
          .update(
            JSON.stringify(payload),
          )
          .digest("hex"),
    });
  } finally {
    database.close();
  }
}

function auditRows(
  databasePath: string,
  sql: string,
): readonly Record<
  string,
  Poc3SqliteReadbackValue
>[] {
  const database =
    new DatabaseSync(
      databasePath,
      {
        readOnly: true,
      },
    );
  try {
    return database.prepare(sql)
      .all() as readonly Record<
        string,
        Poc3SqliteReadbackValue
      >[];
  } finally {
    database.close();
  }
}

async function waitForWorkerReady(
  child: ChildProcess,
  deadline: number,
): Promise<void> {
  await new Promise<void>(
    (resolveNow, rejectNow) => {
      const remaining =
        deadline - Date.now();
      if (remaining <= 0) {
        rejectNow(
          new Error(
            "Caller deadline elapsed before migration worker ready",
          ),
        );
        return;
      }
      const timer = setTimeout(
        () => {
          cleanup();
          rejectNow(
            new Error(
              "Caller deadline elapsed before migration worker ready",
            ),
          );
        },
        remaining,
      );
      const handleMessage =
        (message: unknown) => {
          if (
            typeof message ===
              "object" &&
            message !== null &&
            Reflect.get(
              message,
              "type",
            ) ===
              "poc-3-migration-crash-worker-ready"
          ) {
            cleanup();
            resolveNow();
          }
        };
      const handleExit = () => {
        cleanup();
        rejectNow(
          new Error(
            "Migration crash worker exited before ready",
          ),
        );
      };
      const cleanup = () => {
        clearTimeout(timer);
        child.off(
          "message",
          handleMessage,
        );
        child.off(
          "exit",
          handleExit,
        );
      };
      child.on(
        "message",
        handleMessage,
      );
      child.on(
        "exit",
        handleExit,
      );
    },
  );
}

async function waitForMarker(
  markerPath: string,
  child: ChildProcess,
  deadline: number,
): Promise<readonly unknown[]> {
  let workerFailure:
    string | null = null;
  const handleMessage =
    (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        Reflect.get(
          message,
          "type",
        ) ===
          "poc-3-migration-crash-worker-failed"
      ) {
        workerFailure = String(
          Reflect.get(
            message,
            "errorName",
          ),
        );
      }
    };
  child.on(
    "message",
    handleMessage,
  );
  try {
    for (;;) {
      if (Date.now() >= deadline) {
        throw new Error(
          "Caller deadline elapsed before migration durable marker",
        );
      }
      if (workerFailure !== null) {
        throw new Error(
          `Migration crash worker failed before marker: ${workerFailure}`,
        );
      }
      if (
        child.exitCode !== null ||
        child.signalCode !== null
      ) {
        throw new Error(
          "Migration crash worker exited before durable marker",
        );
      }
      try {
        return JSON.parse(
          await readFile(
            markerPath,
            "utf8",
          ),
        ) as readonly unknown[];
      } catch (error) {
        if (
          (
            error as
              NodeJS.ErrnoException
          ).code !== "ENOENT"
        ) {
          throw error;
        }
      }
      await new Promise<void>(
        (resolveNow) => {
          setImmediate(resolveNow);
        },
      );
    }
  } finally {
    child.off(
      "message",
      handleMessage,
    );
  }
}

async function waitForExit(
  exitObservation:
    Promise<readonly unknown[]>,
  deadline: number,
): Promise<readonly unknown[]> {
  const remaining =
    deadline - Date.now();
  if (remaining <= 0) {
    throw new Error(
      "Caller deadline elapsed before migration worker exit",
    );
  }
  let timer:
    ReturnType<typeof setTimeout> |
    undefined;
  try {
    return await Promise.race([
      exitObservation,
      new Promise<never>(
        (_resolveNow, rejectNow) => {
          timer = setTimeout(
            () => {
              rejectNow(
                new Error(
                  "Caller deadline elapsed before migration worker exit",
                ),
              );
            },
            remaining,
          );
        },
      ),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

describe(
  "POC-3 migration process failure",
  () => {
    it(
      "keeps the old storage identity, schema version, logical contents, and migration receipts when the migration worker is terminated before commit",
      async () => {
        const ledgerFixture =
          await readJsonFixture<
            LedgerFixture
          >(
            "../fixtures/storage/poc-3-ledger.manifest.json",
          );
        const migrationFixture =
          await readJsonFixture<
            MigrationFixture
          >(
            "../fixtures/storage/poc-3-storage-migration.manifest.json",
          );
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const resolvedTemporaryRoot =
          resolve(
            temporaryRoot,
          );
        const resolvedOsTemporaryRoot =
          resolve(tmpdir());
        if (
          resolvedTemporaryRoot ===
            resolvedOsTemporaryRoot ||
          !resolvedTemporaryRoot
            .startsWith(
              `${resolvedOsTemporaryRoot}${sep}`,
            )
        ) {
          throw new Error(
            "Migration process-failure directory is outside the verified OS temporary path",
          );
        }
        let child:
          ChildProcess | undefined;
        try {
          const checksumAlgorithm =
            selectRuntimeHash();
          const checksumIdentity =
            randomUUID();
          const callerChecksumAlgorithm =
            selectRuntimeHash();
          const callerChecksumIdentity =
            randomUUID();
          const storageOpenProfile =
            parsePoc3StorageOpenProfile(
              {
                databasePath:
                  join(
                    temporaryRoot,
                    randomUUID(),
                  ),
                checksumIdentity,
                requestedSettings:
                  ledgerFixture
                    .requestedSettings,
                targetSchemaVersion:
                  ledgerFixture
                    .targetSchemaVersion,
              },
            );
          const sourceLedger =
            await openNodeSqliteLedger(
              storageOpenProfile,
            );
          sourceLedger.close();

          const tableIdentity =
            randomUUID();
          const keyColumnIdentity =
            randomUUID();
          const valueColumnIdentity =
            randomUUID();
          const baselineKey =
            randomUUID();
          const baselineValue =
            randomUUID();
          const table =
            quoteSqlIdentifier(
              tableIdentity,
            );
          const keyColumn =
            quoteSqlIdentifier(
              keyColumnIdentity,
            );
          const valueColumn =
            quoteSqlIdentifier(
              valueColumnIdentity,
            );
          const seed =
            new DatabaseSync(
              storageOpenProfile
                .databasePath,
            );
          try {
            seed.exec(`
              CREATE TABLE ${table} (
                ${keyColumn}
                  TEXT PRIMARY KEY,
                ${valueColumn}
                  TEXT NOT NULL
              ) STRICT
            `);
            seed.prepare(`
              INSERT INTO ${table} (
                ${keyColumn},
                ${valueColumn}
              )
              VALUES (?, ?)
            `).run(
              baselineKey,
              baselineValue,
            );
          } finally {
            seed.close();
          }

          const checksum =
            checksumAdapter(
              checksumIdentity,
              checksumAlgorithm,
            );
          const baselineIdentity =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  checksum_identity AS "checksumIdentity",
                  target_schema_version AS "targetSchemaVersion"
                FROM storage_ledger_identity
                ORDER BY checksum_identity
              `,
            );
          const baselineUserVersion =
            auditRows(
              storageOpenProfile
                .databasePath,
              "PRAGMA user_version",
            );
          const baselineTableRows =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  ${keyColumn},
                  ${valueColumn}
                FROM ${table}
                ORDER BY ${keyColumn}
              `,
            );
          const runtimeCatalog =
            createRuntimeCatalog({
              fixture:
                migrationFixture,
              sourceSchemaVersion:
                ledgerFixture
                  .targetSchemaVersion,
              checksum,
              tableIdentity,
              keyColumnIdentity,
              valueColumnIdentity,
              baselineRowCount:
                baselineTableRows
                  .length,
            });
          const baselineTableCount =
            randomUUID();
          const baselineTableCountRows =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT COUNT(*) AS ${
                  quoteSqlIdentifier(
                    baselineTableCount,
                  )
                }
                FROM ${table}
              `,
            );
          const baselineReceipts =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  id,
                  migration_id AS "migrationId",
                  from_schema_version AS "fromSchemaVersion",
                  to_schema_version AS "toSchemaVersion",
                  migration_checksum_identity AS "checksumIdentity",
                  migration_checksum_value AS "checksumValue",
                  before_checksum_value AS "beforeChecksumValue",
                  after_checksum_value AS "afterChecksumValue",
                  started_at AS "startedAt",
                  completed_at AS "completedAt"
                FROM migration_receipts
                ORDER BY id
              `,
            );
          const baselineProgress =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  migration_id AS "migrationId",
                  progress_receipt_json AS "progressReceiptJson"
                FROM migration_receipts
                ORDER BY migration_id
              `,
            );
          const baselineLogical =
            logicalDatabaseSnapshot(
              storageOpenProfile
                .databasePath,
              callerChecksumAlgorithm,
            );

          const markerPath =
            join(
              temporaryRoot,
              randomUUID(),
            );
          const markerTemporaryPath =
            join(
              temporaryRoot,
              randomUUID(),
            );
          const profile =
            parsePoc3MigrationCrashGateProfile(
              {
                schemaVersion: 1,
                scenarioId:
                  randomUUID(),
                reachedPath:
                  markerPath,
                reachedTemporaryPath:
                  markerTemporaryPath,
                storageOpenProfile,
                migration: {
                  targetSchemaVersion:
                    runtimeCatalog
                      .targetSchemaVersion,
                  checksum: {
                    identity:
                      checksumIdentity,
                    algorithm:
                      checksumAlgorithm,
                  },
                  catalog:
                    runtimeCatalog
                      .catalog,
                },
              },
            );
          expect(() =>
            parsePoc3MigrationCrashGateProfile({
              ...profile,
              [randomUUID()]:
                randomUUID(),
            }),
          ).toThrow(/Unsupported/);
          const callerChecksumValue =
            checksumPoc3MigrationCrashGateProfile(
              profile,
              callerChecksumAlgorithm,
            );
          const workerPath =
            join(
              process.cwd(),
              "dist-electron",
              "desktop",
              "poc-3-migration-crash-worker.js",
            );
          child = fork(
            workerPath,
            [],
            {
              cwd: process.cwd(),
              env: {
                ...process.env,
                EUM_STUDIO_POC_3_MIGRATION_CRASH_WORKER:
                  "1",
              },
              stdio: [
                "ignore",
                "ignore",
                "ignore",
                "ipc",
              ],
            },
          );
          await waitForWorkerReady(
            child,
            callerDeadline,
          );
          child.send({
            type:
              "poc-3-migration-crash-worker-run",
            callerChecksum: {
              identity:
                callerChecksumIdentity,
              algorithm:
                callerChecksumAlgorithm,
              value:
                callerChecksumValue,
            },
            profile,
          });
          const marker =
            await waitForMarker(
              markerPath,
              child,
              callerDeadline,
            );
          expect(marker).toEqual([
            "poc-3-migration-crash-gate-reached",
            profile.schemaVersion,
            profile.scenarioId,
            profile.migration
              .targetSchemaVersion,
            callerChecksumIdentity,
            callerChecksumValue,
          ]);
          await expect(
            lstat(
              markerTemporaryPath,
            ),
          ).rejects.toMatchObject({
            code: "ENOENT",
          });
          const childPid =
            child.pid;
          if (childPid === undefined) {
            throw new Error(
              "Migration crash worker has no PID",
            );
          }
          expect(() =>
            process.kill(
              childPid,
              0,
            ),
          ).not.toThrow();
          const exitObservation =
            once(
              child,
              "exit",
            ) as Promise<
              readonly unknown[]
            >;
          expect(
            child.kill(
              "SIGKILL",
            ),
          ).toBe(true);
          await waitForExit(
            exitObservation,
            callerDeadline,
          );
          expect(
            child.exitCode !== null ||
            child.signalCode !== null,
          ).toBe(true);
          child = undefined;

          const reopenedLedger =
            await openNodeSqliteLedger(
              storageOpenProfile,
            );
          reopenedLedger.close();
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  checksum_identity AS "checksumIdentity",
                  target_schema_version AS "targetSchemaVersion"
                FROM storage_ledger_identity
                ORDER BY checksum_identity
              `,
            ),
          ).toEqual(
            baselineIdentity,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              "PRAGMA user_version",
            ),
          ).toEqual(
            baselineUserVersion,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  ${keyColumn},
                  ${valueColumn}
                FROM ${table}
                ORDER BY ${keyColumn}
              `,
            ),
          ).toEqual(
            baselineTableRows,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT COUNT(*) AS ${
                  quoteSqlIdentifier(
                    baselineTableCount,
                  )
                }
                FROM ${table}
              `,
            ),
          ).toEqual(
            baselineTableCountRows,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  id,
                  migration_id AS "migrationId",
                  from_schema_version AS "fromSchemaVersion",
                  to_schema_version AS "toSchemaVersion",
                  migration_checksum_identity AS "checksumIdentity",
                  migration_checksum_value AS "checksumValue",
                  before_checksum_value AS "beforeChecksumValue",
                  after_checksum_value AS "afterChecksumValue",
                  started_at AS "startedAt",
                  completed_at AS "completedAt"
                FROM migration_receipts
                ORDER BY id
              `,
            ),
          ).toEqual(
            baselineReceipts,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  migration_id AS "migrationId",
                  progress_receipt_json AS "progressReceiptJson"
                FROM migration_receipts
                ORDER BY migration_id
              `,
            ),
          ).toEqual(
            baselineProgress,
          );
          expect(
            logicalDatabaseSnapshot(
              storageOpenProfile
                .databasePath,
              callerChecksumAlgorithm,
            ),
          ).toEqual(
            baselineLogical,
          );
        } finally {
          if (
            child !== undefined &&
            child.exitCode === null &&
            child.signalCode === null
          ) {
            child.kill(
              "SIGKILL",
            );
            await once(
              child,
              "exit",
            ).catch(
              () => undefined,
            );
          }
          await rm(
            resolvedTemporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
      callerTestTimeout,
    );
  },
);
