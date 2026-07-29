import {
  inspectStorageIntegrity,
} from "../../application/storage/storage-integrity";
import type {
  InspectStorageIntegrityInput,
  StorageIntegrityBlobManifest,
  StorageIntegrityDatabaseSnapshot,
  StorageIntegrityDatabaseSnapshotPort,
  StorageIntegrityIdentity,
  StorageIntegrityReport,
  StorageIntegrityRevisionReference,
} from "../../application/storage/storage-integrity";

type NodeSqliteStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<
    string,
    unknown
  >[];
};

type NodeSqliteDatabase = {
  exec(sql: string): void;
  prepare(
    sql: string,
  ): NodeSqliteStatement;
  close(): void;
};

type NodeSqliteModule = {
  readonly DatabaseSync: new (
    databasePath: string,
    options: {
      readonly readOnly: boolean;
    },
  ) => NodeSqliteDatabase;
};

export type InspectNodeSqliteStorageIntegrityInput =
  Omit<
    InspectStorageIntegrityInput,
    "databaseSnapshot"
  > & {
    readonly databasePath: string;
  };

function loadNodeSqlite():
  NodeSqliteModule {
  const loaded =
    process.getBuiltinModule(
      "node:sqlite",
    ) as
      | NodeSqliteModule
      | undefined;
  if (loaded === undefined) {
    throw new Error(
      "node:sqlite is unavailable",
    );
  }
  return loaded;
}

function queryRows(
  database:
    NodeSqliteDatabase,
  sql: string,
): readonly Record<
  string,
  unknown
>[] {
  return database
    .prepare(sql)
    .all();
}

function readString(
  row:
    Record<string, unknown>,
  field: string,
): string {
  const value = row[field];
  if (
    typeof value !== "string"
  ) {
    throw new Error(
      `SQLite integrity snapshot returned an invalid ${field}`,
    );
  }
  return value;
}

function readNullableString(
  row:
    Record<string, unknown>,
  field: string,
): string | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (
    typeof value !== "string"
  ) {
    throw new Error(
      `SQLite integrity snapshot returned an invalid ${field}`,
    );
  }
  return value;
}

function readSafeInteger(
  row:
    Record<string, unknown>,
  field: string,
): number {
  const value = row[field];
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
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
  throw new Error(
    `SQLite integrity snapshot returned an invalid ${field}`,
  );
}

function countIntegrityFailures(
  rows:
    readonly Record<
      string,
      unknown
    >[],
): number {
  return rows.filter((row) => {
    const values =
      Object.values(row);
    return (
      values.length !== 1 ||
      values[0] !== "ok"
    );
  }).length;
}

function readIdentities(
  rows:
    readonly Record<
      string,
      unknown
    >[],
): readonly StorageIntegrityIdentity[] {
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        checksumIdentity:
          readString(
            row,
            "checksumIdentity",
          ),
        targetSchemaVersion:
          readSafeInteger(
            row,
            "targetSchemaVersion",
          ),
      }),
    ),
  );
}

function readManifests(
  rows:
    readonly Record<
      string,
      unknown
    >[],
): readonly StorageIntegrityBlobManifest[] {
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        blobRef:
          readString(
            row,
            "blobRef",
          ),
        checksumIdentity:
          readString(
            row,
            "checksumIdentity",
          ),
        checksumValue:
          readString(
            row,
            "checksumValue",
          ),
        byteLength:
          readSafeInteger(
            row,
            "byteLength",
          ),
      }),
    ),
  );
}

function readRevisionReferences(
  rows:
    readonly Record<
      string,
      unknown
    >[],
): readonly StorageIntegrityRevisionReference[] {
  const references:
    StorageIntegrityRevisionReference[] =
    [];
  for (const row of rows) {
    const revisionId =
      readString(
        row,
        "revisionId",
      );
    references.push(
      Object.freeze({
        revisionId,
        blobRef:
          readString(
            row,
            "contentRef",
          ),
      }),
    );
    const changeSetRef =
      readNullableString(
        row,
        "changeSetRef",
      );
    if (
      changeSetRef !== null
    ) {
      references.push(
        Object.freeze({
          revisionId,
          blobRef:
            changeSetRef,
        }),
      );
    }
  }
  return Object.freeze(
    references,
  );
}

function createNodeSqliteSnapshot(
  databasePath: string,
): StorageIntegrityDatabaseSnapshotPort {
  return Object.freeze({
    captureConsistentSnapshot:
      async (): Promise<
        StorageIntegrityDatabaseSnapshot
      > => {
        const { DatabaseSync } =
          loadNodeSqlite();
        const database =
          new DatabaseSync(
            databasePath,
            {
              readOnly: true,
            },
          );
        let transactionActive =
          false;
        try {
          database.exec("BEGIN");
          transactionActive = true;
          const integrityRows =
            queryRows(
              database,
              "PRAGMA integrity_check",
            );
          const foreignKeyRows =
            queryRows(
              database,
              "PRAGMA foreign_key_check",
            );
          const identities =
            readIdentities(
              queryRows(
                database,
                `
                  SELECT
                    checksum_identity AS "checksumIdentity",
                    target_schema_version AS "targetSchemaVersion"
                  FROM storage_ledger_identity
                  ORDER BY
                    checksum_identity,
                    target_schema_version
                `,
              ),
            );
          const versionRows =
            queryRows(
              database,
              "PRAGMA user_version",
            );
          const versionRow =
            versionRows[0];
          if (
            versionRows.length !==
              1 ||
            versionRow ===
              undefined
          ) {
            throw new Error(
              "SQLite integrity snapshot returned an invalid schema version",
            );
          }
          const manifests =
            readManifests(
              queryRows(
                database,
                `
                  SELECT
                    blob_ref AS "blobRef",
                    checksum_identity AS "checksumIdentity",
                    checksum_value AS "checksumValue",
                    byte_length AS "byteLength"
                  FROM blob_manifests
                  ORDER BY blob_ref
                `,
              ),
            );
          const revisionRows =
            queryRows(
              database,
              `
                SELECT
                  id AS "revisionId",
                  content_ref AS "contentRef",
                  change_set_ref AS "changeSetRef"
                FROM document_revisions
                ORDER BY id
              `,
            );
          const snapshot =
            Object.freeze({
              integrityFailureCount:
                countIntegrityFailures(
                  integrityRows,
                ),
              foreignKeyViolationCount:
                foreignKeyRows.length,
              storageIdentities:
                identities,
              userSchemaVersion:
                readSafeInteger(
                  versionRow,
                  "user_version",
                ),
              blobManifests:
                manifests,
              revisionCount:
                revisionRows.length,
              revisionReferences:
                readRevisionReferences(
                  revisionRows,
                ),
            });
          database.exec("COMMIT");
          transactionActive =
            false;
          return snapshot;
        } catch (error) {
          if (transactionActive) {
            database.exec(
              "ROLLBACK",
            );
          }
          throw error;
        } finally {
          database.close();
        }
      },
  });
}

export async function inspectNodeSqliteStorageIntegrity(
  input:
    InspectNodeSqliteStorageIntegrityInput,
): Promise<
  StorageIntegrityReport
> {
  const {
    databasePath,
    ...applicationInput
  } = input;
  return inspectStorageIntegrity({
    ...applicationInput,
    databaseSnapshot:
      createNodeSqliteSnapshot(
        databasePath,
      ),
  });
}
