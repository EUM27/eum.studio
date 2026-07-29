import {
  createHash,
  getHashes,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  join,
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
  migrateStorage,
} from "../../src/application/storage/storage-migration";
import type {
  StorageMigrationRunnerPort,
} from "../../src/application/storage/storage-migration";
import {
  NodeSqliteStorageMigrationCatalogError,
  NodeSqliteStorageMigrationConflictError,
  runNodeSqliteStorageMigration,
} from "../../src/platform/storage/node-sqlite-migration";
import type {
  NodeSqliteMigrationCatalogStep,
  NodeSqliteMigrationChecksumAdapter,
  RunNodeSqliteStorageMigrationInput,
} from "../../src/platform/storage/node-sqlite-migration";
import {
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";
import type {
  Poc3RequestedSqliteSettings,
} from "../../src/platform/storage/node-sqlite-ledger-profile";

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

type LedgerFixture = {
  readonly requestedSettings:
    Poc3RequestedSqliteSettings;
  readonly targetSchemaVersion:
    number;
};

type RuntimeMigrationContext = {
  readonly temporaryRoot: string;
  readonly databasePath: string;
  readonly checksumIdentity:
    string;
  readonly checksumAlgorithm:
    string;
  readonly sourceSchemaVersion:
    number;
  readonly targetSchemaVersion:
    number;
  readonly requestedSettings:
    Poc3RequestedSqliteSettings;
  readonly catalog:
    readonly NodeSqliteMigrationCatalogStep[];
  readonly createdSchemaIdentities:
    readonly {
      readonly tableIdentity:
        string;
      readonly columnIdentity:
        string;
    }[];
  readonly checksum:
    NodeSqliteMigrationChecksumAdapter;
  readonly clock: {
    now(): string;
  };
  readonly receiptIdFactory: {
    create(
      migrationId: string,
    ): string;
  };
  readonly receiptIds:
    ReadonlyMap<string, string>;
  input(
    overrides?: Partial<
      Pick<
        RunNodeSqliteStorageMigrationInput,
        | "catalog"
        | "targetSchemaVersion"
        | "beforeCommit"
      >
    >,
  ): RunNodeSqliteStorageMigrationInput;
  close(): Promise<void>;
};

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
      createHash(candidate)
        .update(randomBytes(1))
        .digest("hex");
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(
    "Current runtime exposes no usable migration checksum",
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

function defineCatalogStep(
  input: {
    readonly checksum:
      NodeSqliteMigrationChecksumAdapter;
    readonly migrationId: string;
    readonly fromSchemaVersion:
      number;
    readonly toSchemaVersion:
      number;
    readonly statements:
      readonly string[];
    readonly verification:
      NodeSqliteMigrationCatalogStep["verification"];
    readonly logicalSnapshot:
      NodeSqliteMigrationCatalogStep["logicalSnapshot"];
  },
): NodeSqliteMigrationCatalogStep {
  const definitionBytes =
    input.checksum
      .canonicalTextBytes(
        JSON.stringify([
          input.migrationId,
          input.fromSchemaVersion,
          input.toSchemaVersion,
          input.statements,
          input.verification,
          input.logicalSnapshot,
        ]),
      );
  return Object.freeze({
    migrationId:
      input.migrationId,
    fromSchemaVersion:
      input.fromSchemaVersion,
    toSchemaVersion:
      input.toSchemaVersion,
    definitionBytes,
    expectedDefinitionChecksumValue:
      input.checksum.checksum(
        definitionBytes,
      ),
    statements:
      Object.freeze([
        ...input.statements,
      ]),
    verification:
      input.verification,
    logicalSnapshot:
      input.logicalSnapshot,
  });
}

function redefineCatalogStep(
  step:
    NodeSqliteMigrationCatalogStep,
  checksum:
    NodeSqliteMigrationChecksumAdapter,
  overrides: Partial<
    Pick<
      NodeSqliteMigrationCatalogStep,
      | "migrationId"
      | "fromSchemaVersion"
      | "toSchemaVersion"
      | "statements"
      | "verification"
      | "logicalSnapshot"
    >
  >,
): NodeSqliteMigrationCatalogStep {
  return defineCatalogStep({
    checksum,
    migrationId:
      overrides.migrationId ??
      step.migrationId,
    fromSchemaVersion:
      overrides
        .fromSchemaVersion ??
      step.fromSchemaVersion,
    toSchemaVersion:
      overrides.toSchemaVersion ??
      step.toSchemaVersion,
    statements:
      overrides.statements ??
      step.statements,
    verification:
      overrides.verification ??
      step.verification,
    logicalSnapshot:
      overrides.logicalSnapshot ??
      step.logicalSnapshot,
  });
}

function createRuntimeCatalog(
  input: {
    readonly fixture:
      MigrationFixture;
    readonly sourceSchemaVersion:
      number;
    readonly checksum:
      NodeSqliteMigrationChecksumAdapter;
  },
): {
  readonly catalog:
    readonly NodeSqliteMigrationCatalogStep[];
  readonly targetSchemaVersion:
    number;
  readonly createdSchemaIdentities:
    readonly {
      readonly tableIdentity:
        string;
      readonly columnIdentity:
        string;
    }[];
} {
  let currentVersion =
    input.sourceSchemaVersion;
  const createdSchemaIdentities:
    {
      readonly tableIdentity:
        string;
      readonly columnIdentity:
        string;
    }[] = [];
  const catalog =
    Array.from(
      {
        length:
          input.fixture.counts
            .migrationStepCount,
      },
      () => {
        const migrationId =
          randomUUID();
        const tableIdentity =
          randomUUID();
        const columnIdentity =
          randomUUID();
        const resultIdentity =
          randomUUID();
        const scopeIdentity =
          randomUUID();
        const fromSchemaVersion =
          currentVersion;
        const toSchemaVersion =
          fromSchemaVersion +
          input.fixture.counts
            .schemaVersionIncrement;
        currentVersion =
          toSchemaVersion;
        const table =
          quoteSqlIdentifier(
            tableIdentity,
          );
        const column =
          quoteSqlIdentifier(
            columnIdentity,
          );
        const result =
          quoteSqlIdentifier(
            resultIdentity,
          );
        const statements = [
          `
            CREATE TABLE ${table} (
              ${column} INTEGER NOT NULL
            ) STRICT
          `,
        ];
        if (
          statements.length !==
          input.fixture.counts
            .statementCountPerStep
        ) {
          throw new Error(
            "Caller fixture statement count does not match the runtime catalog",
          );
        }
        const query = `
          SELECT COUNT(*) AS ${result}
          FROM sqlite_schema
          WHERE
            type = ${quoteSqlLiteral(
              "table",
            )}
            AND name = ${quoteSqlLiteral(
              tableIdentity,
            )}
        `;
        const verification =
          Object.freeze({
            query,
            expectedRows:
              Object.freeze([
                Object.freeze({
                  [resultIdentity]:
                    input.fixture
                      .counts
                      .schemaVersionIncrement,
                }),
              ]),
          });
        const logicalSnapshot =
          Object.freeze({
            scopeIdentity,
            query,
            verifyAfterChecksumOnNoOp:
              true,
          });
        createdSchemaIdentities
          .push({
            tableIdentity,
            columnIdentity,
          });
        return defineCatalogStep({
          checksum:
            input.checksum,
          migrationId,
          fromSchemaVersion,
          toSchemaVersion,
          statements,
          verification,
          logicalSnapshot,
        });
      },
    );
  return Object.freeze({
    catalog:
      Object.freeze(catalog),
    targetSchemaVersion:
      currentVersion,
    createdSchemaIdentities:
      Object.freeze(
        createdSchemaIdentities,
      ),
  });
}

async function createRuntimeMigrationContext():
  Promise<RuntimeMigrationContext> {
  const migrationFixture =
    await readJsonFixture<
      MigrationFixture
    >(
      "../fixtures/storage/poc-3-storage-migration.manifest.json",
    );
  const ledgerFixture =
    await readJsonFixture<
      LedgerFixture
    >(
      "../fixtures/storage/poc-3-ledger.manifest.json",
    );
  const temporaryRoot =
    await mkdtemp(
      join(
        tmpdir(),
        randomUUID(),
      ),
    );
  const databasePath = join(
    temporaryRoot,
    randomUUID(),
  );
  const checksumIdentity =
    randomUUID();
  const checksumAlgorithm =
    selectRuntimeHash();
  const checksum =
    checksumAdapter(
      checksumIdentity,
      checksumAlgorithm,
    );
  const sourceProfile =
    parsePoc3StorageOpenProfile({
      databasePath,
      checksumIdentity,
      requestedSettings:
        ledgerFixture
          .requestedSettings,
      targetSchemaVersion:
        ledgerFixture
          .targetSchemaVersion,
    });
  const sourceLedger =
    await openNodeSqliteLedger(
      sourceProfile,
    );
  sourceLedger.close();
  const runtimeCatalog =
    createRuntimeCatalog({
      fixture:
        migrationFixture,
      sourceSchemaVersion:
        ledgerFixture
          .targetSchemaVersion,
      checksum,
    });
  let clockOffset = 0;
  const clockStartedAt =
    Date.now();
  const clock = Object.freeze({
    now: () =>
      new Date(
        clockStartedAt +
        clockOffset++,
      ).toISOString(),
  });
  const receiptIds =
    new Map<string, string>();
  const receiptIdFactory =
    Object.freeze({
      create: (
        migrationId: string,
      ): string => {
        const existing =
          receiptIds.get(
            migrationId,
          );
        if (
          existing !== undefined
        ) {
          return existing;
        }
        const created =
          randomUUID();
        receiptIds.set(
          migrationId,
          created,
        );
        return created;
      },
    });
  const baseInput =
    Object.freeze({
      databasePath,
      requestedSettings:
        ledgerFixture
          .requestedSettings,
      targetSchemaVersion:
        runtimeCatalog
          .targetSchemaVersion,
      catalog:
        runtimeCatalog.catalog,
      checksum,
      clock,
      receiptIdFactory,
    });
  return {
    temporaryRoot,
    databasePath,
    checksumIdentity,
    checksumAlgorithm,
    sourceSchemaVersion:
      ledgerFixture
        .targetSchemaVersion,
    targetSchemaVersion:
      runtimeCatalog
        .targetSchemaVersion,
    requestedSettings:
      ledgerFixture
        .requestedSettings,
    catalog:
      runtimeCatalog.catalog,
    createdSchemaIdentities:
      runtimeCatalog
        .createdSchemaIdentities,
    checksum,
    clock,
    receiptIdFactory,
    receiptIds,
    input: (overrides) => ({
      ...baseInput,
      ...overrides,
    }),
    close: async () => {
      await rm(
        temporaryRoot,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

function auditRows(
  databasePath: string,
  sql: string,
): readonly Record<
  string,
  unknown
>[] {
  const database =
    new DatabaseSync(
      databasePath,
      {
        readOnly: true,
      },
    );
  try {
    return database
      .prepare(sql)
      .all();
  } finally {
    database.close();
  }
}

async function storageAudit(
  context:
    RuntimeMigrationContext,
): Promise<{
  readonly databaseByteChecksum:
    string;
  readonly logicalChecksum: string;
}> {
  const databaseBytes =
    await readFile(
      context.databasePath,
    );
  const logicalMaterial =
    JSON.stringify({
      schema:
        auditRows(
          context.databasePath,
          `
            SELECT
              type,
              name,
              tbl_name AS "tableIdentity",
              sql
            FROM sqlite_schema
            ORDER BY type, name
          `,
        ),
      identity:
        auditRows(
          context.databasePath,
          `
            SELECT *
            FROM storage_ledger_identity
            ORDER BY checksum_identity
          `,
        ),
      receipts:
        auditRows(
          context.databasePath,
          `
            SELECT *
            FROM migration_receipts
            ORDER BY id
          `,
        ),
      userVersion:
        auditRows(
          context.databasePath,
          "PRAGMA user_version",
        ),
    });
  return Object.freeze({
    databaseByteChecksum:
      context.checksum
        .checksum(
          databaseBytes,
        ),
    logicalChecksum:
      context.checksum
        .checksum(
          context.checksum
            .canonicalTextBytes(
              logicalMaterial,
            ),
        ),
  });
}

async function expectMigrationRollback(
  context:
    RuntimeMigrationContext,
  input:
    RunNodeSqliteStorageMigrationInput,
): Promise<void> {
  const before =
    await storageAudit(context);

  await expect(
    runNodeSqliteStorageMigration(
      input,
    ),
  ).rejects.toThrow();

  expect(
    await storageAudit(context),
  ).toEqual(before);
  const sourceLedger =
    await openNodeSqliteLedger(
      parsePoc3StorageOpenProfile({
        databasePath:
          context.databasePath,
        checksumIdentity:
          context
            .checksumIdentity,
        requestedSettings:
          context
            .requestedSettings,
        targetSchemaVersion:
          context
            .sourceSchemaVersion,
      }),
    );
  sourceLedger.close();
}

describe(
  "POC-3 storage migration",
  () => {
    it(
      "exposes the target-only application migration command",
      () => {
        expect(
          migrateStorage,
        ).toEqual(
          expect.any(Function),
        );
      },
    );

    it(
      "exposes the caller-configured Node SQLite migration runner",
      () => {
        expect(
          runNodeSqliteStorageMigration,
        ).toEqual(
          expect.any(Function),
        );
      },
    );

    it(
      "commits every contiguous step, receipt, identity target, and user version atomically",
      async () => {
        const context =
          await createRuntimeMigrationContext();
        const runner:
          StorageMigrationRunnerPort =
          Object.freeze({
            migrateTo: (
              targetSchemaVersion:
                number,
            ) =>
              runNodeSqliteStorageMigration(
                context.input({
                  targetSchemaVersion,
                }),
              ),
          });
        try {
          const report =
            await migrateStorage({
              targetSchemaVersion:
                context
                  .targetSchemaVersion,
              runner,
            }).then(
              (completed) =>
                completed,
              () => null,
            );

          expect(
            report,
          ).not.toBeNull();
          if (report === null) {
            return;
          }

          expect(report).toMatchObject({
            requestedTargetSchemaVersion:
              context
                .targetSchemaVersion,
            initialSchemaVersion:
              context
                .sourceSchemaVersion,
            finalSchemaVersion:
              context
                .targetSchemaVersion,
            noOp: false,
          });
          expect(
            report.steps,
          ).toHaveLength(
            context.catalog.length,
          );
          for (
            const [
              index,
              step,
            ]
            of context.catalog
              .entries()
          ) {
            const receipt =
              report.steps[index];
            if (
              receipt ===
              undefined
            ) {
              throw new Error(
                "Successful migration requires every step receipt",
              );
            }
            expect(receipt).toMatchObject({
              receiptId:
                context.receiptIds
                  .get(
                    step
                      .migrationId,
                  ),
              migrationId:
                step.migrationId,
              fromSchemaVersion:
                step
                  .fromSchemaVersion,
              toSchemaVersion:
                step
                  .toSchemaVersion,
              definitionChecksumIdentity:
                context
                  .checksumIdentity,
              definitionChecksumValue:
                step
                  .expectedDefinitionChecksumValue,
              logicalSnapshotScopeIdentity:
                step
                  .logicalSnapshot
                  .scopeIdentity,
            });
            const expectedRow =
              step.verification
                .expectedRows[0];
            const resultIdentity =
              expectedRow ===
              undefined
                ? undefined
                : Object.keys(
                    expectedRow,
                  )[0];
            const afterValue =
              resultIdentity ===
                undefined ||
              expectedRow ===
                undefined
                ? undefined
                : expectedRow[
                    resultIdentity
                  ];
            if (
              resultIdentity ===
                undefined ||
              typeof afterValue !==
                "number"
            ) {
              throw new Error(
                "Runtime catalog requires checksum assertion material",
              );
            }
            const beforeRows = [
              {
                [resultIdentity]:
                  afterValue -
                  migrationFixtureCount(
                    context,
                  ),
              },
            ];
            expect(receipt).toMatchObject({
              beforeLogicalSnapshotChecksumValue:
                context.checksum
                  .checksum(
                    context
                      .checksum
                      .canonicalTextBytes(
                        JSON.stringify(
                          beforeRows,
                        ),
                      ),
                  ),
              afterLogicalSnapshotChecksumValue:
                context.checksum
                  .checksum(
                    context
                      .checksum
                      .canonicalTextBytes(
                        JSON.stringify(
                          step
                            .verification
                            .expectedRows,
                        ),
                      ),
                  ),
            });
          }
          expect(
            auditRows(
              context.databasePath,
              `
                SELECT
                  checksum_identity AS "checksumIdentity",
                  target_schema_version AS "targetSchemaVersion"
                FROM storage_ledger_identity
              `,
            ),
          ).toEqual([
            {
              checksumIdentity:
                context
                  .checksumIdentity,
              targetSchemaVersion:
                context
                  .targetSchemaVersion,
            },
          ]);
          expect(
            auditRows(
              context.databasePath,
              "PRAGMA user_version",
            ),
          ).toEqual([
            {
              user_version:
                context
                  .targetSchemaVersion,
            },
          ]);
          expect(
            auditRows(
              context.databasePath,
              "PRAGMA foreign_key_check",
            ),
          ).toEqual([]);
          expect(
            auditRows(
              context.databasePath,
              `
                SELECT COUNT(*) AS count
                FROM migration_receipts
              `,
            ),
          ).toEqual([
            {
              count:
                context.catalog.length,
            },
          ]);
          const storedReceipts =
            auditRows(
              context.databasePath,
              `
                SELECT
                  migration_id AS "migrationId",
                  progress_receipt_json AS "progressReceiptJson"
                FROM migration_receipts
                ORDER BY migration_id
              `,
            );
          expect(
            storedReceipts,
          ).toHaveLength(
            context.catalog.length,
          );
          for (
            const step
            of context.catalog
          ) {
            const stored =
              storedReceipts.find(
                (candidate) =>
                  candidate
                    .migrationId ===
                  step.migrationId,
              );
            if (
              typeof stored
                ?.progressReceiptJson !==
              "string"
            ) {
              throw new Error(
                "Migration receipt requires progress provenance",
              );
            }
            expect(
              JSON.parse(
                stored
                  .progressReceiptJson,
              ),
            ).toEqual({
              logicalSnapshotScopeIdentity:
                step
                  .logicalSnapshot
                  .scopeIdentity,
              logicalSnapshotQueryChecksumIdentity:
                context
                  .checksumIdentity,
              logicalSnapshotQueryChecksumValue:
                context.checksum
                  .checksum(
                    context
                      .checksum
                      .canonicalTextBytes(
                        step
                          .logicalSnapshot
                          .query,
                      ),
                  ),
              definitionByteLength:
                step.definitionBytes
                  .byteLength,
              beforeRowCount:
                step.verification
                  .expectedRows
                  .length,
              afterRowCount:
                step.verification
                  .expectedRows
                  .length,
            });
          }
          for (
            const identity
            of context
              .createdSchemaIdentities
          ) {
            expect(
              auditRows(
                context.databasePath,
                `
                  SELECT COUNT(*) AS count
                  FROM pragma_table_info(
                    ${quoteSqlLiteral(
                      identity
                        .tableIdentity,
                    )}
                  )
                  WHERE name = ${
                    quoteSqlLiteral(
                      identity
                        .columnIdentity,
                    )
                  }
                `,
              ),
            ).toEqual([
              {
                count:
                  migrationFixtureCount(
                    context,
                  ),
              },
            ]);
          }
          const targetLedger =
            await openNodeSqliteLedger(
              parsePoc3StorageOpenProfile({
                databasePath:
                  context
                    .databasePath,
                checksumIdentity:
                  context
                    .checksumIdentity,
                requestedSettings:
                  context
                    .requestedSettings,
                targetSchemaVersion:
                  context
                    .targetSchemaVersion,
              }),
            );
          targetLedger.close();
          const serialized =
            JSON.stringify({
              report,
              storedReceipts,
            });
          expect(serialized).not
            .toContain(
              context.databasePath,
            );
          for (
            const step
            of context.catalog
          ) {
            expect(serialized).not
              .toContain(
                step.statements[0] ??
                  "",
              );
            expect(serialized).not
              .toContain(
                step.verification
                  .query,
              );
          }
        } finally {
          await context.close();
        }
      },
    );

    it(
      "rolls every step and receipt back when caller SQL fails",
      async () => {
        const context =
          await createRuntimeMigrationContext();
        try {
          const lastIndex =
            context.catalog.length -
            migrationFixtureCount(
              context,
            );
          const step =
            context.catalog[
              lastIndex
            ];
          if (
            step === undefined ||
            step.statements[0] ===
              undefined
          ) {
            throw new Error(
              "Runtime catalog requires a statement for the SQL rollback probe",
            );
          }
          const failingStep =
            redefineCatalogStep(
              step,
              context.checksum,
              {
                statements:
                  Object.freeze([
                    ...step
                      .statements,
                    step
                      .statements[0],
                  ]),
              },
            );
          const catalog = [
            ...context.catalog,
          ];
          catalog[lastIndex] =
            failingStep;

          await expectMigrationRollback(
            context,
            context.input({
              catalog:
                Object.freeze(
                  catalog,
                ),
            }),
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "rolls every step and receipt back when caller verification rows differ",
      async () => {
        const context =
          await createRuntimeMigrationContext();
        try {
          const lastIndex =
            context.catalog.length -
            migrationFixtureCount(
              context,
            );
          const step =
            context.catalog[
              lastIndex
            ];
          const expectedRow =
            step?.verification
              .expectedRows[0];
          if (
            step === undefined ||
            expectedRow ===
              undefined
          ) {
            throw new Error(
              "Runtime catalog requires verification material",
            );
          }
          const resultIdentity =
            Object.keys(
              expectedRow,
            )[0];
          const expectedValue =
            resultIdentity ===
            undefined
              ? undefined
              : expectedRow[
                  resultIdentity
                ];
          if (
            resultIdentity ===
              undefined ||
            typeof expectedValue !==
              "number"
          ) {
            throw new Error(
              "Runtime catalog requires numeric verification material",
            );
          }
          const failingStep =
            redefineCatalogStep(
              step,
              context.checksum,
              {
                verification:
                  Object.freeze({
                    query:
                      step
                        .verification
                        .query,
                    expectedRows:
                      Object.freeze([
                        Object.freeze({
                          [resultIdentity]:
                            expectedValue +
                            migrationFixtureCount(
                              context,
                            ),
                        }),
                      ]),
                  }),
              },
            );
          const catalog = [
            ...context.catalog,
          ];
          catalog[lastIndex] =
            failingStep;

          await expectMigrationRollback(
            context,
            context.input({
              catalog:
                Object.freeze(
                  catalog,
                ),
            }),
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "rolls every step and receipt back when the caller before-commit hook fails",
      async () => {
        const context =
          await createRuntimeMigrationContext();
        try {
          const hookFailure =
            randomUUID();
          await expectMigrationRollback(
            context,
            context.input({
              beforeCommit:
                async () => {
                  throw new Error(
                    hookFailure,
                  );
                },
            }),
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "rejects missing, duplicate, noncontiguous, and tampered catalog material before writes",
      async () => {
        const context =
          await createRuntimeMigrationContext();
        try {
          const first =
            context.catalog[0];
          const last =
            context.catalog[
              context.catalog.length -
              migrationFixtureCount(
                context,
              )
            ];
          if (
            first === undefined ||
            last === undefined ||
            last.definitionBytes[0] ===
              undefined
          ) {
            throw new Error(
              "Runtime catalog requires material for catalog rejection probes",
            );
          }
          const tamperedBytes =
            Uint8Array.from(
              last.definitionBytes,
            );
          const firstDefinitionByte =
            tamperedBytes[0];
          if (
            firstDefinitionByte ===
            undefined
          ) {
            throw new Error(
              "Runtime catalog definition bytes cannot be empty",
            );
          }
          tamperedBytes[0] =
            (
              firstDefinitionByte +
              migrationFixtureCount(
                context,
              )
            ) %
            (firstDefinitionByte +
              context
                .targetSchemaVersion);
          const versionIncrement =
            context
              .targetSchemaVersion -
            last
              .fromSchemaVersion;
          const rejectionCatalogs =
            Object.freeze([
              Object.freeze(
                context.catalog.slice(
                  0,
                  -migrationFixtureCount(
                    context,
                  ),
                ),
              ),
              Object.freeze([
                ...context.catalog,
                first,
              ]),
              Object.freeze([
                ...context.catalog.slice(
                  0,
                  -migrationFixtureCount(
                    context,
                  ),
                ),
                redefineCatalogStep(
                  last,
                  context.checksum,
                  {
                    fromSchemaVersion:
                      context
                        .targetSchemaVersion +
                      versionIncrement,
                    toSchemaVersion:
                      context
                        .targetSchemaVersion +
                      versionIncrement +
                      versionIncrement,
                  },
                ),
              ]),
              Object.freeze([
                ...context.catalog.slice(
                  0,
                  -migrationFixtureCount(
                    context,
                  ),
                ),
                Object.freeze({
                  ...last,
                  definitionBytes:
                    tamperedBytes,
                }),
              ]),
            ]);
          const before =
            await storageAudit(
              context,
            );

          for (
            const catalog
            of rejectionCatalogs
          ) {
            let receiptFactoryCalls =
              0;
            let hookCalls = 0;
            await expect(
              runNodeSqliteStorageMigration({
                ...context.input({
                  catalog,
                  beforeCommit:
                    async () => {
                      hookCalls +=
                        migrationFixtureCount(
                          context,
                        );
                    },
                }),
                receiptIdFactory:
                  Object.freeze({
                    create: () => {
                      receiptFactoryCalls +=
                        migrationFixtureCount(
                          context,
                        );
                      return randomUUID();
                    },
                  }),
              }),
            ).rejects.toBeInstanceOf(
              NodeSqliteStorageMigrationCatalogError,
            );
            expect(
              receiptFactoryCalls,
            ).toBe(0);
            expect(
              hookCalls,
            ).toBe(0);
            expect(
              await storageAudit(
                context,
              ),
            ).toEqual(before);
          }
        } finally {
          await context.close();
        }
      },
    );

    it(
      "returns a verified same-target no-op without duplicating receipts",
      async () => {
        const context =
          await createRuntimeMigrationContext();
        try {
          const firstReport =
            await runNodeSqliteStorageMigration(
              context.input(),
            );
          const receiptsBefore =
            auditRows(
              context.databasePath,
              `
                SELECT *
                FROM migration_receipts
                ORDER BY migration_id
              `,
            );
          let rerunReceiptFactoryCalls =
            0;
          const rerunReport =
            await runNodeSqliteStorageMigration({
              ...context.input(),
              receiptIdFactory:
                Object.freeze({
                  create: () => {
                    rerunReceiptFactoryCalls +=
                      migrationFixtureCount(
                        context,
                      );
                    return randomUUID();
                  },
                }),
            });

          expect(rerunReport).toEqual({
            requestedTargetSchemaVersion:
              context
                .targetSchemaVersion,
            initialSchemaVersion:
              context
                .targetSchemaVersion,
            finalSchemaVersion:
              context
                .targetSchemaVersion,
            noOp: true,
            steps:
              firstReport.steps,
          });
          expect(
            rerunReceiptFactoryCalls,
          ).toBe(0);
          expect(
            auditRows(
              context.databasePath,
              `
                SELECT *
                FROM migration_receipts
                ORDER BY migration_id
              `,
            ),
          ).toEqual(
            receiptsBefore,
          );

          const driftIdentity =
            context
              .createdSchemaIdentities[0];
          if (
            driftIdentity ===
            undefined
          ) {
            throw new Error(
              "Runtime catalog requires a logical snapshot drift probe",
            );
          }
          const database =
            new DatabaseSync(
              context.databasePath,
            );
          try {
            database.exec(
              `DROP TABLE ${
                quoteSqlIdentifier(
                  driftIdentity
                    .tableIdentity,
                )
              }`,
            );
          } finally {
            database.close();
          }

          await expect(
            runNodeSqliteStorageMigration(
              context.input(),
            ),
          ).rejects.toBeInstanceOf(
            NodeSqliteStorageMigrationConflictError,
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "commits exactly one of two same-source migration connections and reports the lock conflict",
      async () => {
        const context =
          await createRuntimeMigrationContext();
        try {
          let releaseFirst:
            (() => void) |
            undefined;
          const holdFirst =
            new Promise<void>(
              (resolve) => {
                releaseFirst =
                  resolve;
              },
            );
          let firstHookCalls = 0;
          const first =
            runNodeSqliteStorageMigration(
              context.input({
                beforeCommit:
                  () => {
                    firstHookCalls +=
                      migrationFixtureCount(
                        context,
                      );
                    return holdFirst;
                  },
              }),
            );
          expect(
            firstHookCalls,
          ).toBe(
            migrationFixtureCount(
              context,
            ),
          );

          const secondResult =
            await runNodeSqliteStorageMigration(
              context.input(),
            ).then(
              (report) =>
                report,
              (error: unknown) =>
                error,
            );
          if (
            releaseFirst ===
            undefined
          ) {
            throw new Error(
              "Caller hook did not expose its release",
            );
          }
          releaseFirst();
          const firstReport =
            await first;

          expect(
            secondResult,
          ).toBeInstanceOf(
            NodeSqliteStorageMigrationConflictError,
          );
          expect(
            firstReport.noOp,
          ).toBe(false);
          expect(
            firstReport.steps,
          ).toHaveLength(
            context.catalog.length,
          );
          expect(
            auditRows(
              context.databasePath,
              `
                SELECT COUNT(*) AS count
                FROM migration_receipts
              `,
            ),
          ).toEqual([
            {
              count:
                context.catalog.length,
            },
          ]);
          expect(
            auditRows(
              context.databasePath,
              "PRAGMA user_version",
            ),
          ).toEqual([
            {
              user_version:
                context
                  .targetSchemaVersion,
            },
          ]);
        } finally {
          await context.close();
        }
      },
    );
  },
);

function migrationFixtureCount(
  context:
    RuntimeMigrationContext,
): number {
  return (
    context.targetSchemaVersion -
    context.sourceSchemaVersion
  ) / context.catalog.length;
}
