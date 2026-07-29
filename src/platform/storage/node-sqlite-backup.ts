import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import type {
  BlobAddress,
  ImmutableBlobStore,
} from "../../application/storage/blob-store";
import type {
  StorageBackupReportData,
} from "../../application/storage/storage-backup";

export type NodeSqliteBackupChecksumAdapter = {
  readonly identity: string;
  checksum(
    bytes: Uint8Array,
  ): string | Promise<string>;
};

export type NodeSqliteBackupCanonicalBytesAdapter = {
  encode(value: unknown): Uint8Array;
  decode(bytes: Uint8Array): unknown;
};

export type NodeSqliteBackupClock = {
  now(): string;
};

export type NodeSqliteBackupFormat = {
  readonly identity: string;
  readonly version: string;
};

export type NodeSqliteBackupSqliteOptions = {
  readonly sourceDatabaseName: string;
  readonly targetDatabaseName: string;
  readonly pagesPerStep: number;
  readonly standaloneSnapshotJournalMode:
    string;
};

export type NodeSqliteBackupBundleLayout = {
  readonly databaseEntrySegments:
    readonly string[];
  readonly manifestEntrySegments:
    readonly string[];
  readonly manifestChecksumEntrySegments:
    readonly string[];
  blobEntrySegments(
    address: BlobAddress,
  ): readonly string[];
};

export type NodeSqliteRestoreTargetLayout = {
  readonly databaseEntrySegments:
    readonly string[];
  blobEntrySegments(
    address: BlobAddress,
  ): readonly string[];
};

export type NodeSqliteBackupCounts = {
  readonly workCount: number;
  readonly documentCount: number;
  readonly revisionCount: number;
  readonly resumeCheckpointCount:
    number;
  readonly writingSessionCount:
    number;
};

export type NodeSqliteBackupStorageIdentity = {
  readonly checksumIdentity: string;
  readonly targetSchemaVersion:
    number;
};

export type NodeSqliteBackupEntryChecksum = {
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly bundleRelativeSegments:
    readonly string[];
};

export type NodeSqliteBackupBlobEntry =
  NodeSqliteBackupEntryChecksum & {
    readonly blobRef: string;
    readonly sourceAddress:
      BlobAddress;
  };

export type NodeSqliteBackupRevisionBlobReference = {
  readonly blobRef: string;
  readonly address: BlobAddress;
  readonly byteLength: number;
};

export type NodeSqliteBackupRevisionReference = {
  readonly revisionId: string;
  readonly workId: string;
  readonly documentId: string;
  readonly bodyLength: number;
  readonly contentHash: string;
  readonly content:
    NodeSqliteBackupRevisionBlobReference;
  readonly changeSet:
    | NodeSqliteBackupRevisionBlobReference
    | null;
};

export type NodeSqliteBackupLogicalChecksums = {
  readonly checksumIdentity: string;
  readonly storageIdentityChecksum:
    string;
  readonly schemaInventoryChecksum:
    string;
  readonly workInventoryChecksum:
    string;
  readonly documentInventoryChecksum:
    string;
  readonly revisionInventoryChecksum:
    string;
  readonly checkpointInventoryChecksum:
    string;
  readonly sessionInventoryChecksum:
    string;
};

export type NodeSqliteBackupManifest = {
  readonly format:
    NodeSqliteBackupFormat;
  readonly createdAt: string;
  readonly storageIdentities:
    readonly NodeSqliteBackupStorageIdentity[];
  readonly userSchemaVersion: number;
  readonly counts:
    NodeSqliteBackupCounts;
  readonly logicalChecksums:
    NodeSqliteBackupLogicalChecksums;
  readonly database:
    NodeSqliteBackupEntryChecksum;
  readonly revisionReferences:
    readonly NodeSqliteBackupRevisionReference[];
  readonly blobs:
    readonly NodeSqliteBackupBlobEntry[];
};

export type NodeSqliteBackupManifestCodec = {
  encodeCanonical(
    manifest:
      NodeSqliteBackupManifest,
  ): Uint8Array;
  decodeCanonical(
    bytes: Uint8Array,
  ): NodeSqliteBackupManifest;
};

export type NodeSqliteBackupStage =
  | "database-snapshot-pinned"
  | "before-blob-copy"
  | "before-bundle-publish";

export type NodeSqliteRestoreStage =
  | "bundle-verified"
  | "before-target-publish";

export type NodeSqliteBackupStageHook = (
  stage: NodeSqliteBackupStage,
) => Promise<void>;

export type NodeSqliteRestoreStageHook = (
  stage: NodeSqliteRestoreStage,
) => Promise<void>;

export type NodeSqliteRestorePreflightInput = {
  readonly requiredByteCount:
    number;
};

export type NodeSqliteRestorePreflightPort = {
  preflight(
    input:
      NodeSqliteRestorePreflightInput,
  ): Promise<void>;
};

export type CreateNodeSqliteBackupBundleInput = {
  readonly sourceDatabasePath:
    string;
  readonly sourceBlobStore:
    ImmutableBlobStore;
  readonly temporaryBundleRoot:
    string;
  readonly finalBundleRoot: string;
  readonly layout:
    NodeSqliteBackupBundleLayout;
  readonly format:
    NodeSqliteBackupFormat;
  readonly sqlite:
    NodeSqliteBackupSqliteOptions;
  readonly manifestCodec:
    NodeSqliteBackupManifestCodec;
  readonly canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter;
  readonly checksum:
    NodeSqliteBackupChecksumAdapter;
  readonly clock:
    NodeSqliteBackupClock;
  readonly stageHook?:
    NodeSqliteBackupStageHook;
};

export type RestoreNodeSqliteBackupBundleInput = {
  readonly finalBundleRoot: string;
  readonly bundleLayout:
    NodeSqliteBackupBundleLayout;
  readonly targetStagingRoot:
    string;
  readonly targetFinalRoot: string;
  readonly targetLayout:
    NodeSqliteRestoreTargetLayout;
  readonly expectedFormat:
    NodeSqliteBackupFormat;
  readonly manifestCodec:
    NodeSqliteBackupManifestCodec;
  readonly canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter;
  readonly checksum:
    NodeSqliteBackupChecksumAdapter;
  readonly preflight:
    NodeSqliteRestorePreflightPort;
  readonly stageHook?:
    NodeSqliteRestoreStageHook;
};

export type NodeSqliteCreateBackupBundleReport =
  StorageBackupReportData & {
    readonly manifest:
      NodeSqliteBackupManifest;
    readonly manifestChecksum:
      NodeSqliteBackupEntryChecksum;
    readonly publication: "published";
  };

export type NodeSqliteRestoreBackupBundleReport =
  StorageBackupReportData & {
    readonly manifest:
      NodeSqliteBackupManifest;
    readonly restoredCounts:
      NodeSqliteBackupCounts;
    readonly logicalChecksums:
      NodeSqliteBackupLogicalChecksums;
    readonly publication: "published";
  };

type ErrorWithCode = {
  readonly code?: unknown;
};

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
    options?: {
      readonly readOnly?: boolean;
    },
  ) => NodeSqliteDatabase;
  backup(
    source:
      NodeSqliteDatabase,
    targetPath: string,
    options: {
      readonly source: string;
      readonly target: string;
      readonly rate: number;
    },
  ): Promise<number>;
};

type SnapshotInventory = {
  readonly storageIdentities:
    readonly NodeSqliteBackupStorageIdentity[];
  readonly userSchemaVersion: number;
  readonly counts:
    NodeSqliteBackupCounts;
  readonly logicalChecksums:
    NodeSqliteBackupLogicalChecksums;
  readonly revisionReferences:
    readonly NodeSqliteBackupRevisionReference[];
};

type RequiredBlob = {
  readonly blobRef: string;
  readonly address: BlobAddress;
  readonly byteLength: number;
};

type ManifestSidecar = {
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly manifestEntrySegments:
    readonly string[];
};

function hasErrorCode(
  error: unknown,
  code: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ErrorWithCode)
      .code === code
  );
}

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

function assertRelativeSegments(
  segments: readonly string[],
  label: string,
): void {
  if (segments.length === 0) {
    throw new Error(
      `${label} must identify one entry`,
    );
  }
  for (
    const [index, segment]
    of segments.entries()
  ) {
    if (
      segment.length === 0 ||
      basename(segment) !==
        segment ||
      segment === "." ||
      segment === ".."
    ) {
      throw new Error(
        `${label}[${index}] must be one relative path segment`,
      );
    }
  }
}

function resolveEntry(
  root: string,
  segments: readonly string[],
  label: string,
): string {
  assertRelativeSegments(
    segments,
    label,
  );
  const resolvedRoot =
    resolve(root);
  const candidate =
    resolve(
      resolvedRoot,
      ...segments,
    );
  const relation =
    relative(
      resolvedRoot,
      candidate,
    );
  if (
    relation.length === 0 ||
    isAbsolute(relation) ||
    relation === ".." ||
    relation.startsWith(
      `..${sep}`,
    )
  ) {
    throw new Error(
      `${label} resolves outside the caller root`,
    );
  }
  return candidate;
}

function assertSiblingRoots(
  stagingRoot: string,
  finalRoot: string,
  label: string,
): void {
  const staging =
    resolve(stagingRoot);
  const final =
    resolve(finalRoot);
  if (
    staging === final ||
    resolve(dirname(staging)) !==
      resolve(dirname(final))
  ) {
    throw new Error(
      `${label} roots must be distinct siblings`,
    );
  }
  if (
    staging ===
      resolve(dirname(staging)) ||
    final ===
      resolve(dirname(final))
  ) {
    throw new Error(
      `${label} roots must not resolve to their parent`,
    );
  }
}

function rootsOverlap(
  leftRoot: string,
  rightRoot: string,
): boolean {
  const left =
    resolve(leftRoot);
  const right =
    resolve(rightRoot);
  const leftToRight =
    relative(left, right);
  const rightToLeft =
    relative(right, left);
  return (
    left === right ||
    (
      leftToRight.length > 0 &&
      !isAbsolute(leftToRight) &&
      leftToRight !== ".." &&
      !leftToRight.startsWith(
        `..${sep}`,
      )
    ) ||
    (
      rightToLeft.length > 0 &&
      !isAbsolute(rightToLeft) &&
      rightToLeft !== ".." &&
      !rightToLeft.startsWith(
        `..${sep}`,
      )
    )
  );
}

async function assertAbsent(
  path: string,
  label: string,
): Promise<void> {
  try {
    await access(path);
  } catch (error) {
    if (
      hasErrorCode(
        error,
        "ENOENT",
      )
    ) {
      return;
    }
    throw error;
  }
  throw new Error(
    `${label} already exists`,
  );
}

async function writeExactNoReplace(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(
    dirname(path),
    {
      recursive: true,
    },
  );
  const handle =
    await open(path, "wx");
  try {
    let offset = 0;
    while (
      offset < bytes.byteLength
    ) {
      const result =
        await handle.write(
          bytes,
          offset,
          bytes.byteLength -
            offset,
          offset,
        );
      if (
        result.bytesWritten <=
          0
      ) {
        throw new Error(
          "Backup entry write made no progress",
        );
      }
      offset +=
        result.bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncFile(
  path: string,
): Promise<void> {
  const handle =
    await open(path, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function cleanupOwnedRoot(
  root: string,
  expectedParent: string,
): Promise<void> {
  const resolvedRoot =
    resolve(root);
  const resolvedParent =
    resolve(expectedParent);
  if (
    resolvedRoot ===
      resolvedParent ||
    resolve(
      dirname(resolvedRoot),
    ) !== resolvedParent
  ) {
    throw new Error(
      "Refused to clean an unverified operation root",
    );
  }
  await rm(resolvedRoot, {
    recursive: true,
    force: true,
  });
}

function bytesEqual(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  if (
    left.byteLength !==
      right.byteLength
  ) {
    return false;
  }
  for (
    let index = 0;
    index < left.byteLength;
    index += 1
  ) {
    if (
      left[index] !==
      right[index]
    ) {
      return false;
    }
  }
  return true;
}

function segmentsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length ===
      right.length &&
    left.every(
      (entry, index) =>
        entry === right[index],
    )
  );
}

async function checksumBytes(
  adapter:
    NodeSqliteBackupChecksumAdapter,
  bytes: Uint8Array,
): Promise<string> {
  const checksum =
    await adapter.checksum(
      bytes,
    );
  if (checksum.length === 0) {
    throw new Error(
      "Checksum adapter returned an empty value",
    );
  }
  return checksum;
}

async function checksumCanonical(
  checksum:
    NodeSqliteBackupChecksumAdapter,
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
  value: unknown,
): Promise<string> {
  return checksumBytes(
    checksum,
    canonicalBytes.encode(value),
  );
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

const sqliteProtocolTokenPattern =
  /^[A-Za-z][A-Za-z0-9_]*$/u;

const transientSqliteSidecarSuffixes =
  Object.freeze([
    "-wal",
    "-shm",
    "-journal",
  ]);

function assertSqliteProtocolToken(
  value: string,
  label: string,
): void {
  if (
    !sqliteProtocolTokenPattern
      .test(value)
  ) {
    throw new Error(
      `${label} is not a SQL-safe protocol token`,
    );
  }
}

async function assertNoTransientSqliteSidecars(
  databasePath: string,
  label: string,
): Promise<void> {
  for (
    const suffix
    of transientSqliteSidecarSuffixes
  ) {
    await assertAbsent(
      `${databasePath}${suffix}`,
      `${label} transient SQLite sidecar ${suffix}`,
    );
  }
}

function normalizeSnapshotJournalMode(
  sqlite:
    NodeSqliteModule,
  snapshotPath: string,
  requiredMode: string,
): void {
  assertSqliteProtocolToken(
    requiredMode,
    "Standalone snapshot journal mode",
  );
  const snapshotDatabase =
    new sqlite.DatabaseSync(
      snapshotPath,
    );
  try {
    const rows =
      queryRows(
        snapshotDatabase,
        `PRAGMA journal_mode = ${requiredMode}`,
      );
    if (rows.length !== 1) {
      throw new Error(
        "SQLite journal mode normalization returned an invalid row count",
      );
    }
    const actualMode =
      readString(
        rows[0] ?? {},
        "journal_mode",
        "SQLite journal mode normalization",
      );
    if (
      actualMode.toUpperCase() !==
        requiredMode.toUpperCase()
    ) {
      throw new Error(
        "SQLite journal mode normalization did not apply the caller-required mode",
      );
    }
  } finally {
    snapshotDatabase.close();
  }
}

function readString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${label} returned an invalid ${field}`,
    );
  }
  return value;
}

function readNullableString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${label} returned an invalid ${field}`,
    );
  }
  return value;
}

function readSafeInteger(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = row[field];
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return value;
  }
  if (
    typeof value === "bigint" &&
    value >= 0n &&
    value <=
      BigInt(
        Number.MAX_SAFE_INTEGER,
      )
  ) {
    return Number(value);
  }
  throw new Error(
    `${label} returned an invalid ${field}`,
  );
}

function normalizeRows(
  rows: readonly Record<
    string,
    unknown
  >[],
): readonly Readonly<
  Record<string, unknown>
>[] {
  return Object.freeze(
    rows.map((row) =>
      Object.freeze(
        Object.fromEntries(
          Object.entries(row)
            .map(
              ([key, value]) => {
                if (
                  typeof value ===
                    "bigint"
                ) {
                  if (
                    value <
                      BigInt(
                        Number.MIN_SAFE_INTEGER,
                      ) ||
                    value >
                      BigInt(
                        Number.MAX_SAFE_INTEGER,
                      )
                  ) {
                    throw new Error(
                      "SQLite inventory returned an unsafe integer",
                    );
                  }
                  return [
                    key,
                    Number(value),
                  ];
                }
                if (
                  value === null ||
                  typeof value ===
                    "string" ||
                  typeof value ===
                    "number"
                ) {
                  return [
                    key,
                    value,
                  ];
                }
                throw new Error(
                  "SQLite inventory returned an unsupported value",
                );
              },
            ),
        ),
      ),
    ),
  );
}

function assertDatabaseHealthy(
  database:
    NodeSqliteDatabase,
): void {
  const integrityRows =
    queryRows(
      database,
      "PRAGMA integrity_check",
    );
  if (
    integrityRows.length !== 1 ||
    Object.values(
      integrityRows[0] ?? {},
    )[0] !== "ok"
  ) {
    throw new Error(
      "Backup database integrity verification failed",
    );
  }
  if (
    queryRows(
      database,
      "PRAGMA foreign_key_check",
    ).length !== 0
  ) {
    throw new Error(
      "Backup database foreign key verification failed",
    );
  }
}

function readStorageIdentities(
  database:
    NodeSqliteDatabase,
):
  readonly NodeSqliteBackupStorageIdentity[] {
  return Object.freeze(
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
    ).map((row) =>
      Object.freeze({
        checksumIdentity:
          readString(
            row,
            "checksumIdentity",
            "Storage identity inventory",
          ),
        targetSchemaVersion:
          readSafeInteger(
            row,
            "targetSchemaVersion",
            "Storage identity inventory",
          ),
      }),
    ),
  );
}

function readUserSchemaVersion(
  database:
    NodeSqliteDatabase,
): number {
  const rows =
    queryRows(
      database,
      "PRAGMA user_version",
    );
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined
  ) {
    throw new Error(
      "Schema inventory is invalid",
    );
  }
  return readSafeInteger(
    row,
    "user_version",
    "Schema inventory",
  );
}

function revisionBlobReference(
  row: Record<string, unknown>,
  prefix: "content" | "changeSet",
): NodeSqliteBackupRevisionBlobReference | null {
  const referenceField =
    `${prefix}Ref`;
  const reference =
    readNullableString(
      row,
      referenceField,
      "Revision inventory",
    );
  if (reference === null) {
    if (
      prefix === "content"
    ) {
      throw new Error(
        "Revision content reference is missing",
      );
    }
    return null;
  }
  return Object.freeze({
    blobRef: reference,
    address: Object.freeze({
      checksumIdentity:
        readString(
          row,
          `${prefix}ChecksumIdentity`,
          "Revision inventory",
        ),
      checksumValue:
        readString(
          row,
          `${prefix}ChecksumValue`,
          "Revision inventory",
        ),
    }),
    byteLength:
      readSafeInteger(
        row,
        `${prefix}ByteLength`,
        "Revision inventory",
      ),
  });
}

function readRevisionReferences(
  database:
    NodeSqliteDatabase,
):
  readonly NodeSqliteBackupRevisionReference[] {
  return Object.freeze(
    queryRows(
      database,
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
    ).map((row) => {
      const content =
        revisionBlobReference(
          row,
          "content",
        );
      if (content === null) {
        throw new Error(
          "Revision content reference is missing",
        );
      }
      return Object.freeze({
        revisionId:
          readString(
            row,
            "revisionId",
            "Revision inventory",
          ),
        workId:
          readString(
            row,
            "workId",
            "Revision inventory",
          ),
        documentId:
          readString(
            row,
            "documentId",
            "Revision inventory",
          ),
        bodyLength:
          readSafeInteger(
            row,
            "bodyLength",
            "Revision inventory",
          ),
        contentHash:
          readString(
            row,
            "contentHash",
            "Revision inventory",
          ),
        content,
        changeSet:
          revisionBlobReference(
            row,
            "changeSet",
          ),
      });
    }),
  );
}

async function inspectSnapshot(
  databasePath: string,
  checksum:
    NodeSqliteBackupChecksumAdapter,
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
): Promise<SnapshotInventory> {
  const { DatabaseSync } =
    loadNodeSqlite();
  const database =
    new DatabaseSync(
      databasePath,
      {
        readOnly: true,
      },
    );
  try {
    assertDatabaseHealthy(
      database,
    );
    const storageIdentities =
      readStorageIdentities(
        database,
      );
    const userSchemaVersion =
      readUserSchemaVersion(
        database,
      );
    const schemaRows =
      normalizeRows(
        queryRows(
          database,
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
        ),
      );
    const workRows =
      normalizeRows(
        queryRows(
          database,
          "SELECT * FROM works ORDER BY id",
        ),
      );
    const documentRows =
      normalizeRows(
        queryRows(
          database,
          "SELECT * FROM documents ORDER BY id",
        ),
      );
    const checkpointRows =
      normalizeRows(
        queryRows(
          database,
          "SELECT * FROM resume_checkpoints ORDER BY id",
        ),
      );
    const sessionRows =
      normalizeRows(
        queryRows(
          database,
          "SELECT * FROM writing_sessions ORDER BY id",
        ),
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
          await checksumCanonical(
            checksum,
            canonicalBytes,
            {
              storageIdentities,
              userSchemaVersion,
            },
          ),
        schemaInventoryChecksum:
          await checksumCanonical(
            checksum,
            canonicalBytes,
            schemaRows,
          ),
        workInventoryChecksum:
          await checksumCanonical(
            checksum,
            canonicalBytes,
            workRows,
          ),
        documentInventoryChecksum:
          await checksumCanonical(
            checksum,
            canonicalBytes,
            documentRows,
          ),
        revisionInventoryChecksum:
          await checksumCanonical(
            checksum,
            canonicalBytes,
            revisionReferences,
          ),
        checkpointInventoryChecksum:
          await checksumCanonical(
            checksum,
            canonicalBytes,
            checkpointRows,
          ),
        sessionInventoryChecksum:
          await checksumCanonical(
            checksum,
            canonicalBytes,
            sessionRows,
          ),
      });
    return Object.freeze({
      storageIdentities,
      userSchemaVersion,
      counts,
      logicalChecksums,
      revisionReferences,
    });
  } finally {
    database.close();
  }
}

function requiredBlobs(
  revisions:
    readonly NodeSqliteBackupRevisionReference[],
): readonly RequiredBlob[] {
  const byReference =
    new Map<
      string,
      RequiredBlob
    >();
  const add = (
    reference:
      NodeSqliteBackupRevisionBlobReference,
  ): void => {
    const candidate =
      Object.freeze({
        blobRef:
          reference.blobRef,
        address:
          reference.address,
        byteLength:
          reference.byteLength,
      });
    const existing =
      byReference.get(
        reference.blobRef,
      );
    if (
      existing !== undefined &&
      (
        existing.byteLength !==
          candidate.byteLength ||
        existing.address
          .checksumIdentity !==
          candidate.address
            .checksumIdentity ||
        existing.address
          .checksumValue !==
          candidate.address
            .checksumValue
      )
    ) {
      throw new Error(
        "A blob reference resolves to conflicting manifest addresses",
      );
    }
    byReference.set(
      reference.blobRef,
      candidate,
    );
  };
  for (const revision of revisions) {
    add(revision.content);
    if (
      revision.changeSet !== null
    ) {
      add(revision.changeSet);
    }
  }
  return Object.freeze(
    [...byReference.values()]
      .sort((left, right) =>
        left.blobRef.localeCompare(
          right.blobRef,
        ),
      ),
  );
}

function assertUniqueEntryPaths(
  paths: readonly string[],
): void {
  const unique =
    new Set(
      paths.map((path) =>
        resolve(path),
      ),
    );
  if (
    unique.size !==
      paths.length
  ) {
    throw new Error(
      "Backup layout maps multiple entries to one path",
    );
  }
}

function asSidecar(
  value: unknown,
): ManifestSidecar {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Manifest checksum sidecar is invalid",
    );
  }
  const record =
    value as Record<
      string,
      unknown
    >;
  const keys =
    Object.keys(record)
      .sort();
  const expectedKeys =
    [
      "byteLength",
      "checksumIdentity",
      "checksumValue",
      "manifestEntrySegments",
    ].sort();
  if (
    keys.length !==
      expectedKeys.length ||
    !keys.every(
      (key, index) =>
        key ===
          expectedKeys[index],
    )
  ) {
    throw new Error(
      "Manifest checksum sidecar fields are invalid",
    );
  }
  const segments =
    record[
      "manifestEntrySegments"
    ];
  if (
    !Array.isArray(segments) ||
    !segments.every(
      (entry) =>
        typeof entry ===
          "string",
    )
  ) {
    throw new Error(
      "Manifest checksum sidecar path is invalid",
    );
  }
  const checksumIdentity =
    record["checksumIdentity"];
  const checksumValue =
    record["checksumValue"];
  const byteLength =
    record["byteLength"];
  if (
    typeof checksumIdentity !==
      "string" ||
    checksumIdentity.length ===
      0 ||
    typeof checksumValue !==
      "string" ||
    checksumValue.length === 0 ||
    typeof byteLength !==
      "number" ||
    !Number.isSafeInteger(
      byteLength,
    ) ||
    byteLength < 0
  ) {
    throw new Error(
      "Manifest checksum sidecar values are invalid",
    );
  }
  assertRelativeSegments(
    segments,
    "Manifest checksum sidecar path",
  );
  return Object.freeze({
    checksumIdentity,
    checksumValue,
    byteLength,
    manifestEntrySegments:
      Object.freeze([
        ...segments,
      ]),
  });
}

async function sameCanonical(
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
  left: unknown,
  right: unknown,
): Promise<boolean> {
  return bytesEqual(
    canonicalBytes.encode(left),
    canonicalBytes.encode(right),
  );
}

function exactRecord(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} is invalid`,
    );
  }
  const record =
    value as Record<
      string,
      unknown
    >;
  const expected =
    [...fields].sort();
  const actual =
    Object.keys(record)
      .sort();
  if (
    actual.length !==
      expected.length ||
    !actual.every(
      (key, index) =>
        key === expected[index],
    )
  ) {
    throw new Error(
      `${label} fields are invalid`,
    );
  }
  return record;
}

function assertNonEmptyFields(
  record: Record<
    string,
    unknown
  >,
  fields: readonly string[],
  label: string,
): void {
  for (const field of fields) {
    if (
      typeof record[field] !==
        "string" ||
      (
        record[field] as string
      ).length === 0
    ) {
      throw new Error(
        `${label}.${field} is invalid`,
      );
    }
  }
}

function assertCountFields(
  record: Record<
    string,
    unknown
  >,
  fields: readonly string[],
  label: string,
): void {
  for (const field of fields) {
    const value =
      record[field];
    if (
      typeof value !==
        "number" ||
      !Number.isSafeInteger(
        value,
      ) ||
      value < 0
    ) {
      throw new Error(
        `${label}.${field} is invalid`,
      );
    }
  }
}

function assertAddressShape(
  value: unknown,
  label: string,
): void {
  const record =
    exactRecord(
      value,
      [
        "checksumIdentity",
        "checksumValue",
      ],
      label,
    );
  assertNonEmptyFields(
    record,
    [
      "checksumIdentity",
      "checksumValue",
    ],
    label,
  );
}

function assertEntryShape(
  value: unknown,
  label: string,
): void {
  const record =
    exactRecord(
      value,
      [
        "bundleRelativeSegments",
        "byteLength",
        "checksumIdentity",
        "checksumValue",
      ],
      label,
    );
  assertNonEmptyFields(
    record,
    [
      "checksumIdentity",
      "checksumValue",
    ],
    label,
  );
  assertCountFields(
    record,
    ["byteLength"],
    label,
  );
  const segments =
    record[
      "bundleRelativeSegments"
    ];
  if (
    !Array.isArray(segments) ||
    !segments.every(
      (entry) =>
        typeof entry ===
          "string",
    )
  ) {
    throw new Error(
      `${label} layout is invalid`,
    );
  }
  assertRelativeSegments(
    segments,
    `${label} layout`,
  );
}

function assertRevisionBlobShape(
  value: unknown,
  label: string,
): void {
  const record =
    exactRecord(
      value,
      [
        "address",
        "blobRef",
        "byteLength",
      ],
      label,
    );
  assertNonEmptyFields(
    record,
    ["blobRef"],
    label,
  );
  assertCountFields(
    record,
    ["byteLength"],
    label,
  );
  assertAddressShape(
    record["address"],
    `${label} address`,
  );
}

function assertManifestTopLevel(
  manifest:
    NodeSqliteBackupManifest,
): void {
  const top =
    exactRecord(
      manifest,
      [
        "blobs",
        "counts",
        "createdAt",
        "database",
        "format",
        "logicalChecksums",
        "revisionReferences",
        "storageIdentities",
        "userSchemaVersion",
      ],
      "Backup manifest",
    );
  assertNonEmptyFields(
    top,
    ["createdAt"],
    "Backup manifest",
  );
  assertCountFields(
    top,
    ["userSchemaVersion"],
    "Backup manifest",
  );
  const format =
    exactRecord(
      top["format"],
      [
        "identity",
        "version",
      ],
      "Backup format",
    );
  assertNonEmptyFields(
    format,
    [
      "identity",
      "version",
    ],
    "Backup format",
  );
  const counts =
    exactRecord(
      top["counts"],
      [
        "documentCount",
        "resumeCheckpointCount",
        "revisionCount",
        "workCount",
        "writingSessionCount",
      ],
      "Backup counts",
    );
  assertCountFields(
    counts,
    Object.keys(counts),
    "Backup counts",
  );
  const logical =
    exactRecord(
      top["logicalChecksums"],
      [
        "checkpointInventoryChecksum",
        "checksumIdentity",
        "documentInventoryChecksum",
        "revisionInventoryChecksum",
        "schemaInventoryChecksum",
        "sessionInventoryChecksum",
        "storageIdentityChecksum",
        "workInventoryChecksum",
      ],
      "Backup logical checksums",
    );
  assertNonEmptyFields(
    logical,
    Object.keys(logical),
    "Backup logical checksums",
  );
  assertEntryShape(
    top["database"],
    "Backup database entry",
  );

  const identities =
    top["storageIdentities"];
  if (
    !Array.isArray(
      identities,
    )
  ) {
    throw new Error(
      "Backup storage identities are invalid",
    );
  }
  for (
    const [index, identity]
    of identities.entries()
  ) {
    const record =
      exactRecord(
        identity,
        [
          "checksumIdentity",
          "targetSchemaVersion",
        ],
        `Backup storage identity ${index}`,
      );
    assertNonEmptyFields(
      record,
      ["checksumIdentity"],
      `Backup storage identity ${index}`,
    );
    assertCountFields(
      record,
      ["targetSchemaVersion"],
      `Backup storage identity ${index}`,
    );
  }

  const revisions =
    top[
      "revisionReferences"
    ];
  if (!Array.isArray(revisions)) {
    throw new Error(
      "Backup revision references are invalid",
    );
  }
  for (
    const [index, revision]
    of revisions.entries()
  ) {
    const record =
      exactRecord(
        revision,
        [
          "bodyLength",
          "changeSet",
          "content",
          "contentHash",
          "documentId",
          "revisionId",
          "workId",
        ],
        `Backup revision ${index}`,
      );
    assertNonEmptyFields(
      record,
      [
        "contentHash",
        "documentId",
        "revisionId",
        "workId",
      ],
      `Backup revision ${index}`,
    );
    assertCountFields(
      record,
      ["bodyLength"],
      `Backup revision ${index}`,
    );
    assertRevisionBlobShape(
      record["content"],
      `Backup revision ${index} content`,
    );
    if (
      record["changeSet"] !==
        null
    ) {
      assertRevisionBlobShape(
        record[
          "changeSet"
        ],
        `Backup revision ${index} change set`,
      );
    }
  }

  const blobs = top["blobs"];
  if (!Array.isArray(blobs)) {
    throw new Error(
      "Backup blobs are invalid",
    );
  }
  for (
    const [index, blob]
    of blobs.entries()
  ) {
    const record =
      exactRecord(
        blob,
        [
          "blobRef",
          "bundleRelativeSegments",
          "byteLength",
          "checksumIdentity",
          "checksumValue",
          "sourceAddress",
        ],
        `Backup blob ${index}`,
      );
    assertNonEmptyFields(
      record,
      [
        "blobRef",
        "checksumIdentity",
        "checksumValue",
      ],
      `Backup blob ${index}`,
    );
    assertCountFields(
      record,
      ["byteLength"],
      `Backup blob ${index}`,
    );
    assertAddressShape(
      record[
        "sourceAddress"
      ],
      `Backup blob ${index} source address`,
    );
    const segments =
      record[
        "bundleRelativeSegments"
      ];
    if (
      !Array.isArray(
        segments,
      ) ||
      !segments.every(
        (entry) =>
          typeof entry ===
            "string",
      )
    ) {
      throw new Error(
        `Backup blob ${index} layout is invalid`,
      );
    }
    assertRelativeSegments(
      segments,
      `Backup blob ${index} layout`,
    );
  }
}

async function verifyManifestAgainstSnapshot(
  manifest:
    NodeSqliteBackupManifest,
  inventory:
    SnapshotInventory,
  expectedFormat:
    NodeSqliteBackupFormat,
  layout:
    NodeSqliteBackupBundleLayout,
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
): Promise<void> {
  assertManifestTopLevel(
    manifest,
  );
  if (
    !await sameCanonical(
      canonicalBytes,
      manifest.format,
      expectedFormat,
    ) ||
    !await sameCanonical(
      canonicalBytes,
      manifest.storageIdentities,
      inventory
        .storageIdentities,
    ) ||
    manifest.userSchemaVersion !==
      inventory
        .userSchemaVersion ||
    !await sameCanonical(
      canonicalBytes,
      manifest.counts,
      inventory.counts,
    ) ||
    !await sameCanonical(
      canonicalBytes,
      manifest.logicalChecksums,
      inventory
        .logicalChecksums,
    ) ||
    !await sameCanonical(
      canonicalBytes,
      manifest
        .revisionReferences,
      inventory
        .revisionReferences,
    )
  ) {
    throw new Error(
      "Backup manifest does not match its database snapshot",
    );
  }
  if (
    manifest.database
      .checksumIdentity.length ===
      0 ||
    manifest.database
      .checksumValue.length ===
      0 ||
    !Number.isSafeInteger(
      manifest.database
        .byteLength,
    ) ||
    manifest.database
      .byteLength < 0 ||
    !segmentsEqual(
      manifest.database
        .bundleRelativeSegments,
      layout
        .databaseEntrySegments,
    )
  ) {
    throw new Error(
      "Backup database entry is invalid",
    );
  }
}

async function renameNoReplace(
  sourceRoot: string,
  finalRoot: string,
  label: string,
): Promise<void> {
  await assertAbsent(
    finalRoot,
    label,
  );
  await rename(
    sourceRoot,
    finalRoot,
  );
}

export async function createNodeSqliteBackupBundle(
  input:
    CreateNodeSqliteBackupBundleInput,
): Promise<
  NodeSqliteCreateBackupBundleReport
> {
  assertSiblingRoots(
    input.temporaryBundleRoot,
    input.finalBundleRoot,
    "Backup bundle",
  );
  if (
    input.sqlite
      .sourceDatabaseName
      .length === 0 ||
    input.sqlite
      .targetDatabaseName
      .length === 0 ||
    !Number.isSafeInteger(
      input.sqlite
        .pagesPerStep,
    ) ||
    input.sqlite
      .pagesPerStep <= 0 ||
    input.sqlite
      .standaloneSnapshotJournalMode
      .length === 0 ||
    input.checksum.identity
      .length === 0 ||
    input.format.identity
      .length === 0 ||
    input.format.version
      .length === 0
  ) {
    throw new Error(
      "Backup caller profile is invalid",
    );
  }
  assertSqliteProtocolToken(
    input.sqlite
      .standaloneSnapshotJournalMode,
    "Standalone snapshot journal mode",
  );
  await assertAbsent(
    input.temporaryBundleRoot,
    "Temporary backup bundle",
  );
  await assertAbsent(
    input.finalBundleRoot,
    "Final backup bundle",
  );

  const operationParent =
    dirname(
      resolve(
        input.temporaryBundleRoot,
      ),
    );
  let operationRootOwned =
    false;
  try {
    await mkdir(
      input.temporaryBundleRoot,
    );
    operationRootOwned = true;
    const snapshotPath =
      resolveEntry(
        input.temporaryBundleRoot,
        input.layout
          .databaseEntrySegments,
        "Backup database entry",
      );
    const manifestPath =
      resolveEntry(
        input.temporaryBundleRoot,
        input.layout
          .manifestEntrySegments,
        "Backup manifest entry",
      );
    const sidecarPath =
      resolveEntry(
        input.temporaryBundleRoot,
        input.layout
          .manifestChecksumEntrySegments,
        "Backup manifest checksum entry",
      );
    assertUniqueEntryPaths([
      snapshotPath,
      manifestPath,
      sidecarPath,
    ]);
    await mkdir(
      dirname(snapshotPath),
      {
        recursive: true,
      },
    );

    const sqlite =
      loadNodeSqlite();
    const sourceDatabase =
      new sqlite.DatabaseSync(
        input.sourceDatabasePath,
        {
          readOnly: true,
        },
      );
    try {
      await sqlite.backup(
        sourceDatabase,
        snapshotPath,
        {
          source:
            input.sqlite
              .sourceDatabaseName,
          target:
            input.sqlite
              .targetDatabaseName,
          rate:
            input.sqlite
              .pagesPerStep,
        },
      );
    } finally {
      sourceDatabase.close();
    }
    normalizeSnapshotJournalMode(
      sqlite,
      snapshotPath,
      input.sqlite
        .standaloneSnapshotJournalMode,
    );
    await assertNoTransientSqliteSidecars(
      snapshotPath,
      "Normalized backup database",
    );
    await syncFile(snapshotPath);
    await input.stageHook?.(
      "database-snapshot-pinned",
    );

    const inventory =
      await inspectSnapshot(
        snapshotPath,
        input.checksum,
        input.canonicalBytes,
      );
    await assertNoTransientSqliteSidecars(
      snapshotPath,
      "Inspected backup database",
    );
    const required =
      requiredBlobs(
        inventory
          .revisionReferences,
      );
    const blobLayouts =
      required.map((blob) => {
        const segments =
          Object.freeze([
            ...input.layout
              .blobEntrySegments(
                blob.address,
              ),
          ]);
        return Object.freeze({
          blob,
          segments,
          path: resolveEntry(
            input
              .temporaryBundleRoot,
            segments,
            "Backup blob entry",
          ),
        });
      });
    assertUniqueEntryPaths([
      snapshotPath,
      manifestPath,
      sidecarPath,
      ...blobLayouts.map(
        (layout) =>
          layout.path,
      ),
    ]);
    await input.stageHook?.(
      "before-blob-copy",
    );

    const blobEntries:
      NodeSqliteBackupBlobEntry[] =
      [];
    for (
      const layout
      of blobLayouts
    ) {
      const source =
        await input
          .sourceBlobStore
          .readExact(
            layout.blob.address,
          );
      if (
        source.byteLength !==
          layout.blob.byteLength ||
        source.bytes
          .byteLength !==
          layout.blob.byteLength ||
        source.address
          .checksumIdentity !==
          layout.blob.address
            .checksumIdentity ||
        source.address
          .checksumValue !==
          layout.blob.address
            .checksumValue
      ) {
        throw new Error(
          "Source blob does not match the pinned snapshot manifest",
        );
      }
      const bytes =
        Uint8Array.from(
          source.bytes,
        );
      const bundleChecksum =
        await checksumBytes(
          input.checksum,
          bytes,
        );
      await writeExactNoReplace(
        layout.path,
        bytes,
      );
      blobEntries.push(
        Object.freeze({
          blobRef:
            layout.blob
              .blobRef,
          sourceAddress:
            Object.freeze({
              checksumIdentity:
                layout.blob
                  .address
                  .checksumIdentity,
              checksumValue:
                layout.blob
                  .address
                  .checksumValue,
            }),
          checksumIdentity:
            input.checksum
              .identity,
          checksumValue:
            bundleChecksum,
          byteLength:
            bytes.byteLength,
          bundleRelativeSegments:
            layout.segments,
        }),
      );
    }

    const databaseBytes =
      new Uint8Array(
        await readFile(
          snapshotPath,
        ),
      );
    const databaseChecksum =
      await checksumBytes(
        input.checksum,
        databaseBytes,
      );
    const createdAt =
      input.clock.now();
    if (createdAt.length === 0) {
      throw new Error(
        "Backup clock returned an empty timestamp",
      );
    }
    const manifest:
      NodeSqliteBackupManifest =
      Object.freeze({
        format:
          Object.freeze({
            identity:
              input.format
                .identity,
            version:
              input.format
                .version,
          }),
        createdAt,
        storageIdentities:
          inventory
            .storageIdentities,
        userSchemaVersion:
          inventory
            .userSchemaVersion,
        counts:
          inventory.counts,
        logicalChecksums:
          inventory
            .logicalChecksums,
        database:
          Object.freeze({
            checksumIdentity:
              input.checksum
                .identity,
            checksumValue:
              databaseChecksum,
            byteLength:
              databaseBytes
                .byteLength,
            bundleRelativeSegments:
              Object.freeze([
                ...input.layout
                  .databaseEntrySegments,
              ]),
          }),
        revisionReferences:
          inventory
            .revisionReferences,
        blobs:
          Object.freeze(
            blobEntries,
          ),
      });
    const manifestBytes =
      Uint8Array.from(
        input.manifestCodec
          .encodeCanonical(
            manifest,
          ),
      );
    const decodedManifest =
      input.manifestCodec
        .decodeCanonical(
          manifestBytes,
        );
    if (
      !bytesEqual(
        manifestBytes,
        input.manifestCodec
          .encodeCanonical(
            decodedManifest,
          ),
      ) ||
      !await sameCanonical(
        input.canonicalBytes,
        manifest,
        decodedManifest,
      )
    ) {
      throw new Error(
        "Manifest codec did not preserve canonical bytes",
      );
    }
    const manifestChecksumValue =
      await checksumBytes(
        input.checksum,
        manifestBytes,
      );
    const manifestChecksum =
      Object.freeze({
        checksumIdentity:
          input.checksum
            .identity,
        checksumValue:
          manifestChecksumValue,
        byteLength:
          manifestBytes
            .byteLength,
        bundleRelativeSegments:
          Object.freeze([
            ...input.layout
              .manifestEntrySegments,
          ]),
      });
    const sidecar:
      ManifestSidecar =
      Object.freeze({
        checksumIdentity:
          manifestChecksum
            .checksumIdentity,
        checksumValue:
          manifestChecksum
            .checksumValue,
        byteLength:
          manifestChecksum
            .byteLength,
        manifestEntrySegments:
          manifestChecksum
            .bundleRelativeSegments,
      });
    const sidecarBytes =
      Uint8Array.from(
        input.canonicalBytes
          .encode(sidecar),
      );
    const decodedSidecar =
      asSidecar(
        input.canonicalBytes
          .decode(sidecarBytes),
      );
    if (
      !bytesEqual(
        sidecarBytes,
        input.canonicalBytes
          .encode(
            decodedSidecar,
          ),
      )
    ) {
      throw new Error(
        "Canonical sidecar bytes did not round-trip",
      );
    }
    await writeExactNoReplace(
      manifestPath,
      manifestBytes,
    );
    await writeExactNoReplace(
      sidecarPath,
      sidecarBytes,
    );
    await assertNoTransientSqliteSidecars(
      snapshotPath,
      "Backup database before publication hook",
    );
    await input.stageHook?.(
      "before-bundle-publish",
    );
    await assertNoTransientSqliteSidecars(
      snapshotPath,
      "Backup database before publication",
    );
    await renameNoReplace(
      input.temporaryBundleRoot,
      input.finalBundleRoot,
      "Final backup bundle",
    );
    operationRootOwned = false;
    return Object.freeze({
      manifest,
      manifestChecksum,
      publication: "published",
    }) as
      NodeSqliteCreateBackupBundleReport;
  } catch (error) {
    if (operationRootOwned) {
      await cleanupOwnedRoot(
        input.temporaryBundleRoot,
        operationParent,
      );
    }
    throw error;
  }
}

export async function restoreNodeSqliteBackupBundle(
  input:
    RestoreNodeSqliteBackupBundleInput,
): Promise<
  NodeSqliteRestoreBackupBundleReport
> {
  assertSiblingRoots(
    input.targetStagingRoot,
    input.targetFinalRoot,
    "Restore target",
  );
  if (
    rootsOverlap(
      input.finalBundleRoot,
      input.targetStagingRoot,
    ) ||
    rootsOverlap(
      input.finalBundleRoot,
      input.targetFinalRoot,
    )
  ) {
    throw new Error(
      "Restore target must not overlap the source bundle",
    );
  }
  await assertAbsent(
    input.targetStagingRoot,
    "Restore staging root",
  );
  await assertAbsent(
    input.targetFinalRoot,
    "Restore final root",
  );

  const bundleDatabasePath =
    resolveEntry(
      input.finalBundleRoot,
      input.bundleLayout
        .databaseEntrySegments,
      "Bundle database entry",
    );
  const manifestPath =
    resolveEntry(
      input.finalBundleRoot,
      input.bundleLayout
        .manifestEntrySegments,
      "Bundle manifest entry",
    );
  const sidecarPath =
    resolveEntry(
      input.finalBundleRoot,
      input.bundleLayout
        .manifestChecksumEntrySegments,
      "Bundle manifest checksum entry",
    );
  assertUniqueEntryPaths([
    bundleDatabasePath,
    manifestPath,
    sidecarPath,
  ]);
  await assertNoTransientSqliteSidecars(
    bundleDatabasePath,
    "Bundle database before inspection",
  );
  const sidecarBytes =
    new Uint8Array(
      await readFile(
        sidecarPath,
      ),
    );
  const sidecar =
    asSidecar(
      input.canonicalBytes
        .decode(sidecarBytes),
    );
  if (
    !bytesEqual(
      sidecarBytes,
      input.canonicalBytes
        .encode(sidecar),
    ) ||
    sidecar
      .checksumIdentity !==
      input.checksum.identity ||
    !segmentsEqual(
      sidecar
        .manifestEntrySegments,
      input.bundleLayout
        .manifestEntrySegments,
    )
  ) {
    throw new Error(
      "Manifest checksum sidecar verification failed",
    );
  }
  const manifestBytes =
    new Uint8Array(
      await readFile(
        manifestPath,
      ),
    );
  if (
    manifestBytes.byteLength !==
      sidecar.byteLength ||
    await checksumBytes(
      input.checksum,
      manifestBytes,
    ) !==
      sidecar.checksumValue
  ) {
    throw new Error(
      "Manifest checksum verification failed",
    );
  }
  const manifest =
    input.manifestCodec
      .decodeCanonical(
        manifestBytes,
      );
  if (
    !bytesEqual(
      manifestBytes,
      input.manifestCodec
        .encodeCanonical(
          manifest,
        ),
    )
  ) {
    throw new Error(
      "Manifest canonical bytes verification failed",
    );
  }
  assertManifestTopLevel(
    manifest,
  );
  if (
    manifest.database
      .checksumIdentity !==
      input.checksum.identity
  ) {
    throw new Error(
      "Manifest database checksum identity is incompatible",
    );
  }
  const databaseBytes =
    new Uint8Array(
      await readFile(
        bundleDatabasePath,
      ),
    );
  if (
    databaseBytes.byteLength !==
      manifest.database
        .byteLength ||
    await checksumBytes(
      input.checksum,
      databaseBytes,
    ) !==
      manifest.database
        .checksumValue
  ) {
    throw new Error(
      "Bundle database checksum verification failed",
    );
  }
  const inventory =
    await inspectSnapshot(
      bundleDatabasePath,
      input.checksum,
      input.canonicalBytes,
    );
  await assertNoTransientSqliteSidecars(
    bundleDatabasePath,
    "Bundle database after inspection",
  );
  await verifyManifestAgainstSnapshot(
    manifest,
    inventory,
    input.expectedFormat,
    input.bundleLayout,
    input.canonicalBytes,
  );
  const required =
    requiredBlobs(
      inventory
        .revisionReferences,
    );
  if (
    manifest.blobs.length !==
      required.length
  ) {
    throw new Error(
      "Manifest required blob entry count is invalid",
    );
  }
  const manifestBlobs =
    new Map<
      string,
      NodeSqliteBackupBlobEntry
    >();
  for (
    const entry
    of manifest.blobs
  ) {
    if (
      manifestBlobs.has(
        entry.blobRef,
      )
    ) {
      throw new Error(
        "Manifest contains a duplicate required blob entry",
      );
    }
    manifestBlobs.set(
      entry.blobRef,
      entry,
    );
  }
  const verifiedBlobs:
    {
      readonly required:
        RequiredBlob;
      readonly entry:
        NodeSqliteBackupBlobEntry;
      readonly bytes: Uint8Array;
    }[] = [];
  const bundleBlobPaths:
    string[] = [];
  for (
    const requiredBlob
    of required
  ) {
    const entry =
      manifestBlobs.get(
        requiredBlob.blobRef,
      );
    if (
      entry === undefined ||
      entry.sourceAddress
        .checksumIdentity !==
        requiredBlob.address
          .checksumIdentity ||
      entry.sourceAddress
        .checksumValue !==
        requiredBlob.address
          .checksumValue ||
      entry.byteLength !==
        requiredBlob.byteLength ||
      entry.checksumIdentity !==
        input.checksum.identity
    ) {
      throw new Error(
        "Manifest required blob entry does not match the database snapshot",
      );
    }
    const expectedSegments =
      input.bundleLayout
        .blobEntrySegments(
          requiredBlob.address,
        );
    if (
      !segmentsEqual(
        entry
          .bundleRelativeSegments,
        expectedSegments,
      )
    ) {
      throw new Error(
        "Manifest required blob layout is invalid",
      );
    }
    const bundleBlobPath =
      resolveEntry(
        input.finalBundleRoot,
        expectedSegments,
        "Bundle required blob entry",
      );
    bundleBlobPaths.push(
      bundleBlobPath,
    );
    const bytes =
      new Uint8Array(
        await readFile(
          bundleBlobPath,
        ),
      );
    if (
      bytes.byteLength !==
        entry.byteLength ||
      await checksumBytes(
        input.checksum,
        bytes,
      ) !==
        entry.checksumValue
    ) {
      throw new Error(
        "Bundle required blob checksum verification failed",
      );
    }
    verifiedBlobs.push(
      Object.freeze({
        required:
          requiredBlob,
        entry,
        bytes,
      }),
    );
  }
  assertUniqueEntryPaths([
    bundleDatabasePath,
    manifestPath,
    sidecarPath,
    ...bundleBlobPaths,
  ]);
  await input.stageHook?.(
    "bundle-verified",
  );
  let requiredByteCount =
    databaseBytes.byteLength;
  for (
    const blob
    of verifiedBlobs
  ) {
    requiredByteCount +=
      blob.bytes.byteLength;
    if (
      !Number.isSafeInteger(
        requiredByteCount,
      )
    ) {
      throw new Error(
        "Restore required byte count exceeds the supported integer range",
      );
    }
  }
  await input.preflight
    .preflight({
      requiredByteCount,
    });
  await assertAbsent(
    input.targetStagingRoot,
    "Restore staging root",
  );
  await assertAbsent(
    input.targetFinalRoot,
    "Restore final root",
  );

  const operationParent =
    dirname(
      resolve(
        input.targetStagingRoot,
      ),
    );
  let operationRootOwned =
    false;
  try {
    await mkdir(
      input.targetStagingRoot,
    );
    operationRootOwned = true;
    const targetDatabasePath =
      resolveEntry(
        input.targetStagingRoot,
        input.targetLayout
          .databaseEntrySegments,
        "Target database entry",
      );
    const targetBlobLayouts =
      verifiedBlobs.map(
        (blob) => {
          const segments =
            Object.freeze([
              ...input.targetLayout
                .blobEntrySegments(
                  blob.required
                    .address,
                ),
            ]);
          return Object.freeze({
            blob,
            path: resolveEntry(
              input
                .targetStagingRoot,
              segments,
              "Target blob entry",
            ),
          });
        },
      );
    assertUniqueEntryPaths([
      targetDatabasePath,
      ...targetBlobLayouts.map(
        (layout) =>
          layout.path,
      ),
    ]);

    for (
      const layout
      of targetBlobLayouts
    ) {
      await writeExactNoReplace(
        layout.path,
        layout.blob.bytes,
      );
    }
    await writeExactNoReplace(
      targetDatabasePath,
      databaseBytes,
    );

    const stagingInventory =
      await inspectSnapshot(
        targetDatabasePath,
        input.checksum,
        input.canonicalBytes,
      );
    await verifyManifestAgainstSnapshot(
      manifest,
      stagingInventory,
      input.expectedFormat,
      input.bundleLayout,
      input.canonicalBytes,
    );
    for (
      const layout
      of targetBlobLayouts
    ) {
      const restoredBytes =
        new Uint8Array(
          await readFile(
            layout.path,
          ),
        );
      if (
        restoredBytes.byteLength !==
          layout.blob
            .entry
            .byteLength ||
        await checksumBytes(
          input.checksum,
          restoredBytes,
        ) !==
          layout.blob
            .entry
            .checksumValue
      ) {
        throw new Error(
          "Staging blob verification failed",
        );
      }
    }
    await input.stageHook?.(
      "before-target-publish",
    );
    await renameNoReplace(
      input.targetStagingRoot,
      input.targetFinalRoot,
      "Restore final root",
    );
    operationRootOwned = false;
    return Object.freeze({
      manifest,
      restoredCounts:
        stagingInventory.counts,
      logicalChecksums:
        stagingInventory
          .logicalChecksums,
      publication: "published",
    }) as
      NodeSqliteRestoreBackupBundleReport;
  } catch (error) {
    if (operationRootOwned) {
      await cleanupOwnedRoot(
        input.targetStagingRoot,
        operationParent,
      );
    }
    throw error;
  }
}
