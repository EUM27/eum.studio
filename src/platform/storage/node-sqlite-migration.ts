import {
  DatabaseSync,
} from "node:sqlite";

import type {
  StorageMigrationReport,
  StorageMigrationStepReceipt,
} from "../../application/storage/storage-migration";
import type {
  Poc3RequestedSqliteSettings,
  Poc3SqliteReadbackValue,
} from "./node-sqlite-ledger-profile";

type SqlInput =
  | string
  | number
  | bigint
  | null
  | Uint8Array;

type ErrorWithCode = {
  readonly code?: unknown;
  readonly errcode?: unknown;
};

const NODE_SQLITE_ERROR_CODE =
  "ERR_SQLITE_ERROR";
const SQLITE_BUSY_RESULT_CODE =
  5;
const SQLITE_LOCKED_RESULT_CODE =
  6;

export type NodeSqliteMigrationChecksumAdapter = {
  readonly identity: string;
  canonicalTextBytes(
    value: string,
  ): Uint8Array;
  checksum(
    bytes: Uint8Array,
  ): string;
};

export type NodeSqliteMigrationCatalogStep = {
  readonly migrationId: string;
  readonly fromSchemaVersion:
    number;
  readonly toSchemaVersion: number;
  /**
   * Caller-owned canonical immutable bytes for the complete step definition,
   * including its statements, verification material, and logical snapshot.
   */
  readonly definitionBytes:
    Uint8Array;
  readonly expectedDefinitionChecksumValue:
    string;
  readonly statements:
    readonly string[];
  readonly verification: {
    readonly query: string;
    readonly expectedRows:
      readonly Readonly<
        Record<
          string,
          Poc3SqliteReadbackValue
        >
      >[];
  };
  readonly logicalSnapshot: {
    readonly scopeIdentity:
      string;
    readonly query: string;
    readonly verifyAfterChecksumOnNoOp:
      boolean;
  };
};

export type RunNodeSqliteStorageMigrationInput = {
  readonly databasePath: string;
  readonly requestedSettings:
    Poc3RequestedSqliteSettings;
  readonly targetSchemaVersion:
    number;
  readonly catalog:
    readonly NodeSqliteMigrationCatalogStep[];
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
  readonly beforeCommit?:
    () => Promise<void>;
  readonly foreignKeyMode?:
    | "enforced"
    | "temporarily-disabled";
};

type NormalizedRows =
  readonly Readonly<
    Record<
      string,
      Poc3SqliteReadbackValue
    >
  >[];

type PreparedMigrationStep = {
  readonly migrationId: string;
  readonly fromSchemaVersion:
    number;
  readonly toSchemaVersion: number;
  readonly definitionBytes:
    Uint8Array;
  readonly expectedDefinitionChecksumValue:
    string;
  readonly actualDefinitionChecksumValue:
    string;
  readonly statements:
    readonly string[];
  readonly verification: {
    readonly query: string;
    readonly expectedRows:
      NormalizedRows;
  };
  readonly logicalSnapshot: {
    readonly scopeIdentity:
      string;
    readonly query: string;
    readonly verifyAfterChecksumOnNoOp:
      boolean;
  };
};

export class NodeSqliteStorageMigrationCatalogError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "NodeSqliteStorageMigrationCatalogError";
  }
}

export class NodeSqliteStorageMigrationConflictError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "NodeSqliteStorageMigrationConflictError";
  }
}

export class NodeSqliteStorageMigrationVerificationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "NodeSqliteStorageMigrationVerificationError";
  }
}

function isNodeSqliteLockConflict(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }
  const sqliteError =
    error as ErrorWithCode;
  return (
    sqliteError.code ===
      NODE_SQLITE_ERROR_CODE &&
    (
      sqliteError.errcode ===
        SQLITE_BUSY_RESULT_CODE ||
      sqliteError.errcode ===
        SQLITE_LOCKED_RESULT_CODE
    )
  );
}

function compareStrings(
  left: string,
  right: string,
): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function normalizeValue(
  value: unknown,
  column: string,
): Poc3SqliteReadbackValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (
      typeof value === "number" &&
      Number.isSafeInteger(value)
    )
  ) {
    return value;
  }
  if (
    typeof value === "bigint" &&
    value <=
      BigInt(
        Number.MAX_SAFE_INTEGER,
      ) &&
    value >=
      BigInt(
        Number.MIN_SAFE_INTEGER,
      )
  ) {
    return Number(value);
  }
  throw new NodeSqliteStorageMigrationVerificationError(
    `SQLite migration returned an unsupported value in ${column}`,
  );
}

function normalizeRows(
  rows:
    readonly Readonly<
      Record<string, unknown>
    >[],
): NormalizedRows {
  return Object.freeze(
    rows.map((row) => {
      const normalized:
        Record<
          string,
          Poc3SqliteReadbackValue
        > = {};
      for (
        const column
        of Object.keys(row)
          .sort(compareStrings)
      ) {
        normalized[column] =
          normalizeValue(
            row[column],
            column,
          );
      }
      return Object.freeze(
        normalized,
      );
    }),
  );
}

function queryRows(
  database: DatabaseSync,
  sql: string,
  parameters:
    readonly SqlInput[] = [],
): NormalizedRows {
  return normalizeRows(
    database
      .prepare(sql)
      .all(...parameters),
  );
}

function assertSameRows(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (
    JSON.stringify(actual) !==
    JSON.stringify(expected)
  ) {
    throw new NodeSqliteStorageMigrationVerificationError(
      `${label} did not match caller expected rows`,
    );
  }
}

function applyAndVerifySettings(
  database: DatabaseSync,
  requested:
    Poc3RequestedSqliteSettings,
  foreignKeyMode:
    | "enforced"
    | "temporarily-disabled",
): void {
  const settings = [
    [
      "journalMode",
      requested.journalMode,
    ],
    [
      "synchronous",
      requested.synchronous,
    ],
    [
      "foreignKeys",
      requested.foreignKeys,
    ],
  ] as const;
  for (
    const [identity, request]
    of settings
  ) {
    database.exec(
      request.applySql,
    );
    assertSameRows(
      queryRows(
        database,
        request.verifySql,
      ),
      normalizeRows(
        request.expectedRows,
      ),
      `SQLite ${identity}`,
    );
  }
  assertSameRows(
    queryRows(
      database,
      "PRAGMA foreign_keys",
    ),
    normalizeRows([
      {
        foreign_keys:
          foreignKeyMode ===
            "temporarily-disabled"
            ? 0
            : 1,
      },
    ]),
    "SQLite foreign key enforcement",
  );
}

function assertSafeVersion(
  value: number,
  label: string,
): void {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new NodeSqliteStorageMigrationCatalogError(
      `${label} must be a positive safe integer`,
    );
  }
}

function prepareCatalog(
  catalog:
    readonly NodeSqliteMigrationCatalogStep[],
  targetSchemaVersion: number,
  checksum:
    NodeSqliteMigrationChecksumAdapter,
): readonly PreparedMigrationStep[] {
  assertSafeVersion(
    targetSchemaVersion,
    "Migration target schema version",
  );
  const migrationIds =
    new Set<string>();
  const sourceVersions =
    new Set<number>();
  const versionPairs =
    new Set<string>();
  const prepared =
    catalog.map((step) => {
      assertSafeVersion(
        step.fromSchemaVersion,
        "Migration source schema version",
      );
      assertSafeVersion(
        step.toSchemaVersion,
        "Migration destination schema version",
      );
      if (
        step.toSchemaVersion <=
        step.fromSchemaVersion
      ) {
        throw new NodeSqliteStorageMigrationCatalogError(
          "Migration step does not advance its schema version",
        );
      }
      if (
        migrationIds.has(
          step.migrationId,
        )
      ) {
        throw new NodeSqliteStorageMigrationCatalogError(
          "Migration catalog contains a duplicate migration identity",
        );
      }
      migrationIds.add(
        step.migrationId,
      );
      if (
        sourceVersions.has(
          step.fromSchemaVersion,
        )
      ) {
        throw new NodeSqliteStorageMigrationCatalogError(
          "Migration catalog contains a duplicate source version",
        );
      }
      sourceVersions.add(
        step.fromSchemaVersion,
      );
      const versionPair =
        JSON.stringify([
          step.fromSchemaVersion,
          step.toSchemaVersion,
        ]);
      if (
        versionPairs.has(
          versionPair,
        )
      ) {
        throw new NodeSqliteStorageMigrationCatalogError(
          "Migration catalog contains a duplicate version transition",
        );
      }
      versionPairs.add(
        versionPair,
      );
      const definitionBytes =
        Uint8Array.from(
          step.definitionBytes,
        );
      const actualDefinitionChecksumValue =
        checksum.checksum(
          definitionBytes,
        );
      if (
        actualDefinitionChecksumValue !==
        step
          .expectedDefinitionChecksumValue
      ) {
        throw new NodeSqliteStorageMigrationCatalogError(
          "Migration definition checksum does not match caller provenance",
        );
      }
      return Object.freeze({
        migrationId:
          step.migrationId,
        fromSchemaVersion:
          step.fromSchemaVersion,
        toSchemaVersion:
          step.toSchemaVersion,
        definitionBytes,
        expectedDefinitionChecksumValue:
          step
            .expectedDefinitionChecksumValue,
        actualDefinitionChecksumValue,
        statements:
          Object.freeze([
            ...step.statements,
          ]),
        verification:
          Object.freeze({
            query:
              step.verification
                .query,
            expectedRows:
              normalizeRows(
                step.verification
                  .expectedRows,
              ),
          }),
        logicalSnapshot:
          Object.freeze({
            scopeIdentity:
              step
                .logicalSnapshot
                .scopeIdentity,
            query:
              step
                .logicalSnapshot
                .query,
            verifyAfterChecksumOnNoOp:
              step
                .logicalSnapshot
                .verifyAfterChecksumOnNoOp,
          }),
      });
    });
  prepared.sort((left, right) =>
    (
      left.fromSchemaVersion -
      right.fromSchemaVersion
    ) ||
    (
      left.toSchemaVersion -
      right.toSchemaVersion
    ) ||
    compareStrings(
      left.migrationId,
      right.migrationId,
    ),
  );
  for (
    let index = 1;
    index < prepared.length;
    index += 1
  ) {
    const previous =
      prepared[index - 1];
    const current =
      prepared[index];
    if (
      previous === undefined ||
      current === undefined ||
      previous.toSchemaVersion !==
        current.fromSchemaVersion
    ) {
      throw new NodeSqliteStorageMigrationCatalogError(
        "Migration catalog is noncontiguous",
      );
    }
  }
  const finalStep =
    prepared[
      prepared.length - 1
    ];
  if (
    finalStep !== undefined &&
    finalStep.toSchemaVersion !==
      targetSchemaVersion
  ) {
    throw new NodeSqliteStorageMigrationCatalogError(
      "Migration catalog does not terminate at the requested target",
    );
  }
  return Object.freeze(
    prepared,
  );
}

function readSafeInteger(
  row:
    Readonly<
      Record<
        string,
        Poc3SqliteReadbackValue
      >
    >,
  field: string,
): number {
  const value = row[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new NodeSqliteStorageMigrationVerificationError(
      `SQLite migration returned an invalid ${field}`,
    );
  }
  return value;
}

function readString(
  row:
    Readonly<
      Record<
        string,
        Poc3SqliteReadbackValue
      >
    >,
  field: string,
): string {
  const value = row[field];
  if (
    typeof value !== "string"
  ) {
    throw new NodeSqliteStorageMigrationVerificationError(
      `SQLite migration returned an invalid ${field}`,
    );
  }
  return value;
}

function readCurrentIdentity(
  database: DatabaseSync,
): {
  readonly checksumIdentity:
    string;
  readonly currentSchemaVersion:
    number;
} {
  const identityRows =
    queryRows(
      database,
      `
        SELECT
          checksum_identity AS "checksumIdentity",
          target_schema_version AS "targetSchemaVersion"
        FROM storage_ledger_identity
        ORDER BY checksum_identity
      `,
    );
  const identity =
    identityRows[0];
  if (
    identityRows.length !== 1 ||
    identity === undefined
  ) {
    throw new NodeSqliteStorageMigrationConflictError(
      "Storage ledger identity is not exactly one row",
    );
  }
  const targetSchemaVersion =
    readSafeInteger(
      identity,
      "targetSchemaVersion",
    );
  const versionRows =
    queryRows(
      database,
      "PRAGMA user_version",
    );
  const version =
    versionRows[0];
  if (
    versionRows.length !== 1 ||
    version === undefined
  ) {
    throw new NodeSqliteStorageMigrationConflictError(
      "Storage schema version readback is invalid",
    );
  }
  const userSchemaVersion =
    readSafeInteger(
      version,
      "user_version",
    );
  if (
    userSchemaVersion !==
    targetSchemaVersion
  ) {
    throw new NodeSqliteStorageMigrationConflictError(
      "Storage identity target and user schema version differ",
    );
  }
  return Object.freeze({
    checksumIdentity:
      readString(
        identity,
        "checksumIdentity",
      ),
    currentSchemaVersion:
      userSchemaVersion,
  });
}

function catalogCoverage(
  catalog:
    readonly PreparedMigrationStep[],
  currentSchemaVersion: number,
  targetSchemaVersion: number,
): {
  readonly historical:
    readonly PreparedMigrationStep[];
  readonly pending:
    readonly PreparedMigrationStep[];
} {
  if (
    currentSchemaVersion >
    targetSchemaVersion
  ) {
    throw new NodeSqliteStorageMigrationConflictError(
      "Storage schema is newer than the requested migration target",
    );
  }
  const historical =
    catalog.filter(
      (step) =>
        step.toSchemaVersion <=
        currentSchemaVersion,
    );
  const pending =
    catalog.filter(
      (step) =>
        step.fromSchemaVersion >=
        currentSchemaVersion,
    );
  let cursor =
    currentSchemaVersion;
  for (const step of pending) {
    if (
      step.fromSchemaVersion !==
      cursor
    ) {
      throw new NodeSqliteStorageMigrationCatalogError(
        "Migration catalog is missing a required source version",
      );
    }
    cursor =
      step.toSchemaVersion;
  }
  if (
    cursor !== targetSchemaVersion
  ) {
    throw new NodeSqliteStorageMigrationCatalogError(
      "Migration catalog does not reach the requested target from the current version",
    );
  }
  return Object.freeze({
    historical:
      Object.freeze(
        historical,
      ),
    pending:
      Object.freeze(pending),
  });
}

function checksumRows(
  rows: NormalizedRows,
  checksum:
    NodeSqliteMigrationChecksumAdapter,
): string {
  return checksum.checksum(
    checksum.canonicalTextBytes(
      JSON.stringify(rows),
    ),
  );
}

function progressReceiptJson(
  input: {
    readonly step:
      PreparedMigrationStep;
    readonly checksum:
      NodeSqliteMigrationChecksumAdapter;
    readonly beforeRowCount:
      number;
    readonly afterRowCount:
      number;
  },
): string {
  return JSON.stringify({
    logicalSnapshotScopeIdentity:
      input.step
        .logicalSnapshot
        .scopeIdentity,
    logicalSnapshotQueryChecksumIdentity:
      input.checksum.identity,
    logicalSnapshotQueryChecksumValue:
      input.checksum.checksum(
        input.checksum.canonicalTextBytes(
          input.step
            .logicalSnapshot.query,
        ),
      ),
    definitionByteLength:
      input.step
        .definitionBytes
        .byteLength,
    beforeRowCount:
      input.beforeRowCount,
    afterRowCount:
      input.afterRowCount,
  });
}

function insertReceipt(
  database: DatabaseSync,
  receipt:
    StorageMigrationStepReceipt,
  progressReceipt: string,
): void {
  database
    .prepare(`
      INSERT INTO migration_receipts (
        id,
        migration_id,
        from_schema_version,
        to_schema_version,
        migration_checksum_identity,
        migration_checksum_value,
        before_checksum_value,
        after_checksum_value,
        started_at,
        completed_at,
        progress_receipt_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      receipt.receiptId,
      receipt.migrationId,
      receipt.fromSchemaVersion,
      receipt.toSchemaVersion,
      receipt
        .definitionChecksumIdentity,
      receipt
        .definitionChecksumValue,
      receipt
        .beforeLogicalSnapshotChecksumValue,
      receipt
        .afterLogicalSnapshotChecksumValue,
      receipt.startedAt,
      receipt.completedAt,
      progressReceipt,
    );
}

function readReceipt(
  database: DatabaseSync,
  step:
    PreparedMigrationStep,
  checksum:
    NodeSqliteMigrationChecksumAdapter,
): StorageMigrationStepReceipt {
  const rows =
    queryRows(
      database,
      `
        SELECT
          id AS "receiptId",
          migration_id AS "migrationId",
          from_schema_version AS "fromSchemaVersion",
          to_schema_version AS "toSchemaVersion",
          migration_checksum_identity AS "definitionChecksumIdentity",
          migration_checksum_value AS "definitionChecksumValue",
          before_checksum_value AS "beforeLogicalSnapshotChecksumValue",
          after_checksum_value AS "afterLogicalSnapshotChecksumValue",
          started_at AS "startedAt",
          completed_at AS "completedAt",
          progress_receipt_json AS "progressReceiptJson"
        FROM migration_receipts
        WHERE migration_id = ?
      `,
      [
        step.migrationId,
      ],
    );
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined
  ) {
    throw new NodeSqliteStorageMigrationConflictError(
      "Verified no-op requires exactly one existing migration receipt",
    );
  }
  const progressReceiptJson =
    readString(
      row,
      "progressReceiptJson",
    );
  let progress:
    Record<string, unknown>;
  try {
    const parsed =
      JSON.parse(
        progressReceiptJson,
      ) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }
    progress =
      parsed as Record<
        string,
        unknown
      >;
  } catch {
    throw new NodeSqliteStorageMigrationConflictError(
      "Existing migration receipt progress provenance is invalid",
    );
  }
  const queryChecksum =
    checksum.checksum(
      checksum.canonicalTextBytes(
        step.logicalSnapshot
          .query,
      ),
    );
  if (
    row.migrationId !==
      step.migrationId ||
    readSafeInteger(
      row,
      "fromSchemaVersion",
    ) !==
      step.fromSchemaVersion ||
    readSafeInteger(
      row,
      "toSchemaVersion",
    ) !==
      step.toSchemaVersion ||
    row.definitionChecksumIdentity !==
      checksum.identity ||
    row.definitionChecksumValue !==
      step
        .actualDefinitionChecksumValue ||
    progress
      .logicalSnapshotScopeIdentity !==
      step.logicalSnapshot
        .scopeIdentity ||
    progress
      .logicalSnapshotQueryChecksumIdentity !==
      checksum.identity ||
    progress
      .logicalSnapshotQueryChecksumValue !==
      queryChecksum ||
    progress
      .definitionByteLength !==
      step.definitionBytes
        .byteLength
  ) {
    throw new NodeSqliteStorageMigrationConflictError(
      "Existing migration receipt does not match caller catalog provenance",
    );
  }
  const afterLogicalSnapshotChecksumValue =
    readString(
      row,
      "afterLogicalSnapshotChecksumValue",
    );
  if (
    step.logicalSnapshot
      .verifyAfterChecksumOnNoOp &&
    checksumRows(
      queryRows(
        database,
        step.logicalSnapshot
          .query,
      ),
      checksum,
    ) !==
      afterLogicalSnapshotChecksumValue
  ) {
    throw new NodeSqliteStorageMigrationConflictError(
      "Existing migration receipt after checksum does not match the caller-declared no-op invariant",
    );
  }
  return Object.freeze({
    receiptId:
      readString(
        row,
        "receiptId",
      ),
    migrationId:
      step.migrationId,
    fromSchemaVersion:
      step.fromSchemaVersion,
    toSchemaVersion:
      step.toSchemaVersion,
    definitionChecksumIdentity:
      checksum.identity,
    definitionChecksumValue:
      step
        .actualDefinitionChecksumValue,
    logicalSnapshotScopeIdentity:
      step.logicalSnapshot
        .scopeIdentity,
    beforeLogicalSnapshotChecksumValue:
      readString(
        row,
        "beforeLogicalSnapshotChecksumValue",
      ),
    afterLogicalSnapshotChecksumValue:
      afterLogicalSnapshotChecksumValue,
    startedAt:
      readString(
        row,
        "startedAt",
      ),
    completedAt:
      readString(
        row,
        "completedAt",
      ),
  });
}

function assertNoForeignKeyViolations(
  database: DatabaseSync,
): void {
  if (
    queryRows(
      database,
      "PRAGMA foreign_key_check",
    ).length > 0
  ) {
    throw new NodeSqliteStorageMigrationVerificationError(
      "Storage migration foreign key check found violations",
    );
  }
}

function applyStep(
  database: DatabaseSync,
  step:
    PreparedMigrationStep,
  input:
    RunNodeSqliteStorageMigrationInput,
): StorageMigrationStepReceipt {
  const startedAt =
    input.clock.now();
  const beforeRows =
    queryRows(
      database,
      step.logicalSnapshot.query,
    );
  const beforeLogicalSnapshotChecksumValue =
    checksumRows(
      beforeRows,
      input.checksum,
    );
  for (
    const statement
    of step.statements
  ) {
    database.exec(statement);
  }
  assertSameRows(
    queryRows(
      database,
      step.verification.query,
    ),
    step.verification
      .expectedRows,
    `Migration ${step.migrationId}`,
  );
  const afterRows =
    queryRows(
      database,
      step.logicalSnapshot.query,
    );
  const afterLogicalSnapshotChecksumValue =
    checksumRows(
      afterRows,
      input.checksum,
    );
  const completedAt =
    input.clock.now();
  const receipt =
    Object.freeze({
      receiptId:
        input.receiptIdFactory
          .create(
            step.migrationId,
          ),
      migrationId:
        step.migrationId,
      fromSchemaVersion:
        step.fromSchemaVersion,
      toSchemaVersion:
        step.toSchemaVersion,
      definitionChecksumIdentity:
        input.checksum.identity,
      definitionChecksumValue:
        step
          .actualDefinitionChecksumValue,
      logicalSnapshotScopeIdentity:
        step.logicalSnapshot
          .scopeIdentity,
      beforeLogicalSnapshotChecksumValue,
      afterLogicalSnapshotChecksumValue,
      startedAt,
      completedAt,
    });
  insertReceipt(
    database,
    receipt,
    progressReceiptJson({
      step,
      checksum:
        input.checksum,
      beforeRowCount:
        beforeRows.length,
      afterRowCount:
        afterRows.length,
    }),
  );
  return receipt;
}

export async function runNodeSqliteStorageMigration(
  input:
    RunNodeSqliteStorageMigrationInput,
): Promise<
  StorageMigrationReport
> {
  const catalog =
    prepareCatalog(
      input.catalog,
      input.targetSchemaVersion,
      input.checksum,
    );
  const database =
    new DatabaseSync(
      input.databasePath,
    );
  let transactionActive =
    false;
  try {
    applyAndVerifySettings(
      database,
      input.requestedSettings,
      input.foreignKeyMode ??
        "enforced",
    );
    database.exec(
      "BEGIN IMMEDIATE",
    );
    transactionActive = true;
    const identity =
      readCurrentIdentity(
        database,
      );
    if (
      identity.checksumIdentity !==
      input.checksum.identity
    ) {
      throw new NodeSqliteStorageMigrationConflictError(
        "Migration checksum identity does not match the storage ledger identity",
      );
    }
    const initialSchemaVersion =
      identity.currentSchemaVersion;
    const coverage =
      catalogCoverage(
        catalog,
        initialSchemaVersion,
        input.targetSchemaVersion,
      );
    assertNoForeignKeyViolations(
      database,
    );
    const historicalReceipts =
      coverage.historical.map(
        (step) =>
          readReceipt(
            database,
            step,
            input.checksum,
          ),
      );
    const appliedReceipts =
      coverage.pending.map(
        (step) =>
          applyStep(
            database,
            step,
            input,
          ),
      );
    assertNoForeignKeyViolations(
      database,
    );
    if (
      coverage.pending.length >
      0
    ) {
      const update =
        database
          .prepare(`
            UPDATE storage_ledger_identity
            SET target_schema_version = ?
            WHERE
              checksum_identity = ?
              AND target_schema_version = ?
          `)
          .run(
            input
              .targetSchemaVersion,
            input.checksum
              .identity,
            initialSchemaVersion,
          );
      const changes =
        typeof update.changes ===
        "bigint"
          ? Number(
            update.changes,
          )
          : update.changes;
      if (changes !== 1) {
        throw new NodeSqliteStorageMigrationConflictError(
          "Storage identity changed during migration",
        );
      }
      database.exec(
        `PRAGMA user_version = ${input.targetSchemaVersion}`,
      );
      if (
        readCurrentIdentity(
          database,
        ).currentSchemaVersion !==
        input.targetSchemaVersion
      ) {
        throw new NodeSqliteStorageMigrationVerificationError(
          "Storage schema version did not reach the requested target",
        );
      }
    }
    if (
      input.beforeCommit !==
      undefined
    ) {
      await input.beforeCommit();
    }
    database.exec("COMMIT");
    transactionActive = false;
    if (
      input.foreignKeyMode ===
      "temporarily-disabled"
    ) {
      database.exec(
        "PRAGMA foreign_keys = ON",
      );
      assertSameRows(
        queryRows(
          database,
          "PRAGMA foreign_keys",
        ),
        normalizeRows([
          { foreign_keys: 1 },
        ]),
        "SQLite restored foreign key enforcement",
      );
      assertNoForeignKeyViolations(
        database,
      );
    }
    return Object.freeze({
      requestedTargetSchemaVersion:
        input.targetSchemaVersion,
      initialSchemaVersion,
      finalSchemaVersion:
        input.targetSchemaVersion,
      noOp:
        coverage.pending.length ===
        0,
      steps:
        Object.freeze([
          ...historicalReceipts,
          ...appliedReceipts,
        ]),
    });
  } catch (error) {
    if (transactionActive) {
      database.exec("ROLLBACK");
    }
    if (
      isNodeSqliteLockConflict(
        error,
      )
    ) {
      throw new NodeSqliteStorageMigrationConflictError(
        "Storage migration lock conflict",
      );
    }
    throw error;
  } finally {
    database.close();
  }
}
