import {
  execFileSync,
} from "node:child_process";
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  cpus,
  release,
  tmpdir,
  totalmem,
} from "node:os";
import {
  performance,
} from "node:perf_hooks";
import {
  dirname,
  isAbsolute,
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

import {
  CaptureResumeCheckpointWithAnchors,
} from "../../src/application/checkpoints/capture-resume-checkpoint-with-anchors";
import {
  createEnvironmentManifest,
} from "../../src/application/measurement/environment-manifest";
import type {
  AppendRevisionInput,
  RevisionBlobProfile,
} from "../../src/application/revisions/revision-store";
import type {
  BlobAddress,
  ImmutableBlobStore,
} from "../../src/application/storage/blob-store";
import type {
  Poc3LedgerRecord,
} from "../../src/domain/poc-3-storage-ledger";
import {
  createWritingCatalog,
  entityId,
  type Anchor,
  type AnchorMatchedEvidence,
  type AnchorResolutionMethod,
  type AnchorStatus,
  type Document,
  type DocumentRevision,
  type EntityId,
  type RecordMeta,
  type ResumeCheckpoint,
  type Work,
} from "../../src/domain/writing";
import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";
import {
  createNodeSqliteBackupBundle,
  restoreNodeSqliteBackupBundle,
  type NodeSqliteBackupBlobEntry,
  type NodeSqliteBackupCanonicalBytesAdapter,
  type NodeSqliteBackupChecksumAdapter,
  type NodeSqliteBackupCounts,
  type NodeSqliteBackupManifest,
  type NodeSqliteBackupManifestCodec,
  type NodeSqliteRestorePreflightInput,
} from "../../src/platform/storage/node-sqlite-backup";
import {
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";
import {
  captureGitSourceProvenance,
} from "../evidence/git-source-provenance";

type PerformanceEnvironmentPath =
  | "EUM_STUDIO_POC_3_PERFORMANCE_PROFILE_PATH"
  | "EUM_STUDIO_POC_3_PERFORMANCE_ARTIFACT_PATH";

type PackageManifest = {
  readonly dependencies:
    Readonly<Record<string, string>>;
  readonly devDependencies:
    Readonly<Record<string, string>>;
};

type LockManifest = {
  readonly packages:
    Readonly<
      Record<
        string,
        { readonly version?: string }
      >
    >;
};

type StoragePerformanceProfile = {
  readonly schemaVersion: number;
  readonly fixtureUse: {
    readonly measurementInputOnly:
      true;
    readonly productLimit: false;
    readonly userDefault: false;
  };
  readonly measurement: {
    readonly iterationCount: number;
    readonly revisionAppendCountPerIteration:
      number;
    readonly contentLengthCodeUnits:
      number;
  };
  readonly layout: {
    readonly pathSegmentCount: number;
    readonly shardWidths:
      readonly number[];
  };
  readonly checksum: {
    readonly algorithm: string;
  };
  readonly sqlite: {
    readonly requestedSettings:
      Record<string, unknown>;
    readonly targetSchemaVersion:
      number;
    readonly backupPagesPerStep:
      number;
    readonly standaloneSnapshotJournalMode:
      string;
  };
  readonly checkpoint: {
    readonly anchorStatus:
      AnchorStatus;
    readonly resolutionMethod:
      AnchorResolutionMethod;
    readonly matchedEvidence:
      readonly AnchorMatchedEvidence[];
  };
};

type RuntimeClock = {
  instant(): string;
  revision(): number;
};

type NodeSqliteStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
};

type NodeSqliteDatabase = {
  prepare(
    sql: string,
  ): NodeSqliteStatement;
  close(): void;
};

type NodeSqliteModule = {
  readonly DatabaseSync: new (
    path: string,
    options?: {
      readonly readOnly?: boolean;
    },
  ) => NodeSqliteDatabase;
};

type FileFootprint = {
  readonly fileCount: number;
  readonly byteCount: number;
};

const TIMING_NAMES = [
  "open",
  "append",
  "checkpoint",
  "backup",
  "preverifyAndRestore",
  "materialize",
] as const;

type TimingName =
  typeof TIMING_NAMES[number];

type RawTimings = Readonly<
  Record<
    TimingName,
    readonly number[]
  >
>;

function requiredEnvironmentPath(
  name: PerformanceEnvironmentPath,
): string {
  const value = process.env[name];
  if (
    value === undefined ||
    value.length === 0
  ) {
    throw new Error(`${name} is required`);
  }
  return resolve(value);
}

function ignoredArtifactPath(
  artifactPath: string,
): boolean {
  const cwd = process.cwd();
  const repositoryPath =
    relative(cwd, artifactPath);
  if (
    repositoryPath.length === 0 ||
    repositoryPath === ".." ||
    repositoryPath.startsWith("../") ||
    repositoryPath.startsWith("..\\") ||
    isAbsolute(repositoryPath)
  ) {
    return false;
  }
  try {
    execFileSync(
      "git",
      [
        "check-ignore",
        "--quiet",
        "--",
        repositoryPath,
      ],
      {
        cwd,
        stdio: "ignore",
      },
    );
    return true;
  } catch {
    return false;
  }
}

function readRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} must be an object`,
    );
  }
  return value as
    Record<string, unknown>;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(
        `Unsupported ${label} field: ${field}`,
      );
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(
        `${label} is missing ${field}`,
      );
    }
  }
}

function readPositiveInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${label}.${field} must be a positive safe integer`,
    );
  }
  return value;
}

function readNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${label}.${field} must be a non-empty string`,
    );
  }
  return value;
}

function parseStoragePerformanceProfile(
  value: unknown,
): StoragePerformanceProfile {
  const label =
    "POC-3 storage performance profile";
  const input = readRecord(
    value,
    label,
  );
  assertExactFields(
    input,
    [
      "schemaVersion",
      "fixtureUse",
      "measurement",
      "layout",
      "checksum",
      "sqlite",
      "checkpoint",
    ],
    label,
  );
  const schemaVersion =
    readPositiveInteger(
      input,
      "schemaVersion",
      label,
    );

  const fixtureUseLabel =
    `${label}.fixtureUse`;
  const fixtureUse = readRecord(
    input.fixtureUse,
    fixtureUseLabel,
  );
  assertExactFields(
    fixtureUse,
    [
      "measurementInputOnly",
      "productLimit",
      "userDefault",
    ],
    fixtureUseLabel,
  );
  if (
    fixtureUse.measurementInputOnly !==
      true ||
    fixtureUse.productLimit !== false ||
    fixtureUse.userDefault !== false
  ) {
    throw new Error(
      `${fixtureUseLabel} must declare measurement-only input that is neither a product limit nor a user default`,
    );
  }

  const measurementLabel =
    `${label}.measurement`;
  const measurement = readRecord(
    input.measurement,
    measurementLabel,
  );
  assertExactFields(
    measurement,
    [
      "iterationCount",
      "revisionAppendCountPerIteration",
      "contentLengthCodeUnits",
    ],
    measurementLabel,
  );

  const layoutLabel =
    `${label}.layout`;
  const layout = readRecord(
    input.layout,
    layoutLabel,
  );
  assertExactFields(
    layout,
    [
      "pathSegmentCount",
      "shardWidths",
    ],
    layoutLabel,
  );
  if (
    !Array.isArray(
      layout.shardWidths,
    )
  ) {
    throw new Error(
      `${layoutLabel}.shardWidths must be an array`,
    );
  }
  const shardWidths = Object.freeze(
    layout.shardWidths.map(
      (entry, index) => {
        if (
          typeof entry !== "number" ||
          !Number.isSafeInteger(entry) ||
          entry <= 0
        ) {
          throw new Error(
            `${layoutLabel}.shardWidths[${index}] must be a positive safe integer`,
          );
        }
        return entry;
      },
    ),
  );

  const checksumLabel =
    `${label}.checksum`;
  const checksum = readRecord(
    input.checksum,
    checksumLabel,
  );
  assertExactFields(
    checksum,
    ["algorithm"],
    checksumLabel,
  );
  const checksumAlgorithm =
    readNonEmptyString(
      checksum,
      "algorithm",
      checksumLabel,
    );
  createHash(
    checksumAlgorithm,
  ).digest();

  const sqliteLabel =
    `${label}.sqlite`;
  const sqlite = readRecord(
    input.sqlite,
    sqliteLabel,
  );
  assertExactFields(
    sqlite,
    [
      "requestedSettings",
      "targetSchemaVersion",
      "backupPagesPerStep",
      "standaloneSnapshotJournalMode",
    ],
    sqliteLabel,
  );
  const requestedSettings =
    readRecord(
      sqlite.requestedSettings,
      `${sqliteLabel}.requestedSettings`,
    );

  const checkpointLabel =
    `${label}.checkpoint`;
  const checkpoint = readRecord(
    input.checkpoint,
    checkpointLabel,
  );
  assertExactFields(
    checkpoint,
    [
      "anchorStatus",
      "resolutionMethod",
      "matchedEvidence",
    ],
    checkpointLabel,
  );
  const anchorStatus =
    readNonEmptyString(
      checkpoint,
      "anchorStatus",
      checkpointLabel,
    ) as AnchorStatus;
  const resolutionMethod =
    readNonEmptyString(
      checkpoint,
      "resolutionMethod",
      checkpointLabel,
    ) as AnchorResolutionMethod;
  if (
    !Array.isArray(
      checkpoint.matchedEvidence,
    ) ||
    checkpoint.matchedEvidence.length ===
      0
  ) {
    throw new Error(
      `${checkpointLabel}.matchedEvidence must be a non-empty array`,
    );
  }
  const matchedEvidence =
    Object.freeze(
      checkpoint.matchedEvidence.map(
        (entry, index) => {
          if (
            typeof entry !== "string" ||
            entry.length === 0
          ) {
            throw new Error(
              `${checkpointLabel}.matchedEvidence[${index}] must be a non-empty string`,
            );
          }
          return entry as
            AnchorMatchedEvidence;
        },
      ),
    );

  return Object.freeze({
    schemaVersion,
    fixtureUse: Object.freeze({
      measurementInputOnly: true,
      productLimit: false,
      userDefault: false,
    }),
    measurement: Object.freeze({
      iterationCount:
        readPositiveInteger(
          measurement,
          "iterationCount",
          measurementLabel,
        ),
      revisionAppendCountPerIteration:
        readPositiveInteger(
          measurement,
          "revisionAppendCountPerIteration",
          measurementLabel,
        ),
      contentLengthCodeUnits:
        readPositiveInteger(
          measurement,
          "contentLengthCodeUnits",
          measurementLabel,
        ),
    }),
    layout: Object.freeze({
      pathSegmentCount:
        readPositiveInteger(
          layout,
          "pathSegmentCount",
          layoutLabel,
        ),
      shardWidths,
    }),
    checksum: Object.freeze({
      algorithm:
        checksumAlgorithm,
    }),
    sqlite: Object.freeze({
      requestedSettings,
      targetSchemaVersion:
        readPositiveInteger(
          sqlite,
          "targetSchemaVersion",
          sqliteLabel,
        ),
      backupPagesPerStep:
        readPositiveInteger(
          sqlite,
          "backupPagesPerStep",
          sqliteLabel,
        ),
      standaloneSnapshotJournalMode:
        readNonEmptyString(
          sqlite,
          "standaloneSnapshotJournalMode",
          sqliteLabel,
        ),
    }),
    checkpoint: Object.freeze({
      anchorStatus,
      resolutionMethod,
      matchedEvidence,
    }),
  });
}

function digestBytes(
  algorithm: string,
  bytes: Uint8Array,
): string {
  return createHash(algorithm)
    .update(bytes)
    .digest("hex");
}

function digestText(
  algorithm: string,
  value: string,
): string {
  return digestBytes(
    algorithm,
    new TextEncoder().encode(value),
  );
}

function runtimeContent(
  length: number,
): string {
  return randomBytes(
    Math.ceil(length / 2),
  )
    .toString("hex")
    .slice(0, length);
}

function runtimeSegments(
  count: number,
): readonly string[] {
  return Object.freeze(
    Array.from(
      { length: count },
      () => randomUUID(),
    ),
  );
}

function createRuntimeClock():
  RuntimeClock {
  let offset = 0;
  const startedAt = Date.now();
  return Object.freeze({
    instant: () =>
      new Date(
        startedAt + offset++,
      ).toISOString(),
    revision: () =>
      startedAt + offset++,
  });
}

function createMeta<
  TEntity extends string,
>(
  id: EntityId<TEntity>,
  schemaVersion: number,
  clock: RuntimeClock,
): RecordMeta<TEntity> {
  const createdAt = clock.instant();
  return Object.freeze({
    id,
    schemaVersion,
    revision: clock.revision(),
    createdAt,
    updatedAt: clock.instant(),
  });
}

function addressKey(
  address: BlobAddress,
): string {
  return JSON.stringify([
    address.checksumIdentity,
    address.checksumValue,
  ]);
}

function addressedSegments(
  input: {
    readonly directorySegments:
      readonly string[];
    readonly shardWidths:
      readonly number[];
    readonly fileNamePrefix:
      string;
    readonly fileNameSuffix:
      string;
    readonly address: BlobAddress;
  },
): readonly string[] {
  let offset = 0;
  const shards = input.shardWidths.map(
    (width) => {
      const shard =
        input.address.checksumValue.slice(
          offset,
          offset + width,
        );
      if (shard.length !== width) {
        throw new Error(
          "Checksum output is shorter than the caller shard layout",
        );
      }
      offset += width;
      return shard;
    },
  );
  return Object.freeze([
    ...input.directorySegments,
    ...shards,
    `${input.fileNamePrefix}${input.address.checksumValue}${input.fileNameSuffix}`,
  ]);
}

function createRuntimeBlobProfile(
  algorithm: string,
  clock: RuntimeClock,
): RevisionBlobProfile {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const codecIdentity = randomUUID();
  const temporaryIdentityByRevision =
    new Map<string, string>();
  const createdAtByRevision =
    new Map<string, string>();
  return Object.freeze({
    codec: Object.freeze({
      identity: codecIdentity,
      encode: (content: string) =>
        encoder.encode(content),
      decode: (bytes: Uint8Array) =>
        decoder.decode(bytes),
      describe: (content: string) =>
        Object.freeze({
          contentHash: digestBytes(
            algorithm,
            encoder.encode(content),
          ),
          length: content.length,
        }),
    }),
    blobRefForAddress: (address) =>
      JSON.stringify([
        codecIdentity,
        address.checksumIdentity,
        address.checksumValue,
      ]),
    addressForBlobRef: (blobRef) => {
      const decoded =
        JSON.parse(blobRef) as
          readonly unknown[];
      if (
        decoded.length !== 3 ||
        decoded[0] !== codecIdentity ||
        typeof decoded[1] !== "string" ||
        typeof decoded[2] !== "string"
      ) {
        throw new Error(
          "Revision blob reference does not match the runtime codec",
        );
      }
      return Object.freeze({
        checksumIdentity: decoded[1],
        checksumValue: decoded[2],
      });
    },
    metadataForAppend: () =>
      Object.freeze({
        [randomUUID()]: randomUUID(),
      }),
    temporaryEntryIdentityForAppend:
      (input) => {
        const existing =
          temporaryIdentityByRevision
            .get(input.revisionId);
        if (existing !== undefined) {
          return existing;
        }
        const identity = randomUUID();
        temporaryIdentityByRevision.set(
          input.revisionId,
          identity,
        );
        return identity;
      },
    manifestMetadataForAppend:
      (input) => {
        const existing =
          createdAtByRevision.get(
            input.revisionId,
          );
        if (existing !== undefined) {
          return Object.freeze({
            createdAt: existing,
          });
        }
        const createdAt = clock.instant();
        createdAtByRevision.set(
          input.revisionId,
          createdAt,
        );
        return Object.freeze({
          createdAt,
        });
      },
  });
}

async function publishSeedBlob(
  blobStore: ImmutableBlobStore,
  blobProfile: RevisionBlobProfile,
  input: AppendRevisionInput,
) {
  const receipt =
    await blobStore.append({
      bytes:
        blobProfile.codec.encode(
          input.content,
        ),
      metadata:
        blobProfile
          .metadataForAppend(input),
      temporaryEntryIdentity:
        blobProfile
          .temporaryEntryIdentityForAppend(
            input,
          ),
    });
  const metadata =
    blobProfile
      .manifestMetadataForAppend(input);
  return Object.freeze({
    receipt,
    blobRef:
      blobProfile.blobRefForAddress(
        receipt.address,
      ),
    createdAt: metadata.createdAt,
  });
}

async function createSeedGraph(
  input: {
    readonly blobStore:
      ImmutableBlobStore;
    readonly blobProfile:
      RevisionBlobProfile;
    readonly checksumIdentity:
      string;
    readonly schemaVersion:
      number;
    readonly contentLength:
      number;
    readonly clock:
      RuntimeClock;
  },
) {
  const studioId =
    entityId<"Studio">(randomUUID());
  const workId =
    entityId<"Work">(randomUUID());
  const settingsId =
    entityId<"WorkSettings">(
      randomUUID(),
    );
  const activityPolicyId =
    randomUUID();
  const focusPolicyId =
    randomUUID();
  const documentId =
    entityId<"Document">(
      randomUUID(),
    );
  const manuscriptId =
    entityId<"Manuscript">(
      randomUUID(),
    );
  const work: Work = Object.freeze({
    meta: createMeta(
      workId,
      input.schemaVersion,
      input.clock,
    ),
    studioId,
    title: randomUUID(),
    orderKey: randomUUID(),
    settingsId,
  });
  const document: Document =
    Object.freeze({
      meta: createMeta(
        documentId,
        input.schemaVersion,
        input.clock,
      ),
      workId,
      title: randomUUID(),
      orderKey: randomUUID(),
      manuscriptId,
    });
  const content =
    runtimeContent(
      input.contentLength,
    );
  const revisionInput:
    AppendRevisionInput =
    Object.freeze({
      revisionId:
        entityId<"DocumentRevision">(
          randomUUID(),
        ),
      workId,
      documentId,
      expectedCurrentRevisionId:
        null,
      content,
      cause: randomUUID(),
      createdAt:
        input.clock.instant(),
      durableAt:
        input.clock.instant(),
    });
  const published =
    await publishSeedBlob(
      input.blobStore,
      input.blobProfile,
      revisionInput,
    );
  expect(
    published.receipt.address
      .checksumIdentity,
  ).toBe(
    input.checksumIdentity,
  );
  const descriptor =
    input.blobProfile.codec.describe(
      content,
    );
  const metaRecord = (
    meta: RecordMeta<string>,
  ) => ({
    schemaVersion:
      meta.schemaVersion,
    revision: meta.revision,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  });
  const records:
    readonly Poc3LedgerRecord[] =
    Object.freeze([
      {
        kind: "studio",
        id: studioId,
        displayName: randomUUID(),
        locale: randomUUID(),
        timezone: randomUUID(),
        settingsRevision:
          input.clock.revision(),
        createdAt:
          input.clock.instant(),
      },
      {
        kind: "work",
        ...metaRecord(work.meta),
        id: work.meta.id,
        studioId: work.studioId,
        title: work.title,
        orderKey: work.orderKey,
        settingsId:
          work.settingsId,
      },
      {
        kind: "activityPolicy",
        ...metaRecord(
          createMeta(
            entityId<"ActivityPolicy">(
              activityPolicyId,
            ),
            input.schemaVersion,
            input.clock,
          ),
        ),
        id: activityPolicyId,
        workId,
        idleTimeout:
          input.clock.revision(),
        navigationGrace:
          input.clock.revision(),
        hiddenWindowPolicy:
          randomUUID(),
        activityClassRulesJson:
          JSON.stringify({
            [randomUUID()]:
              randomUUID(),
          }),
        autoStartEnabled:
          randomInt(0, 2) === 0,
        autoResumeFromIdle:
          randomInt(0, 2) === 0,
        recoveryPolicy:
          randomUUID(),
      },
      {
        kind: "focusPolicy",
        ...metaRecord(
          createMeta(
            entityId<"FocusPolicy">(
              focusPolicyId,
            ),
            input.schemaVersion,
            input.clock,
          ),
        ),
        id: focusPolicyId,
        workId,
        phaseDefinitionsJson:
          JSON.stringify({
            [randomUUID()]:
              randomUUID(),
          }),
        backgroundPolicy:
          randomUUID(),
        musicStartPolicy:
          randomUUID(),
        completionPolicy:
          randomUUID(),
        visibility: randomUUID(),
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
          JSON.stringify({
            [randomUUID()]:
              randomUUID(),
          }),
        revision:
          input.clock.revision(),
      },
      {
        kind: "blobManifest",
        blobRef: published.blobRef,
        checksumIdentity:
          published.receipt.address
            .checksumIdentity,
        checksumValue:
          published.receipt.address
            .checksumValue,
        byteLength:
          published.receipt.byteLength,
        createdAt:
          published.createdAt,
      },
      {
        kind: "document",
        ...metaRecord(
          document.meta,
        ),
        id: document.meta.id,
        workId,
        title: document.title,
        orderKey:
          document.orderKey,
        manuscriptId,
      },
      {
        kind: "documentRevision",
        id: revisionInput.revisionId,
        workId,
        documentId,
        contentRef:
          published.blobRef,
        contentHash:
          descriptor.contentHash,
        length: descriptor.length,
        cause: revisionInput.cause,
        createdAt:
          revisionInput.createdAt,
        durableAt:
          revisionInput.durableAt,
      },
      {
        kind: "manuscript",
        id: manuscriptId,
        workId,
        documentId,
        currentRevisionId:
          revisionInput.revisionId,
        durableRevisionId:
          revisionInput.revisionId,
        updatedAt:
          revisionInput.durableAt,
      },
    ]);
  const revision:
    DocumentRevision =
    Object.freeze({
      id: revisionInput.revisionId,
      documentId,
      contentRef:
        published.blobRef,
      contentHash:
        descriptor.contentHash,
      length: descriptor.length,
      cause: revisionInput.cause,
      createdAt:
        revisionInput.createdAt,
      durableAt:
        revisionInput.durableAt,
    });
  return Object.freeze({
    work,
    document,
    revision,
    revisionInput,
    content,
    records,
    address:
      published.receipt.address,
  });
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
      "The selected node:sqlite runtime is unavailable",
    );
  }
  return loaded;
}

function readCount(
  database: NodeSqliteDatabase,
  tableName: string,
): number {
  const rows =
    database.prepare(
      `SELECT COUNT(*) AS "count" FROM ${tableName}`,
    ).all();
  const value = rows[0]?.count;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `Invalid row count for ${tableName}`,
    );
  }
  return value;
}

function readBackupCounts(
  databasePath: string,
): NodeSqliteBackupCounts {
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
    return Object.freeze({
      workCount:
        readCount(
          database,
          "works",
        ),
      documentCount:
        readCount(
          database,
          "documents",
        ),
      revisionCount:
        readCount(
          database,
          "document_revisions",
        ),
      resumeCheckpointCount:
        readCount(
          database,
          "resume_checkpoints",
        ),
      writingSessionCount:
        readCount(
          database,
          "writing_sessions",
        ),
    });
  } finally {
    database.close();
  }
}

function discoverDatabaseName(
  databasePath: string,
): string {
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
    const row =
      database.prepare(
        "PRAGMA database_list",
      ).all().find(
        (entry) =>
          entry.file ===
            databasePath,
      );
    if (
      row === undefined ||
      typeof row.name !== "string" ||
      row.name.length === 0
    ) {
      throw new Error(
        "The selected database name is unavailable",
      );
    }
    return row.name;
  } finally {
    database.close();
  }
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
        .sort(([left], [right]) =>
          left.localeCompare(right),
        )
        .map(([key, entry]) => [
          key,
          canonicalValue(entry),
        ]),
    );
  }
  return value;
}

function createCanonicalBytes():
  NodeSqliteBackupCanonicalBytesAdapter {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return Object.freeze({
    encode: (value: unknown) =>
      encoder.encode(
        JSON.stringify(
          canonicalValue(value),
        ),
      ),
    decode: (bytes: Uint8Array) =>
      JSON.parse(
        decoder.decode(bytes),
      ),
  });
}

function createManifestCodec(
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
): NodeSqliteBackupManifestCodec {
  return Object.freeze({
    encodeCanonical: (
      manifest:
        NodeSqliteBackupManifest,
    ) =>
      canonicalBytes.encode(
        manifest,
      ),
    decodeCanonical: (
      bytes: Uint8Array,
    ) =>
      canonicalBytes.decode(
        bytes,
      ) as
        NodeSqliteBackupManifest,
  });
}

async function measure<T>(
  operation: () => Promise<T>,
): Promise<{
  readonly value: T;
  readonly durationMs: number;
}> {
  const startedAt =
    performance.now();
  const value = await operation();
  const durationMs =
    performance.now() - startedAt;
  expect(
    Number.isFinite(durationMs),
  ).toBe(true);
  expect(durationMs).toBeGreaterThanOrEqual(
    0,
  );
  return Object.freeze({
    value,
    durationMs,
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
      (error as NodeJS.ErrnoException)
        .code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

async function treeFootprint(
  root: string,
): Promise<FileFootprint> {
  let fileCount = 0;
  let byteCount = 0;
  const visit = async (
    directory: string,
  ): Promise<void> => {
    const entries =
      await readdir(
        directory,
        {
          withFileTypes: true,
        },
      );
    for (const entry of entries) {
      const child =
        join(
          directory,
          entry.name,
        );
      if (entry.isDirectory()) {
        await visit(child);
      } else if (entry.isFile()) {
        const information =
          await stat(child);
        fileCount += 1;
        byteCount +=
          information.size;
      } else {
        throw new Error(
          "Unexpected non-file backup entry",
        );
      }
    }
  };
  await visit(root);
  return Object.freeze({
    fileCount,
    byteCount,
  });
}

async function databaseFootprint(
  databasePath: string,
): Promise<FileFootprint> {
  const candidates = [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
    `${databasePath}-journal`,
  ];
  let fileCount = 0;
  let byteCount = 0;
  for (const candidate of candidates) {
    try {
      const information =
        await stat(candidate);
      if (!information.isFile()) {
        throw new Error(
          "SQLite footprint entry is not a file",
        );
      }
      fileCount += 1;
      byteCount += information.size;
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException)
          .code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }
  return Object.freeze({
    fileCount,
    byteCount,
  });
}

function inventoryFootprint(
  entries:
    readonly {
      readonly byteLength: number;
    }[],
): FileFootprint {
  return Object.freeze({
    fileCount: entries.length,
    byteCount: entries.reduce(
      (sum, entry) =>
        sum + entry.byteLength,
      0,
    ),
  });
}

async function verifyBundleBlobChecksums(
  input: {
    readonly root: string;
    readonly entries:
      readonly NodeSqliteBackupBlobEntry[];
    readonly checksum:
      NodeSqliteBackupChecksumAdapter;
    entrySegments(
      entry:
        NodeSqliteBackupBlobEntry,
    ): readonly string[];
  },
): Promise<readonly string[]> {
  const values: string[] = [];
  for (const entry of input.entries) {
    const bytes =
      await readFile(
        join(
          input.root,
          ...input.entrySegments(
            entry,
          ),
        ),
      );
    const actual =
      await input.checksum.checksum(
        bytes,
      );
    expect(actual).toBe(
      entry.checksumValue,
    );
    values.push(actual);
  }
  return Object.freeze(
    values.sort(),
  );
}

async function removeTemporaryRoot(
  root: string,
): Promise<void> {
  const temporaryDirectory =
    resolve(tmpdir());
  const target = resolve(root);
  if (
    target === temporaryDirectory ||
    !target.startsWith(
      `${temporaryDirectory}${sep}`,
    )
  ) {
    throw new Error(
      "Refusing to remove a measurement root outside the OS temporary directory",
    );
  }
  await rm(
    target,
    {
      recursive: true,
      force: true,
    },
  );
}

function assertNoAbsoluteStrings(
  value: unknown,
): void {
  if (typeof value === "string") {
    expect(
      isAbsolute(value),
    ).toBe(false);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNoAbsoluteStrings(entry);
    }
    return;
  }
  if (
    typeof value === "object" &&
    value !== null
  ) {
    for (
      const entry
      of Object.values(value)
    ) {
      assertNoAbsoluteStrings(entry);
    }
  }
}

async function runStorageIteration(
  input: {
    readonly profile:
      StoragePerformanceProfile;
  },
) {
  const root = await mkdtemp(
    join(
      tmpdir(),
      `${randomUUID()}-`,
    ),
  );
  let sourceLedger:
    Awaited<
      ReturnType<
        typeof openNodeSqliteLedger
      >
    > | undefined;
  let restoredLedger:
    Awaited<
      ReturnType<
        typeof openNodeSqliteLedger
      >
    > | undefined;
  try {
    const clock =
      createRuntimeClock();
    const algorithm =
      input.profile.checksum
        .algorithm;
    const checksumIdentity =
      randomUUID();
    const sourceDatabasePath =
      join(root, randomUUID());
    const sourceBlobRoot =
      join(root, randomUUID());
    const sourcePublishedSegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const sourceTemporarySegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const sourceFilePrefix =
      randomUUID();
    const sourceFileSuffix =
      randomUUID();
    const sourceBlobStore =
      await createNodeImmutableBlobStore(
        parseNodeImmutableBlobStoreProfile(
          {
            rootDirectoryPath:
              sourceBlobRoot,
            checksum: {
              identity:
                checksumIdentity,
              algorithm,
            },
            publishedLayout: {
              directorySegments:
                sourcePublishedSegments,
              shardWidths:
                input.profile.layout
                  .shardWidths,
              fileNamePrefix:
                sourceFilePrefix,
              fileNameSuffix:
                sourceFileSuffix,
            },
            temporaryLayout: {
              directorySegments:
                sourceTemporarySegments,
            },
          },
        ),
      );
    const blobProfile =
      createRuntimeBlobProfile(
        algorithm,
        clock,
      );
    const seed =
      await createSeedGraph({
        blobStore:
          sourceBlobStore,
        blobProfile,
        checksumIdentity,
        schemaVersion:
          input.profile.sqlite
            .targetSchemaVersion,
        contentLength:
          input.profile
            .measurement
            .contentLengthCodeUnits,
        clock,
      });
    const sourceOpen =
      await measure(() =>
        openNodeSqliteLedger(
          parsePoc3StorageOpenProfile(
            {
              databasePath:
                sourceDatabasePath,
              checksumIdentity,
              requestedSettings:
                input.profile.sqlite
                  .requestedSettings,
              targetSchemaVersion:
                input.profile.sqlite
                  .targetSchemaVersion,
            },
          ),
        ),
      );
    sourceLedger = sourceOpen.value;
    await sourceLedger.transaction(
      async (transaction) => {
        for (
          const record
          of seed.records
        ) {
          transaction.write(record);
        }
      },
    );
    const countsAfterSeed =
      readBackupCounts(
        sourceDatabasePath,
      );
    const revisionStore =
      sourceLedger
        .createRevisionStore({
          blobStore:
            sourceBlobStore,
          blobProfile,
        });
    const reachableAddresses =
      new Set([
        addressKey(seed.address),
      ]);
    let finalRevision =
      seed.revision;
    let finalContent =
      seed.content;
    const appendDurationsMs:
      number[] = [];
    const generatedContent = [
      seed.content,
    ];
    for (
      let ordinal = 0;
      ordinal <
      input.profile.measurement
        .revisionAppendCountPerIteration;
      ordinal += 1
    ) {
      finalContent =
        runtimeContent(
          input.profile
            .measurement
            .contentLengthCodeUnits,
        );
      generatedContent.push(
        finalContent,
      );
      const appendInput:
        AppendRevisionInput =
        Object.freeze({
          revisionId:
            entityId<"DocumentRevision">(
              randomUUID(),
            ),
          workId:
            seed.work.meta.id,
          documentId:
            seed.document.meta.id,
          expectedCurrentRevisionId:
            finalRevision.id,
          content: finalContent,
          cause: randomUUID(),
          createdAt:
            clock.instant(),
          durableAt:
            clock.instant(),
        });
      const appended =
        await measure(() =>
          revisionStore.append(
            appendInput,
          ),
        );
      appendDurationsMs.push(
        appended.durationMs,
      );
      finalRevision =
        appended.value;
      expect(
        finalRevision.length,
      ).toBe(finalContent.length);
      reachableAddresses.add(
        addressKey(
          blobProfile
            .addressForBlobRef(
              finalRevision
                .contentRef,
            ),
        ),
      );
    }
    const countsAfterAppend =
      readBackupCounts(
        sourceDatabasePath,
      );
    expect(
      countsAfterAppend
        .revisionCount,
    ).toBe(
      countsAfterSeed.revisionCount +
        input.profile.measurement
          .revisionAppendCountPerIteration,
    );

    const cursorOffset =
      randomInt(
        0,
        finalContent.length + 1,
      );
    const cursorAnchor:
      Anchor =
      Object.freeze({
        meta: createMeta(
          entityId<"Anchor">(
            randomUUID(),
          ),
          input.profile.sqlite
            .targetSchemaVersion,
          clock,
        ),
        documentId:
          seed.document.meta.id,
        originRevisionId:
          finalRevision.id,
        resolvedRevisionId:
          finalRevision.id,
        startOffset:
          cursorOffset,
        endOffset:
          cursorOffset,
        exactQuote: "",
        prefixContext: "",
        suffixContext: "",
        quoteHash:
          digestText(
            algorithm,
            "",
          ),
        contextHash:
          digestText(
            algorithm,
            "",
          ),
        status:
          input.profile
            .checkpoint
            .anchorStatus,
        resolutionEvidence:
          Object.freeze({
            targetRevisionId:
              finalRevision.id,
            method:
              input.profile
                .checkpoint
                .resolutionMethod,
            matchedEvidence:
              Object.freeze([
                ...input.profile
                  .checkpoint
                  .matchedEvidence,
              ]),
            candidateOffsets:
              Object.freeze([
                cursorOffset,
              ]),
            policyVersion:
              randomUUID(),
            assessedAt:
              clock.instant(),
          }),
      });
    const capturedAt =
      clock.instant();
    const checkpoint:
      ResumeCheckpoint =
      Object.freeze({
        meta: createMeta(
          entityId<"ResumeCheckpoint">(
            randomUUID(),
          ),
          input.profile.sqlite
            .targetSchemaVersion,
          clock,
        ),
        workId:
          seed.work.meta.id,
        documentId:
          seed.document.meta.id,
        documentRevisionId:
          finalRevision.id,
        cursorAnchorId:
          cursorAnchor.meta.id,
        workspaceMode:
          randomUUID(),
        capturedAt,
      });
    const checkpointTransaction =
      sourceLedger
        .createResumeCheckpointCaptureTransaction(
          {},
        );
    const checkpointCommand =
      new CaptureResumeCheckpointWithAnchors(
        {
          catalog:
            createWritingCatalog({
              works: [seed.work],
              documents: [
                seed.document,
              ],
            }),
          revisionStore,
          transaction:
            checkpointTransaction,
        },
      );
    const checkpointMeasurement =
      await measure(() =>
        checkpointCommand.execute({
          checkpoint,
          cursorAnchor,
          expectedWorkRevision:
            seed.work.meta
              .revision,
          expectedResumeCheckpointId:
            null,
          expectedDocumentRevisionId:
            finalRevision.id,
        }),
      );
    expect(
      checkpointMeasurement.value
        .checkpoint,
    ).toEqual(checkpoint);
    expect(
      await checkpointTransaction
        .getCheckpointById(
          checkpoint.meta.id,
        ),
    ).toEqual(checkpoint);
    expect(
      await checkpointTransaction
        .getAnchorById(
          cursorAnchor.meta.id,
        ),
    ).toEqual(cursorAnchor);
    const sourceCounts =
      readBackupCounts(
        sourceDatabasePath,
      );
    expect(
      sourceCounts
        .resumeCheckpointCount,
    ).toBe(
      countsAfterSeed
        .resumeCheckpointCount + 1,
    );

    const inventory =
      await sourceBlobStore
        .inventory({
          isReachable: async (
            address,
          ) =>
            reachableAddresses.has(
              addressKey(address),
            ),
        });
    expect(
      inventory.published.every(
        (entry) =>
          entry.status ===
            "verified",
      ),
    ).toBe(true);
    const reachableBlobs =
      inventory.published.filter(
        (entry) =>
          entry.reachable,
      );
    const orphanBlobs =
      inventory.published.filter(
        (entry) =>
          !entry.reachable,
      );
    expect(orphanBlobs).toEqual([]);
    expect(
      inventory.temporary,
    ).toEqual([]);

    const bundleParent =
      join(root, randomUUID());
    const targetParent =
      join(root, randomUUID());
    await mkdir(bundleParent);
    await mkdir(targetParent);
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
    const targetStagingRoot =
      join(
        targetParent,
        randomUUID(),
      );
    const targetFinalRoot =
      join(
        targetParent,
        randomUUID(),
      );
    expect(
      await pathExists(
        targetFinalRoot,
      ),
    ).toBe(false);

    const bundleDatabaseSegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const bundleManifestSegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const bundleManifestChecksumSegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const bundleBlobDirectorySegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const bundleBlobPrefix =
      randomUUID();
    const bundleBlobSuffix =
      randomUUID();
    const targetDatabaseSegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const targetPublishedSegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const targetTemporarySegments =
      runtimeSegments(
        input.profile.layout
          .pathSegmentCount,
      );
    const targetBlobPrefix =
      randomUUID();
    const targetBlobSuffix =
      randomUUID();
    const bundleLayout =
      Object.freeze({
        databaseEntrySegments:
          bundleDatabaseSegments,
        manifestEntrySegments:
          bundleManifestSegments,
        manifestChecksumEntrySegments:
          bundleManifestChecksumSegments,
        blobEntrySegments: (
          address: BlobAddress,
        ) =>
          addressedSegments({
            directorySegments:
              bundleBlobDirectorySegments,
            shardWidths:
              input.profile.layout
                .shardWidths,
            fileNamePrefix:
              bundleBlobPrefix,
            fileNameSuffix:
              bundleBlobSuffix,
            address,
          }),
      });
    const targetLayout =
      Object.freeze({
        databaseEntrySegments:
          targetDatabaseSegments,
        blobEntrySegments: (
          address: BlobAddress,
        ) =>
          addressedSegments({
            directorySegments:
              targetPublishedSegments,
            shardWidths:
              input.profile.layout
                .shardWidths,
            fileNamePrefix:
              targetBlobPrefix,
            fileNameSuffix:
              targetBlobSuffix,
            address,
          }),
      });
    const canonicalBytes =
      createCanonicalBytes();
    const manifestCodec =
      createManifestCodec(
        canonicalBytes,
      );
    const checksum:
      NodeSqliteBackupChecksumAdapter =
      Object.freeze({
        identity:
          checksumIdentity,
        checksum: (bytes) =>
          digestBytes(
            algorithm,
            bytes,
          ),
      });
    const format =
      Object.freeze({
        identity: randomUUID(),
        version: randomUUID(),
      });
    const databaseName =
      discoverDatabaseName(
        sourceDatabasePath,
      );
    const backupMeasurement =
      await measure(() =>
        createNodeSqliteBackupBundle({
          sourceDatabasePath,
          sourceBlobStore,
          temporaryBundleRoot,
          finalBundleRoot,
          layout: bundleLayout,
          format,
          sqlite: {
            sourceDatabaseName:
              databaseName,
            targetDatabaseName:
              databaseName,
            pagesPerStep:
              input.profile.sqlite
                .backupPagesPerStep,
            standaloneSnapshotJournalMode:
              input.profile.sqlite
                .standaloneSnapshotJournalMode,
          },
          manifestCodec,
          canonicalBytes,
          checksum,
          clock: {
            now: () =>
              clock.instant(),
          },
        }),
      );
    const backupReport =
      backupMeasurement.value;
    expect(
      backupReport
        .manifest.counts,
    ).toEqual(sourceCounts);
    expect(
      backupReport
        .manifest.blobs,
    ).toHaveLength(
      reachableBlobs.length,
    );
    expect(
      await pathExists(
        temporaryBundleRoot,
      ),
    ).toBe(false);
    expect(
      await pathExists(
        finalBundleRoot,
      ),
    ).toBe(true);

    const bundleDatabasePath =
      join(
        finalBundleRoot,
        ...bundleDatabaseSegments,
      );
    const bundleDatabaseChecksum =
      digestBytes(
        algorithm,
        await readFile(
          bundleDatabasePath,
        ),
      );
    expect(
      bundleDatabaseChecksum,
    ).toBe(
      backupReport.manifest
        .database.checksumValue,
    );
    const bundleBlobChecksums =
      await verifyBundleBlobChecksums(
        {
          root: finalBundleRoot,
          entries:
            backupReport
              .manifest.blobs,
          checksum,
          entrySegments: (
            entry,
          ) =>
            entry
              .bundleRelativeSegments,
        },
      );
    const expectedBlobChecksums =
      Object.freeze(
        backupReport.manifest.blobs
          .map(
            (entry) =>
              entry.checksumValue,
          )
          .sort(),
      );
    expect(
      bundleBlobChecksums,
    ).toEqual(
      expectedBlobChecksums,
    );
    const finalBundleFootprint =
      await treeFootprint(
        finalBundleRoot,
      );
    const preflightByteCounts:
      number[] = [];
    const restoreMeasurement =
      await measure(() =>
        restoreNodeSqliteBackupBundle({
          finalBundleRoot,
          bundleLayout,
          targetStagingRoot,
          targetFinalRoot,
          targetLayout,
          expectedFormat: format,
          manifestCodec,
          canonicalBytes,
          checksum,
          preflight: {
            preflight: async (
              preflight:
                NodeSqliteRestorePreflightInput,
            ) => {
              if (
                !Number.isSafeInteger(
                  preflight
                    .requiredByteCount,
                ) ||
                preflight
                  .requiredByteCount <= 0
              ) {
                throw new Error(
                  "Restore preflight byte count must be a positive safe integer",
                );
              }
              preflightByteCounts.push(
                preflight
                  .requiredByteCount,
              );
            },
          },
        }),
      );
    const restoreReport =
      restoreMeasurement.value;
    expect(
      preflightByteCounts,
    ).toHaveLength(1);
    expect(
      restoreReport
        .restoredCounts,
    ).toEqual(sourceCounts);
    expect(
      restoreReport
        .logicalChecksums,
    ).toEqual(
      backupReport.manifest
        .logicalChecksums,
    );
    expect(
      await pathExists(
        targetStagingRoot,
      ),
    ).toBe(false);
    expect(
      await pathExists(
        targetFinalRoot,
      ),
    ).toBe(true);
    const restoredTargetFootprint =
      await treeFootprint(
        targetFinalRoot,
      );
    const restoredDatabasePath =
      join(
        targetFinalRoot,
        ...targetDatabaseSegments,
      );
    const restoredDatabaseChecksum =
      digestBytes(
        algorithm,
        await readFile(
          restoredDatabasePath,
        ),
      );
    expect(
      restoredDatabaseChecksum,
    ).toBe(
      backupReport.manifest
        .database.checksumValue,
    );
    const restoredBlobChecksums =
      await verifyBundleBlobChecksums(
        {
          root: targetFinalRoot,
          entries:
            backupReport.manifest
              .blobs,
          checksum,
          entrySegments: (
            entry,
          ) =>
            targetLayout
              .blobEntrySegments(
                entry.sourceAddress,
              ),
        },
      );
    expect(
      restoredBlobChecksums,
    ).toEqual(
      expectedBlobChecksums,
    );
    const restoredCounts =
      readBackupCounts(
        restoredDatabasePath,
      );
    expect(restoredCounts).toEqual(
      sourceCounts,
    );

    const sourceDatabaseSize =
      await databaseFootprint(
        sourceDatabasePath,
      );
    const restoredBlobStore =
      await createNodeImmutableBlobStore(
        parseNodeImmutableBlobStoreProfile(
          {
            rootDirectoryPath:
              targetFinalRoot,
            checksum: {
              identity:
                checksumIdentity,
              algorithm,
            },
            publishedLayout: {
              directorySegments:
                targetPublishedSegments,
              shardWidths:
                input.profile.layout
                  .shardWidths,
              fileNamePrefix:
                targetBlobPrefix,
              fileNameSuffix:
                targetBlobSuffix,
            },
            temporaryLayout: {
              directorySegments:
                targetTemporarySegments,
            },
          },
        ),
      );
    const restoredOpen =
      await measure(() =>
        openNodeSqliteLedger(
          parsePoc3StorageOpenProfile(
            {
              databasePath:
                restoredDatabasePath,
              checksumIdentity,
              requestedSettings:
                input.profile.sqlite
                  .requestedSettings,
              targetSchemaVersion:
                input.profile.sqlite
                  .targetSchemaVersion,
            },
          ),
        ),
      );
    restoredLedger =
      restoredOpen.value;
    const restoredRevisionStore =
      restoredLedger
        .createRevisionStore({
          blobStore:
            restoredBlobStore,
          blobProfile,
        });
    const sourceMaterialization =
      await measure(() =>
        revisionStore.materialize(
          finalRevision.id,
        ),
      );
    const restoredMaterialization =
      await measure(() =>
        restoredRevisionStore
          .materialize(
            finalRevision.id,
          ),
      );
    expect(
      sourceMaterialization.value,
    ).toBe(finalContent);
    expect(
      restoredMaterialization.value,
    ).toBe(finalContent);
    const expectedMaterializedChecksum =
      digestText(
        algorithm,
        finalContent,
      );
    const sourceMaterializedChecksum =
      digestText(
        algorithm,
        sourceMaterialization.value,
      );
    const restoredMaterializedChecksum =
      digestText(
        algorithm,
        restoredMaterialization
          .value,
      );
    expect(
      sourceMaterializedChecksum,
    ).toBe(
      expectedMaterializedChecksum,
    );
    expect(
      restoredMaterializedChecksum,
    ).toBe(
      expectedMaterializedChecksum,
    );
    const restoredTransaction =
      restoredLedger
        .createResumeCheckpointCaptureTransaction(
          {},
        );
    expect(
      await restoredTransaction
        .getCheckpointById(
          checkpoint.meta.id,
        ),
    ).toEqual(checkpoint);

    const rawTimingsMs:
      RawTimings =
      Object.freeze({
        open: Object.freeze([
          sourceOpen.durationMs,
          restoredOpen.durationMs,
        ]),
        append: Object.freeze([
          ...appendDurationsMs,
        ]),
        checkpoint:
          Object.freeze([
            checkpointMeasurement
              .durationMs,
          ]),
        backup: Object.freeze([
          backupMeasurement
            .durationMs,
        ]),
        preverifyAndRestore:
          Object.freeze([
            restoreMeasurement
              .durationMs,
          ]),
        materialize:
          Object.freeze([
            sourceMaterialization
              .durationMs,
            restoredMaterialization
              .durationMs,
          ]),
      });
    expect(
      rawTimingsMs.append,
    ).toHaveLength(
      input.profile.measurement
        .revisionAppendCountPerIteration,
    );
    for (
      const timingName
      of TIMING_NAMES
    ) {
      expect(
        rawTimingsMs[
          timingName
        ].every(
          (sample) =>
            Number.isFinite(sample) &&
            sample >= 0,
        ),
      ).toBe(true);
    }

    const iteration = Object.freeze({
      iterationId: randomUUID(),
      rawTimingsMs,
      sizes: Object.freeze({
        database:
          sourceDatabaseSize,
        reachableBlobs:
          inventoryFootprint(
            reachableBlobs,
          ),
        temporaryBlobs:
          inventoryFootprint(
            inventory.temporary,
          ),
        orphanBlobs:
          inventoryFootprint(
            orphanBlobs,
          ),
        finalBundle:
          finalBundleFootprint,
        restoredTarget:
          restoredTargetFootprint,
      }),
      correctness: Object.freeze({
        counts: Object.freeze({
          exact: true,
          source: sourceCounts,
          backup:
            backupReport.manifest
              .counts,
          restored:
            restoreReport
              .restoredCounts,
        }),
        logicalChecksum:
          Object.freeze({
            exact: true,
            backup:
              backupReport.manifest
                .logicalChecksums,
            restored:
              restoreReport
                .logicalChecksums,
          }),
        databaseChecksum:
          Object.freeze({
            exact: true,
            checksumIdentity:
              checksum.identity,
            expected:
              backupReport.manifest
                .database
                .checksumValue,
            bundle:
              bundleDatabaseChecksum,
            restored:
              restoredDatabaseChecksum,
          }),
        blobChecksum:
          Object.freeze({
            exact: true,
            checksumIdentity:
              checksum.identity,
            expected:
              expectedBlobChecksums,
            bundle:
              bundleBlobChecksums,
            restored:
              restoredBlobChecksums,
          }),
        materializedChecksum:
          Object.freeze({
            exact: true,
            checksumIdentity:
              checksum.identity,
            expected:
              expectedMaterializedChecksum,
            source:
              sourceMaterializedChecksum,
            restored:
              restoredMaterializedChecksum,
          }),
      }),
    });
    const serialized =
      JSON.stringify(iteration);
    expect(serialized).not.toContain(
      root,
    );
    for (
      const content
      of generatedContent
    ) {
      expect(serialized).not.toContain(
        content,
      );
    }
    assertNoAbsoluteStrings(iteration);
    return iteration;
  } finally {
    restoredLedger?.close();
    sourceLedger?.close();
    await removeTemporaryRoot(root);
  }
}

function nearestRank(
  samples: readonly number[],
  percentile: number,
): number {
  if (samples.length === 0) {
    throw new Error(
      "Descriptive timing summary requires raw samples",
    );
  }
  const sorted = [...samples].sort(
    (left, right) =>
      left - right,
  );
  const index = Math.max(
    0,
    Math.ceil(
      sorted.length * percentile,
    ) - 1,
  );
  return sorted[index]!;
}

function createTimingSummary(
  iterations:
    readonly {
      readonly rawTimingsMs:
        RawTimings;
    }[],
) {
  return Object.fromEntries(
    TIMING_NAMES.map(
      (timingName) => {
        const samples =
          iterations.flatMap(
            (iteration) =>
              iteration.rawTimingsMs[
                timingName
              ],
          );
        return [
          timingName,
          Object.freeze({
            sampleCount:
              samples.length,
            p50Ms:
              nearestRank(
                samples,
                0.5,
              ),
            p95Ms:
              nearestRank(
                samples,
                0.95,
              ),
          }),
        ];
      },
    ),
  ) as Readonly<
    Record<
      TimingName,
      {
        readonly sampleCount:
          number;
        readonly p50Ms: number;
        readonly p95Ms: number;
      }
    >
  >;
}

function createEnvironment(
  packageRaw: string,
  lockRaw: string,
) {
  const packageManifest =
    JSON.parse(
      packageRaw,
    ) as PackageManifest;
  const lockManifest =
    JSON.parse(
      lockRaw,
    ) as LockManifest;
  const packageNames = [
    ...new Set([
      ...Object.keys(
        packageManifest
          .dependencies,
      ),
      ...Object.keys(
        packageManifest
          .devDependencies,
      ),
    ]),
  ];
  const packages = packageNames.map(
    (name) => {
      const version =
        lockManifest.packages[
          `node_modules/${name}`
        ]?.version;
      if (
        version === undefined ||
        version.length === 0
      ) {
        throw new Error(
          `Missing installed package version: ${name}`,
        );
      }
      return Object.freeze({
        name,
        version,
      });
    },
  );
  const processors = cpus();
  return createEnvironmentManifest({
    capturedAt:
      new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    osRelease: release(),
    nodeVersion: process.version,
    cpuModel: [
      ...new Set(
        processors.map(
          (processor) =>
            processor.model,
        ),
      ),
    ].join(" | "),
    logicalProcessorCount:
      processors.length,
    totalMemoryBytes: totalmem(),
    packages,
  });
}

describe.sequential(
  "POC-3 storage performance evidence contract",
  () => {
    it("records raw node:sqlite, immutable blob, revision, checkpoint, backup, empty restore, materialization, and size evidence without timing or size pass thresholds", async () => {
      const profilePath =
        requiredEnvironmentPath(
          "EUM_STUDIO_POC_3_PERFORMANCE_PROFILE_PATH",
        );
      const artifactPath =
        requiredEnvironmentPath(
          "EUM_STUDIO_POC_3_PERFORMANCE_ARTIFACT_PATH",
        );

      expect(
        ignoredArtifactPath(
          artifactPath,
        ),
      ).toBe(true);
      const profileRaw =
        await readFile(
          profilePath,
          "utf8",
        );
      const profile =
        parseStoragePerformanceProfile(
          JSON.parse(profileRaw),
        );
      const iterations:
        Awaited<
          ReturnType<
            typeof runStorageIteration
          >
        >[] = [];
      for (
        let ordinal = 0;
        ordinal <
        profile.measurement
          .iterationCount;
        ordinal += 1
      ) {
        iterations.push(
          await runStorageIteration({
            profile,
          }),
        );
      }
      const sourceProvenance =
        await captureGitSourceProvenance({
          cwd: process.cwd(),
          checksumAlgorithm:
            profile.checksum
              .algorithm,
        });
      const packageRaw =
        await readFile(
          resolve("package.json"),
          "utf8",
        );
      const lockRaw =
        await readFile(
          resolve(
            "package-lock.json",
          ),
          "utf8",
        );
      const sqliteVersion =
        Reflect.get(
          process.versions,
          "sqlite",
        );
      if (
        typeof sqliteVersion !==
          "string" ||
        sqliteVersion.length === 0
      ) {
        throw new Error(
          "The selected node:sqlite version is unavailable",
        );
      }
      const report = Object.freeze({
        schemaVersion:
          profile.schemaVersion,
        runId: randomUUID(),
        capturedAt:
          new Date().toISOString(),
        result:
          "correctness-pass",
        storageRuntime:
          Object.freeze({
            sqliteDriver:
              "node:sqlite",
            sqliteVersion,
          }),
        environment:
          Object.freeze({
            ...createEnvironment(
              packageRaw,
              lockRaw,
            ),
            runtimeVersions:
              Object.freeze(
                Object.fromEntries(
                  Object.entries(
                    process.versions,
                  ).sort(
                    ([left], [right]) =>
                      left.localeCompare(
                        right,
                      ),
                  ),
                ),
              ),
          }),
        sourceProvenance:
          Object.freeze({
            commit:
              sourceProvenance.commit,
            branch:
              sourceProvenance.branch,
            state:
              sourceProvenance.dirty
                ? "dirty"
                : "clean",
            dirty:
              sourceProvenance.dirty,
            dirtyStatusChecksum:
              sourceProvenance
                .dirtyStatusChecksum,
            trackedDiffChecksum:
              sourceProvenance
                .trackedDiffChecksum,
            untrackedFileCount:
              sourceProvenance
                .untrackedFileCount,
            untrackedContentChecksum:
              sourceProvenance
                .untrackedContentChecksum,
            sourceFingerprint:
              sourceProvenance
                .sourceFingerprint,
          }),
        profileSource:
          Object.freeze({
            kind: "caller-file",
            checksumIdentity:
              profile.checksum
                .algorithm,
            checksumValue:
              digestText(
                profile.checksum
                  .algorithm,
                profileRaw,
              ),
            byteLength:
              Buffer.byteLength(
                profileRaw,
                "utf8",
              ),
          }),
        measurementProfile:
          Object.freeze({
            fixtureUse:
              profile.fixtureUse,
            measurement:
              profile.measurement,
          }),
        iterations:
          Object.freeze([
            ...iterations,
          ]),
        timingSummary:
          createTimingSummary(
            iterations,
          ),
      });
      expect(iterations).toHaveLength(
        profile.measurement
          .iterationCount,
      );
      expect(
        iterations.every(
          (iteration) =>
            Object.values(
              iteration.correctness,
            ).every(
              (proof) =>
                proof.exact,
            ),
        ),
      ).toBe(true);
      assertNoAbsoluteStrings(report);
      const serialized =
        `${JSON.stringify(
          report,
          null,
          2,
        )}\n`;
      expect(serialized).not.toContain(
        profilePath,
      );
      expect(serialized).not.toContain(
        artifactPath,
      );
      await mkdir(
        dirname(artifactPath),
        {
          recursive: true,
        },
      );
      await writeFile(
        artifactPath,
        serialized,
        "utf8",
      );
      expect(
        JSON.parse(
          await readFile(
            artifactPath,
            "utf8",
          ),
        ),
      ).toEqual(report);
      process.stdout.write(
        `\nPOC-3 storage performance report: ${relative(
          process.cwd(),
          artifactPath,
        ).replaceAll("\\", "/")}\n`,
      );
    });
  },
);
