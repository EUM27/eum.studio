import {
  createHash,
  getHashes,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  fork,
  type ChildProcess,
} from "node:child_process";
import {
  once,
} from "node:events";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  dirname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Poc3LedgerRecord,
} from "../../src/domain/poc-3-storage-ledger";
import {
  checksumPoc3BackupCrashGateProfile,
  parsePoc3BackupCrashGateProfile,
} from "../../src/desktop/poc-3-backup-crash-gate-profile";
import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";
import type {
  BlobAddress,
} from "../../src/application/storage/blob-store";
import type {
  NodeSqliteBackupCanonicalBytesAdapter,
  NodeSqliteBackupChecksumAdapter,
  NodeSqliteBackupCounts,
  NodeSqliteBackupLogicalChecksums,
  NodeSqliteBackupManifest,
  NodeSqliteBackupRevisionReference,
} from "../../src/platform/storage/node-sqlite-backup";
import {
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";

type LedgerFixture = {
  readonly requestedSettings:
    Record<string, unknown>;
};

type BackupCoreFixture = {
  readonly standaloneSnapshotJournalMode:
    string;
};

type RuntimeClock = {
  instant(): string;
  revision(): number;
};

type AuditStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
};

type AuditDatabase = {
  prepare(sql: string): AuditStatement;
  close(): void;
};

type AuditModule = {
  readonly DatabaseSync: new (
    databasePath: string,
    options?: {
      readonly readOnly?: boolean;
    },
  ) => AuditDatabase;
};

type BackupLogicalInventory = {
  readonly storageIdentities:
    readonly Readonly<{
      readonly checksumIdentity:
        string;
      readonly targetSchemaVersion:
        number;
    }>[];
  readonly userSchemaVersion: number;
  readonly counts:
    NodeSqliteBackupCounts;
  readonly logicalChecksums:
    NodeSqliteBackupLogicalChecksums;
  readonly revisionReferences:
    readonly NodeSqliteBackupRevisionReference[];
};

type StorageAudit = {
  readonly backup:
    BackupLogicalInventory;
  readonly activePointers:
    readonly Readonly<
      Record<string, unknown>
    >[];
  readonly blobManifests:
    readonly Readonly<
      Record<string, unknown>
    >[];
  readonly tableInventoryChecksum:
    string;
};

type SeededGraph = {
  readonly workId: string;
  readonly documentId: string;
  readonly revisionId: string;
  readonly contentBlobRef: string;
  readonly changeSetBlobRef: string;
  readonly contentAddress:
    BlobAddress;
  readonly changeSetAddress:
    BlobAddress;
  readonly contentBytes:
    Uint8Array;
  readonly changeSetBytes:
    Uint8Array;
};

const callerDeadlineInput =
  process.env
    .EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS;
const callerDeadline =
  callerDeadlineInput === undefined
    ? Number.NaN
    : Number(callerDeadlineInput);
if (
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
  const candidates =
    getHashes();
  const start =
    randomInt(
      candidates.length,
    );
  const probe =
    randomBytes(
      randomInt(1, 65),
    );
  for (
    let offset = 0;
    offset < candidates.length;
    offset += 1
  ) {
    const candidate =
      candidates[
        (
          start + offset
        ) % candidates.length
      ];
    if (candidate === undefined) {
      continue;
    }
    try {
      if (
        createHash(candidate)
          .update(probe)
          .digest("hex")
          .length > 0
      ) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  throw new Error(
    "Current runtime exposes no usable checksum algorithm",
  );
}

function createRuntimeClock():
RuntimeClock {
  const origin = Date.now();
  let offset = 0;
  return Object.freeze({
    instant: () =>
      new Date(
        origin + offset++,
      ).toISOString(),
    revision: () =>
      origin + offset++,
  });
}

function runtimeJson(): string {
  return JSON.stringify({
    [randomUUID()]: randomUUID(),
  });
}

function runtimeSegments():
readonly string[] {
  return Object.freeze(
    Array.from(
      {
        length:
          randomInt(1, 4),
      },
      () => randomUUID(),
    ),
  );
}

function canonicalValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      canonicalValue,
    );
  }
  if (
    typeof value === "object" &&
    value !== null
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(
          ([left], [right]) =>
            left.localeCompare(
              right,
            ),
        )
        .map(
          ([key, entry]) => [
            key,
            canonicalValue(
              entry,
            ),
          ],
        ),
    );
  }
  return value;
}

function createCanonicalBytes():
NodeSqliteBackupCanonicalBytesAdapter {
  const encoder =
    new TextEncoder();
  const decoder =
    new TextDecoder();
  return Object.freeze({
    encode: (
      value: unknown,
    ): Uint8Array =>
      encoder.encode(
        JSON.stringify(
          canonicalValue(value),
        ),
      ),
    decode: (
      bytes: Uint8Array,
    ): unknown =>
      JSON.parse(
        decoder.decode(bytes),
      ),
  });
}

function createChecksum(
  identity: string,
  algorithm: string,
): NodeSqliteBackupChecksumAdapter {
  return Object.freeze({
    identity,
    checksum: (
      bytes: Uint8Array,
    ): string =>
      createHash(algorithm)
        .update(bytes)
        .digest("hex"),
  });
}

function checksumBytes(
  algorithm: string,
  bytes: Uint8Array,
): string {
  return createHash(algorithm)
    .update(bytes)
    .digest("hex");
}

function loadAuditModule():
AuditModule {
  const loaded =
    process.getBuiltinModule(
      "node:sqlite",
    ) as
      | AuditModule
      | undefined;
  if (loaded === undefined) {
    throw new Error(
      "node:sqlite is unavailable",
    );
  }
  return loaded;
}

function normalizeCell(
  value: unknown,
): string | number | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    value === null
  ) {
    return value;
  }
  if (
    typeof value === "bigint" &&
    value >=
      BigInt(
        Number.MIN_SAFE_INTEGER,
      ) &&
    value <=
      BigInt(
        Number.MAX_SAFE_INTEGER,
      )
  ) {
    return Number(value);
  }
  throw new Error(
    "SQLite audit returned an unsupported value",
  );
}

function normalizeRows(
  rows:
    readonly Record<string, unknown>[],
): readonly Readonly<
  Record<
    string,
    string | number | null
  >
>[] {
  return Object.freeze(
    rows.map((row) =>
      Object.freeze(
        Object.fromEntries(
          Object.entries(row)
            .map(
              ([key, value]) => [
                key,
                normalizeCell(
                  value,
                ),
              ],
            ),
        ),
      ),
    ),
  );
}

function readSafeInteger(
  value: unknown,
  label: string,
): number {
  const normalized =
    normalizeCell(value);
  if (
    typeof normalized !==
      "number" ||
    !Number.isSafeInteger(
      normalized,
    ) ||
    normalized < 0
  ) {
    throw new Error(
      `${label} must be a non-negative safe integer`,
    );
  }
  return normalized;
}

function checksumCanonical(
  checksum:
    NodeSqliteBackupChecksumAdapter,
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
  value: unknown,
): string {
  return checksum.checksum(
    canonicalBytes.encode(value),
  ) as string;
}

function readRevisionReferences(
  database:
    AuditDatabase,
): readonly NodeSqliteBackupRevisionReference[] {
  const rows =
    database.prepare(
      `
        SELECT
          revision.id AS "revisionId",
          revision.work_id AS "workId",
          revision.document_id AS "documentId",
          revision.length AS "bodyLength",
          revision.content_hash AS "contentHash",
          revision.content_ref AS "contentRef",
          content.checksum_identity AS "contentChecksumIdentity",
          content.checksum_value AS "contentChecksumValue",
          content.byte_length AS "contentByteLength",
          revision.change_set_ref AS "changeSetRef",
          change_set.checksum_identity AS "changeSetChecksumIdentity",
          change_set.checksum_value AS "changeSetChecksumValue",
          change_set.byte_length AS "changeSetByteLength"
        FROM document_revisions AS revision
        INNER JOIN blob_manifests AS content
          ON content.blob_ref =
            revision.content_ref
        LEFT JOIN blob_manifests AS change_set
          ON change_set.blob_ref =
            revision.change_set_ref
        ORDER BY revision.id
      `,
    ).all();
  const readString = (
    row: Record<string, unknown>,
    field: string,
  ): string => {
    const value = row[field];
    if (
      typeof value !== "string" ||
      value.length === 0
    ) {
      throw new Error(
        `Revision audit returned an invalid ${field}`,
      );
    }
    return value;
  };
  return Object.freeze(
    rows.map((row) => {
      const changeSetRef =
        row.changeSetRef;
      return Object.freeze({
        revisionId:
          readString(
            row,
            "revisionId",
          ),
        workId:
          readString(
            row,
            "workId",
          ),
        documentId:
          readString(
            row,
            "documentId",
          ),
        bodyLength:
          readSafeInteger(
            row.bodyLength,
            "Revision body length",
          ),
        contentHash:
          readString(
            row,
            "contentHash",
          ),
        content:
          Object.freeze({
            blobRef:
              readString(
                row,
                "contentRef",
              ),
            address:
              Object.freeze({
                checksumIdentity:
                  readString(
                    row,
                    "contentChecksumIdentity",
                  ),
                checksumValue:
                  readString(
                    row,
                    "contentChecksumValue",
                  ),
              }),
            byteLength:
              readSafeInteger(
                row.contentByteLength,
                "Revision content byte length",
              ),
          }),
        changeSet:
          changeSetRef === null
            ? null
            : Object.freeze({
                blobRef:
                  readString(
                    row,
                    "changeSetRef",
                  ),
                address:
                  Object.freeze({
                    checksumIdentity:
                      readString(
                        row,
                        "changeSetChecksumIdentity",
                      ),
                    checksumValue:
                      readString(
                        row,
                        "changeSetChecksumValue",
                      ),
                  }),
                byteLength:
                  readSafeInteger(
                    row.changeSetByteLength,
                    "Revision change-set byte length",
                  ),
              }),
      });
    }),
  );
}

function inspectStorage(
  databasePath: string,
  checksum:
    NodeSqliteBackupChecksumAdapter,
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
): StorageAudit {
  const { DatabaseSync } =
    loadAuditModule();
  const database =
    new DatabaseSync(
      databasePath,
      {
        readOnly: true,
      },
    );
  try {
    expect(
      database.prepare(
        "PRAGMA integrity_check",
      ).all(),
    ).toEqual([
      {
        integrity_check: "ok",
      },
    ]);
    expect(
      database.prepare(
        "PRAGMA foreign_key_check",
      ).all(),
    ).toEqual([]);
    const storageIdentities =
      Object.freeze(
        database.prepare(
          `
            SELECT
              checksum_identity AS "checksumIdentity",
              target_schema_version AS "targetSchemaVersion"
            FROM storage_ledger_identity
            ORDER BY
              checksum_identity,
              target_schema_version
          `,
        ).all()
          .map((row) =>
            Object.freeze({
              checksumIdentity:
                String(
                  row.checksumIdentity,
                ),
              targetSchemaVersion:
                readSafeInteger(
                  row.targetSchemaVersion,
                  "Storage target schema version",
                ),
            }),
          ),
      );
    const userVersionRow =
      database.prepare(
        "PRAGMA user_version",
      ).all()[0];
    if (userVersionRow === undefined) {
      throw new Error(
        "SQLite user version is unavailable",
      );
    }
    const userSchemaVersion =
      readSafeInteger(
        userVersionRow.user_version,
        "SQLite user version",
      );
    const schemaRows =
      normalizeRows(
        database.prepare(
          `
            SELECT
              type,
              name,
              tbl_name,
              sql
            FROM sqlite_schema
            WHERE
              name NOT LIKE 'sqlite_%'
            ORDER BY
              type,
              name
          `,
        ).all(),
      );
    const workRows =
      normalizeRows(
        database.prepare(
          "SELECT * FROM works ORDER BY id",
        ).all(),
      );
    const documentRows =
      normalizeRows(
        database.prepare(
          "SELECT * FROM documents ORDER BY id",
        ).all(),
      );
    const checkpointRows =
      normalizeRows(
        database.prepare(
          "SELECT * FROM resume_checkpoints ORDER BY id",
        ).all(),
      );
    const sessionRows =
      normalizeRows(
        database.prepare(
          "SELECT * FROM writing_sessions ORDER BY id",
        ).all(),
      );
    const revisionReferences =
      readRevisionReferences(
        database,
      );
    const counts =
      Object.freeze({
        workCount:
          workRows.length,
        documentCount:
          documentRows.length,
        revisionCount:
          revisionReferences.length,
        resumeCheckpointCount:
          checkpointRows.length,
        writingSessionCount:
          sessionRows.length,
      });
    const logicalChecksums =
      Object.freeze({
        checksumIdentity:
          checksum.identity,
        storageIdentityChecksum:
          checksumCanonical(
            checksum,
            canonicalBytes,
            {
              storageIdentities,
              userSchemaVersion,
            },
          ),
        schemaInventoryChecksum:
          checksumCanonical(
            checksum,
            canonicalBytes,
            schemaRows,
          ),
        workInventoryChecksum:
          checksumCanonical(
            checksum,
            canonicalBytes,
            workRows,
          ),
        documentInventoryChecksum:
          checksumCanonical(
            checksum,
            canonicalBytes,
            documentRows,
          ),
        revisionInventoryChecksum:
          checksumCanonical(
            checksum,
            canonicalBytes,
            revisionReferences,
          ),
        checkpointInventoryChecksum:
          checksumCanonical(
            checksum,
            canonicalBytes,
            checkpointRows,
          ),
        sessionInventoryChecksum:
          checksumCanonical(
            checksum,
            canonicalBytes,
            sessionRows,
          ),
      });
    const activePointers =
      normalizeRows([
        ...database.prepare(
          `
            SELECT
              'work' AS "pointerKind",
              id AS "ownerId",
              resume_checkpoint_id AS "checkpointId",
              NULL AS "currentRevisionId",
              NULL AS "durableRevisionId"
            FROM works
            ORDER BY id
          `,
        ).all(),
        ...database.prepare(
          `
            SELECT
              'manuscript' AS "pointerKind",
              document_id AS "ownerId",
              NULL AS "checkpointId",
              current_revision_id AS "currentRevisionId",
              durable_revision_id AS "durableRevisionId"
            FROM manuscripts
            ORDER BY document_id
          `,
        ).all(),
      ]);
    const blobManifests =
      normalizeRows(
        database.prepare(
          `
            SELECT *
            FROM blob_manifests
            ORDER BY blob_ref
          `,
        ).all(),
      );
    const tableNames =
      database.prepare(
        `
          SELECT name
          FROM sqlite_schema
          WHERE
            type = 'table'
            AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `,
      ).all()
        .map((row) => {
          if (
            typeof row.name !==
              "string" ||
            row.name.length === 0
          ) {
            throw new Error(
              "SQLite table inventory returned an invalid name",
            );
          }
          return row.name;
        });
    const tableInventory =
      Object.freeze(
        tableNames.map((name) => {
          const quoted =
            name.replaceAll(
              "\"",
              "\"\"",
            );
          const rows =
            [...normalizeRows(
              database.prepare(
                `SELECT * FROM "${quoted}"`,
              ).all(),
            )].sort(
              (left, right) =>
                JSON.stringify(
                  canonicalValue(
                    left,
                  ),
                ).localeCompare(
                  JSON.stringify(
                    canonicalValue(
                      right,
                    ),
                  ),
                ),
            );
          return Object.freeze({
            name,
            rows:
              Object.freeze(rows),
          });
        }),
      );
    return Object.freeze({
      backup:
        Object.freeze({
          storageIdentities,
          userSchemaVersion,
          counts,
          logicalChecksums,
          revisionReferences,
        }),
      activePointers,
      blobManifests,
      tableInventoryChecksum:
        checksumCanonical(
          checksum,
          canonicalBytes,
          tableInventory,
        ),
    });
  } finally {
    database.close();
  }
}

function auditRows(
  databasePath: string,
  sql: string,
  parameters:
    readonly unknown[] = [],
): readonly Record<string, unknown>[] {
  const { DatabaseSync } =
    loadAuditModule();
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
      .all(...parameters);
  } finally {
    database.close();
  }
}

function isReachable(
  databasePath: string,
  address: BlobAddress,
): boolean {
  return auditRows(
    databasePath,
    `
      SELECT COUNT(*) AS "count"
      FROM blob_manifests
      WHERE
        checksum_identity = ?
        AND checksum_value = ?
    `,
    [
      address.checksumIdentity,
      address.checksumValue,
    ],
  )[0]?.count === 1;
}

async function seedGraph(
  databasePath: string,
  checksumIdentity: string,
  requestedSettings:
    Record<string, unknown>,
  targetSchemaVersion: number,
  blobStore: Awaited<
    ReturnType<
      typeof createNodeImmutableBlobStore
    >
  >,
): Promise<SeededGraph> {
  const contentBytes =
    Uint8Array.from(
      randomBytes(
        randomInt(41, 97),
      ),
    );
  const changeSetBytes =
    Uint8Array.from(
      randomBytes(
        randomInt(29, 83),
      ),
    );
  const content =
    await blobStore.append({
      bytes: contentBytes,
      metadata:
        Object.freeze({
          [randomUUID()]:
            randomUUID(),
        }),
      temporaryEntryIdentity:
        randomUUID(),
    });
  const changeSet =
    await blobStore.append({
      bytes: changeSetBytes,
      metadata:
        Object.freeze({
          [randomUUID()]:
            randomUUID(),
        }),
      temporaryEntryIdentity:
        randomUUID(),
    });
  const clock =
    createRuntimeClock();
  const studioId = randomUUID();
  const workId = randomUUID();
  const settingsId = randomUUID();
  const activityPolicyId =
    randomUUID();
  const focusPolicyId =
    randomUUID();
  const documentId =
    randomUUID();
  const manuscriptId =
    randomUUID();
  const revisionId =
    randomUUID();
  const anchorId =
    randomUUID();
  const checkpointId =
    randomUUID();
  const sessionId =
    randomUUID();
  const contentBlobRef =
    randomUUID();
  const changeSetBlobRef =
    randomUUID();
  const anchorOffset =
    randomInt(
      contentBytes.byteLength +
        1,
    );
  const meta = () =>
    Object.freeze({
      schemaVersion:
        targetSchemaVersion,
      revision:
        clock.revision(),
      createdAt:
        clock.instant(),
      updatedAt:
        clock.instant(),
    });
  const records:
    readonly Poc3LedgerRecord[] =
    Object.freeze([
      {
        kind: "studio",
        id: studioId,
        displayName:
          randomUUID(),
        locale: randomUUID(),
        timezone:
          randomUUID(),
        settingsRevision:
          clock.revision(),
        createdAt:
          clock.instant(),
      },
      {
        kind: "work",
        ...meta(),
        id: workId,
        studioId,
        title: randomUUID(),
        orderKey:
          randomUUID(),
        resumeCheckpointId:
          checkpointId,
        settingsId,
      },
      {
        kind:
          "activityPolicy",
        ...meta(),
        id: activityPolicyId,
        workId,
        idleTimeout:
          clock.revision(),
        navigationGrace:
          clock.revision(),
        hiddenWindowPolicy:
          randomUUID(),
        activityClassRulesJson:
          runtimeJson(),
        autoStartEnabled:
          randomInt(2) === 1,
        autoResumeFromIdle:
          randomInt(2) === 1,
        recoveryPolicy:
          randomUUID(),
      },
      {
        kind: "focusPolicy",
        ...meta(),
        id: focusPolicyId,
        workId,
        phaseDefinitionsJson:
          runtimeJson(),
        backgroundPolicy:
          randomUUID(),
        musicStartPolicy:
          randomUUID(),
        completionPolicy:
          randomUUID(),
        visibility:
          randomUUID(),
      },
      {
        kind: "workSettings",
        id: settingsId,
        workId,
        sceneRuleSetId:
          randomUUID(),
        activityPolicyId,
        focusPolicyId,
        railPreferencesJson:
          runtimeJson(),
        revision:
          clock.revision(),
      },
      {
        kind: "blobManifest",
        blobRef:
          contentBlobRef,
        checksumIdentity:
          content.address
            .checksumIdentity,
        checksumValue:
          content.address
            .checksumValue,
        byteLength:
          content.byteLength,
        createdAt:
          clock.instant(),
      },
      {
        kind: "blobManifest",
        blobRef:
          changeSetBlobRef,
        checksumIdentity:
          changeSet.address
            .checksumIdentity,
        checksumValue:
          changeSet.address
            .checksumValue,
        byteLength:
          changeSet.byteLength,
        createdAt:
          clock.instant(),
      },
      {
        kind: "document",
        ...meta(),
        id: documentId,
        workId,
        title: randomUUID(),
        orderKey:
          randomUUID(),
        manuscriptId,
      },
      {
        kind:
          "documentRevision",
        id: revisionId,
        workId,
        documentId,
        contentRef:
          contentBlobRef,
        changeSetRef:
          changeSetBlobRef,
        contentHash:
          content.address
            .checksumValue,
        length:
          content.byteLength,
        cause: randomUUID(),
        createdAt:
          clock.instant(),
        durableAt:
          clock.instant(),
      },
      {
        kind: "manuscript",
        id: manuscriptId,
        workId,
        documentId,
        currentRevisionId:
          revisionId,
        durableRevisionId:
          revisionId,
        updatedAt:
          clock.instant(),
      },
      {
        kind: "anchor",
        ...meta(),
        id: anchorId,
        workId,
        documentId,
        originRevisionId:
          revisionId,
        resolvedRevisionId:
          revisionId,
        startOffset:
          anchorOffset,
        endOffset:
          anchorOffset,
        exactQuote: "",
        prefixContext:
          randomUUID(),
        suffixContext:
          randomUUID(),
        quoteHash:
          randomUUID(),
        contextHash:
          randomUUID(),
        status: randomUUID(),
        resolutionEvidenceJson:
          runtimeJson(),
      },
      {
        kind:
          "resumeCheckpoint",
        ...meta(),
        id: checkpointId,
        workId,
        documentId,
        documentRevisionId:
          revisionId,
        cursorAnchorId:
          anchorId,
        workspaceMode:
          randomUUID(),
        contextRefsJson:
          runtimeJson(),
        capturedAt:
          clock.instant(),
      },
      {
        kind:
          "writingSession",
        ...meta(),
        id: sessionId,
        workId,
        documentId,
        policyId:
          activityPolicyId,
        state: randomUUID(),
        modeRef: randomUUID(),
        startedAt:
          clock.instant(),
        endedAt:
          clock.instant(),
        lastDurableHeartbeatAt:
          clock.instant(),
        startRevisionId:
          revisionId,
        endRevisionId:
          revisionId,
        recoveryEvidenceJson:
          runtimeJson(),
      },
    ]);
  const profile =
    parsePoc3StorageOpenProfile({
      databasePath,
      checksumIdentity,
      requestedSettings,
      targetSchemaVersion,
    });
  const ledger =
    await openNodeSqliteLedger(
      profile,
    );
  try {
    await ledger.transaction(
      async (transaction) => {
        for (const record of records) {
          transaction.write(
            record,
          );
        }
      },
    );
  } finally {
    ledger.close();
  }
  return Object.freeze({
    workId,
    documentId,
    revisionId,
    contentBlobRef,
    changeSetBlobRef,
    contentAddress:
      content.address,
    changeSetAddress:
      changeSet.address,
    contentBytes,
    changeSetBytes,
  });
}

async function pathExists(
  path: string,
): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (
      (
        error as
          NodeJS.ErrnoException
      ).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

async function treeFingerprint(
  root: string,
  segments:
    readonly string[] = [],
): Promise<readonly string[]> {
  const entries =
    await readdir(
      join(root, ...segments),
      {
        withFileTypes: true,
      },
    );
  const result:
    string[] = [];
  for (
    const entry
    of entries.sort(
      (left, right) =>
        left.name.localeCompare(
          right.name,
        ),
    )
  ) {
    const childSegments =
      [
        ...segments,
        entry.name,
      ];
    if (entry.isDirectory()) {
      result.push(
        JSON.stringify([
          "directory",
          childSegments,
        ]),
      );
      result.push(
        ...await treeFingerprint(
          root,
          childSegments,
        ),
      );
    } else if (entry.isFile()) {
      result.push(
        JSON.stringify([
          "file",
          childSegments,
          checksumBytes(
            selectStableTreeHash,
            new Uint8Array(
              await readFile(
                join(
                  root,
                  ...childSegments,
                ),
              ),
            ),
          ),
        ]),
      );
    } else {
      throw new Error(
        "Storage tree contains a non-file entry",
      );
    }
  }
  return Object.freeze(
    result,
  );
}

async function treeFiles(
  root: string,
  segments:
    readonly string[] = [],
): Promise<readonly (
  readonly string[]
)[]> {
  const entries =
    await readdir(
      join(root, ...segments),
      {
        withFileTypes: true,
      },
    );
  const files:
    (readonly string[])[] = [];
  for (
    const entry
    of entries.sort(
      (left, right) =>
        left.name.localeCompare(
          right.name,
        ),
    )
  ) {
    const child =
      Object.freeze([
        ...segments,
        entry.name,
      ]);
    if (entry.isDirectory()) {
      files.push(
        ...await treeFiles(
          root,
          child,
        ),
      );
    } else if (entry.isFile()) {
      files.push(child);
    } else {
      throw new Error(
        "Backup remnant contains a non-file entry",
      );
    }
  }
  return Object.freeze(files);
}

const selectStableTreeHash =
  selectRuntimeHash();

async function discoverDatabaseName(
  databasePath: string,
): Promise<string> {
  const { DatabaseSync } =
    loadAuditModule();
  const database =
    new DatabaseSync(
      databasePath,
      {
        readOnly: true,
      },
    );
  try {
    const rows =
      database.prepare(
        "PRAGMA database_list",
      ).all();
    const row =
      rows.find(
        (entry) =>
          entry.file ===
            databasePath,
      ) ?? rows[0];
    if (
      row === undefined ||
      typeof row.name !==
        "string" ||
      row.name.length === 0
    ) {
      throw new Error(
        "SQLite database name is unavailable",
      );
    }
    return row.name;
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
            "Caller deadline elapsed before backup worker ready",
          ),
        );
        return;
      }
      const timer =
        setTimeout(
          () => {
            cleanup();
            rejectNow(
              new Error(
                "Caller deadline elapsed before backup worker ready",
              ),
            );
          },
          remaining,
        );
      const handleMessage = (
        message: unknown,
      ) => {
        if (
          typeof message ===
            "object" &&
          message !== null &&
          Reflect.get(
            message,
            "type",
          ) ===
            "poc-3-backup-crash-worker-ready"
        ) {
          cleanup();
          resolveNow();
        }
      };
      const handleExit = () => {
        cleanup();
        rejectNow(
          new Error(
            "Backup crash worker exited before ready",
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
  const workerState: {
    failure: {
      readonly errorName: string;
      readonly errorCode: string;
      readonly errorStage: string;
      readonly errorOrigin: string;
    } | null;
  } = {
    failure: null,
  };
  const handleMessage = (
    message: unknown,
  ) => {
    if (
      typeof message === "object" &&
      message !== null &&
      Reflect.get(
        message,
        "type",
      ) ===
        "poc-3-backup-crash-worker-failed"
    ) {
      workerState.failure =
        Object.freeze({
          errorName:
            String(
              Reflect.get(
                message,
                "errorName",
              ),
            ),
          errorCode:
            String(
              Reflect.get(
                message,
                "errorCode",
              ),
            ),
          errorStage:
            String(
              Reflect.get(
                message,
                "errorStage",
              ),
            ),
          errorOrigin:
            String(
              Reflect.get(
                message,
                "errorOrigin",
              ),
            ),
        });
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
          "Caller deadline elapsed before durable backup marker",
        );
      }
      const workerFailure =
        workerState.failure;
      if (workerFailure !== null) {
        throw new Error(
          `Backup crash worker failed before marker at ${workerFailure.errorStage}/${workerFailure.errorOrigin}: ${workerFailure.errorName}/${workerFailure.errorCode}`,
        );
      }
      if (
        child.exitCode !== null ||
        child.signalCode !== null
      ) {
        throw new Error(
          "Backup crash worker exited before durable marker",
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
          setImmediate(
            resolveNow,
          );
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
      "Caller deadline elapsed before backup worker exit",
    );
  }
  let timer:
    ReturnType<
      typeof setTimeout
    > |
    undefined;
  try {
    return await Promise.race([
      exitObservation,
      new Promise<never>(
        (_resolveNow, rejectNow) => {
          timer =
            setTimeout(
              () =>
                rejectNow(
                  new Error(
                    "Caller deadline elapsed before backup worker exit",
                  ),
                ),
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
  "POC-3 backup process failure",
  () => {
    it(
      "keeps a checksum-valid caller temporary bundle and exact source baseline when the backup worker is killed before final publication",
      async () => {
        const fixture =
          await readJsonFixture<
            LedgerFixture
          >(
            "../fixtures/storage/poc-3-ledger.manifest.json",
          );
        const backupFixture =
          await readJsonFixture<
            BackupCoreFixture
          >(
            "../fixtures/backup/poc-3-backup-core.manifest.json",
          );
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const resolvedRoot =
          resolve(temporaryRoot);
        const osTemporaryRoot =
          resolve(tmpdir());
        const relation =
          relative(
            osTemporaryRoot,
            resolvedRoot,
          );
        if (
          relation.length === 0 ||
          relation === ".." ||
          relation.startsWith(
            `..${sep}`,
          )
        ) {
          throw new Error(
            "Backup process-failure directory is outside the verified OS temporary path",
          );
        }
        let child:
          ChildProcess |
          undefined;
        try {
          const sourceDatabasePath =
            join(
              resolvedRoot,
              randomUUID(),
            );
          const blobStoreProfile =
            parseNodeImmutableBlobStoreProfile(
              {
                rootDirectoryPath:
                  join(
                    resolvedRoot,
                    randomUUID(),
                  ),
                checksum: {
                  identity:
                    randomUUID(),
                  algorithm:
                    selectRuntimeHash(),
                },
                publishedLayout: {
                  directorySegments:
                    runtimeSegments(),
                  shardWidths:
                    Object.freeze(
                      Array.from(
                        {
                          length:
                            randomInt(1, 4),
                        },
                        () =>
                          randomInt(1, 5),
                      ),
                    ),
                  fileNamePrefix:
                    randomUUID(),
                  fileNameSuffix:
                    randomUUID(),
                },
                temporaryLayout: {
                  directorySegments:
                    runtimeSegments(),
                },
              },
            );
          const blobStore =
            await createNodeImmutableBlobStore(
              blobStoreProfile,
            );
          const targetSchemaVersion =
            randomInt(1, 129);
          const graph =
            await seedGraph(
              sourceDatabasePath,
              blobStoreProfile
                .checksum.identity,
              fixture
                .requestedSettings,
              targetSchemaVersion,
              blobStore,
            );
          const orphan =
            await blobStore.append({
              bytes:
                randomBytes(
                  randomInt(31, 89),
                ),
              metadata:
                Object.freeze({
                  [randomUUID()]:
                    randomUUID(),
                }),
              temporaryEntryIdentity:
                randomUUID(),
            });
          const unrelatedTemporaryIdentity =
            randomUUID();
          const unrelatedTemporaryPath =
            join(
              blobStoreProfile
                .rootDirectoryPath,
              ...blobStoreProfile
                .temporaryLayout
                .directorySegments,
              unrelatedTemporaryIdentity,
            );
          await mkdir(
            dirname(
              unrelatedTemporaryPath,
            ),
            {
              recursive: true,
            },
          );
          await writeFile(
            unrelatedTemporaryPath,
            randomBytes(
              randomInt(23, 73),
            ),
            {
              flag: "wx",
            },
          );
          const storageOpenProfile =
            parsePoc3StorageOpenProfile({
              databasePath:
                sourceDatabasePath,
              checksumIdentity:
                blobStoreProfile
                  .checksum.identity,
              requestedSettings:
                fixture
                  .requestedSettings,
              targetSchemaVersion,
            });
          const bundleChecksumIdentity =
            randomUUID();
          const bundleChecksumAlgorithm =
            selectRuntimeHash();
          const bundleChecksum =
            createChecksum(
              bundleChecksumIdentity,
              bundleChecksumAlgorithm,
            );
          const canonicalBytes =
            createCanonicalBytes();
          const baselineStorage =
            inspectStorage(
              sourceDatabasePath,
              bundleChecksum,
              canonicalBytes,
            );
          const baselineBlobInventory =
            await blobStore.inventory({
              isReachable:
                async (address) =>
                  isReachable(
                    sourceDatabasePath,
                    address,
                  ),
            });
          const baselineBlobTree =
            await treeFingerprint(
              blobStoreProfile
                .rootDirectoryPath,
            );
          const bundleParent =
            join(
              resolvedRoot,
              randomUUID(),
            );
          await mkdir(bundleParent);
          const temporaryBundleRoot =
            join(
              bundleParent,
              randomUUID(),
            );
          const finalBundleRoot =
            join(
              bundleParent,
              randomUUID(),
            );
          const markerPath =
            join(
              resolvedRoot,
              randomUUID(),
            );
          const markerTemporaryPath =
            join(
              resolvedRoot,
              randomUUID(),
            );
          const databaseEntrySegments =
            runtimeSegments();
          const manifestEntrySegments =
            runtimeSegments();
          const sidecarEntrySegments =
            runtimeSegments();
          const contentEntrySegments =
            runtimeSegments();
          const changeSetEntrySegments =
            runtimeSegments();
          const canonicalJsonIdentity =
            randomUUID();
          const createdAt =
            createRuntimeClock()
              .instant();
          const databaseName =
            await discoverDatabaseName(
              sourceDatabasePath,
            );
          const profile =
            parsePoc3BackupCrashGateProfile(
              {
                schemaVersion: 1,
                scenarioId:
                  randomUUID(),
                reachedPath:
                  markerPath,
                reachedTemporaryPath:
                  markerTemporaryPath,
                sourceDatabasePath,
                sourceBlobStoreProfile:
                  blobStoreProfile,
                temporaryBundleRoot,
                finalBundleRoot,
                layout: {
                  databaseEntrySegments,
                  manifestEntrySegments,
                  manifestChecksumEntrySegments:
                    sidecarEntrySegments,
                  blobEntries: [
                    {
                      address:
                        graph
                          .contentAddress,
                      entrySegments:
                        contentEntrySegments,
                    },
                    {
                      address:
                        graph
                          .changeSetAddress,
                      entrySegments:
                        changeSetEntrySegments,
                    },
                  ],
                },
                format: {
                  identity:
                    randomUUID(),
                  version:
                    randomUUID(),
                },
                sqlite: {
                  sourceDatabaseName:
                    databaseName,
                  targetDatabaseName:
                    databaseName,
                  pagesPerStep:
                    randomInt(1, 65),
                  standaloneSnapshotJournalMode:
                    backupFixture
                      .standaloneSnapshotJournalMode,
                },
                canonicalJson: {
                  identity:
                    canonicalJsonIdentity,
                },
                checksum: {
                  identity:
                    bundleChecksumIdentity,
                  algorithm:
                    bundleChecksumAlgorithm,
                },
                clock: {
                  createdAt,
                },
              },
            );
          expect(() =>
            parsePoc3BackupCrashGateProfile({
              ...profile,
              [randomUUID()]:
                randomUUID(),
            }),
          ).toThrow(/Unsupported/);
          expect(() =>
            parsePoc3BackupCrashGateProfile({
              ...profile,
              reachedTemporaryPath:
                join(
                  bundleParent,
                  randomUUID(),
                ),
            }),
          ).toThrow(/same parent/);
          const callerChecksumIdentity =
            randomUUID();
          const callerChecksumAlgorithm =
            selectRuntimeHash();
          const callerChecksumValue =
            checksumPoc3BackupCrashGateProfile(
              profile,
              callerChecksumAlgorithm,
            );
          const childPath =
            join(
              process.cwd(),
              "dist-electron",
              "desktop",
              "poc-3-backup-crash-worker.js",
            );
          child = fork(
            childPath,
            [],
            {
              cwd: process.cwd(),
              env: {
                ...process.env,
                EUM_STUDIO_POC_3_BACKUP_CRASH_WORKER:
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
              "poc-3-backup-crash-worker-run",
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
            "poc-3-backup-crash-gate-reached",
            profile.schemaVersion,
            profile.scenarioId,
            "before-bundle-publish",
            profile
              .canonicalJson
              .identity,
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
          const childPid = child.pid;
          if (childPid === undefined) {
            throw new Error(
              "Backup crash worker has no PID",
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
            child.kill("SIGKILL"),
          ).toBe(true);
          const exit =
            await waitForExit(
              exitObservation,
              callerDeadline,
            );
          expect(exit).toHaveLength(2);
          expect(
            child.exitCode !== null ||
              child.signalCode !==
                null,
          ).toBe(true);
          child = undefined;

          expect(
            await pathExists(
              finalBundleRoot,
            ),
          ).toBe(false);
          expect(
            await pathExists(
              temporaryBundleRoot,
            ),
          ).toBe(true);
          const manifestBytes =
            new Uint8Array(
              await readFile(
                join(
                  temporaryBundleRoot,
                  ...manifestEntrySegments,
                ),
              ),
            );
          const manifest =
            canonicalBytes.decode(
              manifestBytes,
            ) as
              NodeSqliteBackupManifest;
          expect(
            canonicalBytes.encode(
              manifest,
            ),
          ).toEqual(
            manifestBytes,
          );
          const sidecarBytes =
            new Uint8Array(
              await readFile(
                join(
                  temporaryBundleRoot,
                  ...sidecarEntrySegments,
                ),
              ),
            );
          const sidecar =
            canonicalBytes.decode(
              sidecarBytes,
            ) as
              Record<string, unknown>;
          expect(
            canonicalBytes.encode(
              sidecar,
            ),
          ).toEqual(
            sidecarBytes,
          );
          expect(sidecar).toEqual({
            byteLength:
              manifestBytes
                .byteLength,
            checksumIdentity:
              bundleChecksumIdentity,
            checksumValue:
              checksumBytes(
                bundleChecksumAlgorithm,
                manifestBytes,
              ),
            manifestEntrySegments,
          });
          const databasePath =
            join(
              temporaryBundleRoot,
              ...databaseEntrySegments,
            );
          const databaseBytes =
            new Uint8Array(
              await readFile(
                databasePath,
              ),
            );
          expect(
            manifest.database,
          ).toEqual({
            byteLength:
              databaseBytes
                .byteLength,
            bundleRelativeSegments:
              databaseEntrySegments,
            checksumIdentity:
              bundleChecksumIdentity,
            checksumValue:
              checksumBytes(
                bundleChecksumAlgorithm,
                databaseBytes,
              ),
          });
          expect(
            manifest.createdAt,
          ).toBe(createdAt);
          expect(
            manifest.format,
          ).toEqual(
            profile.format,
          );
          expect(
            manifest.counts,
          ).toEqual(
            baselineStorage
              .backup.counts,
          );
          expect(
            manifest
              .logicalChecksums,
          ).toEqual(
            baselineStorage
              .backup
              .logicalChecksums,
          );
          expect(
            manifest
              .revisionReferences,
          ).toEqual(
            baselineStorage
              .backup
              .revisionReferences,
          );
          const mappings =
            new Map(
              profile.layout
                .blobEntries
                .map((entry) => [
                  JSON.stringify(
                    entry.address,
                  ),
                  entry.entrySegments,
                ] as const),
            );
          const expectedBlobBytes =
            new Map<string, Uint8Array>([
              [
                JSON.stringify(
                  graph
                    .contentAddress,
                ),
                graph.contentBytes,
              ],
              [
                JSON.stringify(
                  graph
                    .changeSetAddress,
                ),
                graph.changeSetBytes,
              ],
            ]);
          expect(
            new Set(
              manifest.blobs
                .map((entry) =>
                  JSON.stringify(
                    entry
                      .sourceAddress,
                  ),
                ),
            ),
          ).toEqual(
            new Set(
              expectedBlobBytes
                .keys(),
            ),
          );
          for (
            const entry
            of manifest.blobs
          ) {
            const key =
              JSON.stringify(
                entry
                  .sourceAddress,
              );
            const segments =
              mappings.get(key);
            const expectedBytes =
              expectedBlobBytes.get(
                key,
              );
            if (
              segments === undefined ||
              expectedBytes ===
                undefined
            ) {
              throw new Error(
                "Backup manifest contains an unrequested blob",
              );
            }
            expect(
              entry
                .bundleRelativeSegments,
            ).toEqual(segments);
            const bytes =
              new Uint8Array(
                await readFile(
                  join(
                    temporaryBundleRoot,
                    ...segments,
                  ),
                ),
              );
            expect(bytes).toEqual(
              expectedBytes,
            );
            expect(entry).toEqual(
              expect.objectContaining({
                byteLength:
                  bytes.byteLength,
                checksumIdentity:
                  bundleChecksumIdentity,
                checksumValue:
                  checksumBytes(
                    bundleChecksumAlgorithm,
                    bytes,
                  ),
              }),
            );
          }
          const expectedFiles =
            [
              databaseEntrySegments,
              manifestEntrySegments,
              sidecarEntrySegments,
              contentEntrySegments,
              changeSetEntrySegments,
            ]
              .map((segments) =>
                JSON.stringify(
                  segments,
                ),
              )
              .sort();
          const remnantFiles =
            (
              await treeFiles(
                temporaryBundleRoot,
              )
            )
              .map((segments) =>
                JSON.stringify(
                  segments,
                ),
              )
              .sort();
          expect(
            remnantFiles,
          ).toEqual(
            expectedFiles,
          );
          expect(
            JSON.stringify(
              manifest,
            ),
          ).not.toContain(
            orphan.address
              .checksumValue,
          );
          expect(
            JSON.stringify(
              remnantFiles,
            ),
          ).not.toContain(
            unrelatedTemporaryIdentity,
          );
          expect(
            JSON.stringify(
              remnantFiles,
            ),
          ).not.toContain(
            orphan.address
              .checksumValue,
          );

          const snapshotStorage =
            inspectStorage(
              databasePath,
              bundleChecksum,
              canonicalBytes,
            );
          expect(
            snapshotStorage,
          ).toEqual(
            baselineStorage,
          );
          const reopenedLedger =
            await openNodeSqliteLedger(
              storageOpenProfile,
            );
          reopenedLedger.close();
          expect(
            inspectStorage(
              sourceDatabasePath,
              bundleChecksum,
              canonicalBytes,
            ),
          ).toEqual(
            baselineStorage,
          );
          expect(
            await blobStore.inventory({
              isReachable:
                async (address) =>
                  isReachable(
                    sourceDatabasePath,
                    address,
                  ),
            }),
          ).toEqual(
            baselineBlobInventory,
          );
          expect(
            await treeFingerprint(
              blobStoreProfile
                .rootDirectoryPath,
            ),
          ).toEqual(
            baselineBlobTree,
          );
          expect(
            await pathExists(
              unrelatedTemporaryPath,
            ),
          ).toBe(true);
          expect(
            await blobStore.readExact(
              graph.contentAddress,
            ),
          ).toEqual(
            expect.objectContaining({
              bytes:
                graph.contentBytes,
            }),
          );
          expect(
            await blobStore.readExact(
              graph
                .changeSetAddress,
            ),
          ).toEqual(
            expect.objectContaining({
              bytes:
                graph
                  .changeSetBytes,
            }),
          );
        } finally {
          if (
            child !== undefined &&
            child.exitCode === null &&
            child.signalCode === null
          ) {
            child.kill("SIGKILL");
            await once(
              child,
              "exit",
            ).catch(
              () => undefined,
            );
          }
          await rm(
            resolvedRoot,
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
