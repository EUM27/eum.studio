import {
  createHash,
  getHashes,
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  join,
} from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  AppendRevisionInput,
  RevisionBlobProfile,
} from "../../src/application/revisions/revision-store";
import type {
  BlobAddress,
  ImmutableBlobStore,
} from "../../src/application/storage/blob-store";
import {
  BlobContentMismatchError,
  BlobNotFoundError,
} from "../../src/application/storage/blob-store";
import type {
  Poc3LedgerRecord,
} from "../../src/domain/poc-3-storage-ledger";
import {
  entityId,
} from "../../src/domain/writing";
import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";
import {
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";

type RevisionStoreFixtureManifest = {
  readonly counts: {
    readonly concurrentConnectionCount:
      number;
    readonly contentPartCount: number;
    readonly publishedShardCount:
      number;
    readonly publishedShardWidth:
      number;
  };
};

type RuntimeClock = {
  instant(): string;
  revision(): number;
};

type RuntimeIdentities = {
  readonly studioId: string;
  readonly workId: string;
  readonly settingsId: string;
  readonly activityPolicyId:
    string;
  readonly focusPolicyId: string;
  readonly documentId: string;
  readonly manuscriptId: string;
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

function runtimeJson(): string {
  return JSON.stringify({
    [randomUUID()]: randomUUID(),
  });
}

function runtimeText(
  partCount: number,
): string {
  return Array.from(
    { length: partCount },
    () => randomUUID(),
  ).join(randomUUID());
}

function selectRuntimeHash(
  minimumHexLength: number,
): string {
  for (const candidate of getHashes()) {
    try {
      const output =
        createHash(candidate)
          .update(randomUUID())
          .digest("hex");
      if (
        output.length >=
          minimumHexLength
      ) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  throw new Error(
    "Current runtime exposes no usable content hash",
  );
}

function createRuntimeIdentities():
  RuntimeIdentities {
  return Object.freeze({
    studioId: randomUUID(),
    workId: randomUUID(),
    settingsId: randomUUID(),
    activityPolicyId: randomUUID(),
    focusPolicyId: randomUUID(),
    documentId: randomUUID(),
    manuscriptId: randomUUID(),
  });
}

function createRuntimeBlobProfile(
  contentHashAlgorithm: string,
  clock: RuntimeClock,
): RevisionBlobProfile {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const codecIdentity = randomUUID();
  const metadataKey = randomUUID();
  const metadataValue = randomUUID();
  const mediaType = randomUUID();
  const originalName = randomUUID();
  const temporaryIdentityByRevision =
    new Map<string, string>();
  const manifestCreatedAtByContent =
    new Map<string, string>();

  return Object.freeze({
    codec: Object.freeze({
      identity: codecIdentity,
      encode: (content: string) =>
        encoder.encode(content),
      decode: (bytes: Uint8Array) =>
        decoder.decode(bytes),
      describe: (content: string) => {
        const bytes =
          encoder.encode(content);
        return Object.freeze({
          contentHash:
            createHash(
              contentHashAlgorithm,
            )
              .update(bytes)
              .digest("hex"),
          length:
            bytes.byteLength +
            codecIdentity.length,
        });
      },
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
        decoded[0] !==
          codecIdentity ||
        typeof decoded[1] !==
          "string" ||
        typeof decoded[2] !==
          "string"
      ) {
        throw new Error(
          "Caller blob reference is invalid",
        );
      }
      return Object.freeze({
        checksumIdentity:
          decoded[1],
        checksumValue: decoded[2],
      });
    },
    metadataForAppend: () =>
      Object.freeze({
        [metadataKey]: metadataValue,
      }),
    temporaryEntryIdentityForAppend:
      (input) => {
        const existing =
          temporaryIdentityByRevision
            .get(input.revisionId);
        if (existing !== undefined) {
          return existing;
        }
        const created =
          randomUUID();
        temporaryIdentityByRevision.set(
          input.revisionId,
          created,
        );
        return created;
      },
    manifestMetadataForAppend:
      (input) => {
        let createdAt =
          manifestCreatedAtByContent
            .get(input.content);
        if (createdAt === undefined) {
          createdAt =
            clock.instant();
          manifestCreatedAtByContent.set(
            input.content,
            createdAt,
          );
        }
        return Object.freeze({
          createdAt,
          mediaType,
          originalName,
        });
      },
  });
}

function createRuntimeAppendInput(
  identities: RuntimeIdentities,
  expectedCurrentRevisionId:
    ReturnType<
      typeof entityId<"DocumentRevision">
    > | null,
  content: string,
  clock: RuntimeClock,
): AppendRevisionInput {
  return Object.freeze({
    revisionId:
      entityId<"DocumentRevision">(
        randomUUID(),
      ),
    workId: entityId<"Work">(
      identities.workId,
    ),
    documentId:
      entityId<"Document">(
        identities.documentId,
      ),
    expectedCurrentRevisionId,
    content,
    cause: randomUUID(),
    createdAt: clock.instant(),
    durableAt: clock.instant(),
  });
}

async function publishSeedBlob(
  blobStore: ImmutableBlobStore,
  blobProfile: RevisionBlobProfile,
  input: AppendRevisionInput,
): Promise<{
  readonly blobRef: string;
  readonly checksumIdentity:
    string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly createdAt: string;
  readonly mediaType?: string;
  readonly originalName?: string;
}> {
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
  const manifestMetadata =
    blobProfile
      .manifestMetadataForAppend(
        input,
      );
  return Object.freeze({
    blobRef:
      blobProfile.blobRefForAddress(
        receipt.address,
      ),
    checksumIdentity:
      receipt.address
        .checksumIdentity,
    checksumValue:
      receipt.address.checksumValue,
    byteLength:
      receipt.byteLength,
    ...manifestMetadata,
  });
}

function createSeedRecords(
  input: {
    readonly identities:
      RuntimeIdentities;
    readonly revisionInput:
      AppendRevisionInput;
    readonly blobProfile:
      RevisionBlobProfile;
    readonly manifest: Awaited<
      ReturnType<
        typeof publishSeedBlob
      >
    >;
    readonly targetSchemaVersion:
      number;
    readonly clock: RuntimeClock;
  },
): readonly Poc3LedgerRecord[] {
  const {
    identities,
    revisionInput,
    blobProfile,
    manifest,
    targetSchemaVersion,
    clock,
  } = input;
  const meta = () =>
    Object.freeze({
      schemaVersion:
        targetSchemaVersion,
      revision: clock.revision(),
      createdAt: clock.instant(),
      updatedAt: clock.instant(),
    });
  const descriptor =
    blobProfile.codec.describe(
      revisionInput.content,
    );
  return Object.freeze([
    {
      kind: "studio",
      id: identities.studioId,
      displayName: randomUUID(),
      locale: randomUUID(),
      timezone: randomUUID(),
      settingsRevision:
        clock.revision(),
      createdAt: clock.instant(),
    },
    {
      kind: "work",
      ...meta(),
      id: identities.workId,
      studioId:
        identities.studioId,
      title: randomUUID(),
      orderKey: randomUUID(),
      settingsId:
        identities.settingsId,
    },
    {
      kind: "activityPolicy",
      ...meta(),
      id:
        identities
          .activityPolicyId,
      workId: identities.workId,
      idleTimeout:
        clock.revision(),
      navigationGrace:
        clock.revision(),
      hiddenWindowPolicy:
        randomUUID(),
      activityClassRulesJson:
        runtimeJson(),
      autoStartEnabled:
        clock.revision() % 2 ===
        0,
      autoResumeFromIdle:
        clock.revision() % 2 ===
        0,
      recoveryPolicy:
        randomUUID(),
    },
    {
      kind: "focusPolicy",
      ...meta(),
      id:
        identities.focusPolicyId,
      workId: identities.workId,
      phaseDefinitionsJson:
        runtimeJson(),
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
      id: identities.settingsId,
      workId: identities.workId,
      sceneRuleSetId:
        randomUUID(),
      activityPolicyId:
        identities
          .activityPolicyId,
      focusPolicyId:
        identities.focusPolicyId,
      railPreferencesJson:
        runtimeJson(),
      revision: clock.revision(),
    },
    {
      kind: "blobManifest",
      blobRef: manifest.blobRef,
      checksumIdentity:
        manifest.checksumIdentity,
      checksumValue:
        manifest.checksumValue,
      byteLength:
        manifest.byteLength,
      createdAt:
        manifest.createdAt,
      ...(manifest.mediaType ===
      undefined
        ? {}
        : {
            mediaType:
              manifest.mediaType,
          }),
      ...(manifest.originalName ===
      undefined
        ? {}
        : {
            originalName:
              manifest.originalName,
          }),
    },
    {
      kind: "document",
      ...meta(),
      id: identities.documentId,
      workId: identities.workId,
      title: randomUUID(),
      orderKey: randomUUID(),
      manuscriptId:
        identities.manuscriptId,
    },
    {
      kind: "documentRevision",
      id: revisionInput.revisionId,
      workId: identities.workId,
      documentId:
        identities.documentId,
      contentRef:
        manifest.blobRef,
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
      id:
        identities.manuscriptId,
      workId: identities.workId,
      documentId:
        identities.documentId,
      currentRevisionId:
        revisionInput.revisionId,
      durableRevisionId:
        revisionInput.revisionId,
      updatedAt:
        revisionInput.durableAt,
    },
  ]);
}

type RuntimeRevisionContext = {
  readonly revisionFixture:
    RevisionStoreFixtureManifest;
  readonly temporaryRoot: string;
  readonly blobRootDirectoryPath:
    string;
  readonly databasePath: string;
  readonly checksumAlgorithm:
    string;
  readonly checksumIdentity:
    string;
  readonly storageOpenProfile:
    ReturnType<
      typeof parsePoc3StorageOpenProfile
    >;
  readonly clock: RuntimeClock;
  readonly identities:
    RuntimeIdentities;
  readonly blobStore:
    ImmutableBlobStore;
  readonly blobProfile:
    RevisionBlobProfile;
  readonly ledger: Awaited<
    ReturnType<
      typeof openNodeSqliteLedger
    >
  >;
  readonly seedInput:
    AppendRevisionInput;
  nextInput(): AppendRevisionInput;
  close(): Promise<void>;
};

async function createRuntimeRevisionContext():
  Promise<RuntimeRevisionContext> {
  const revisionFixture =
    await readJsonFixture<
      RevisionStoreFixtureManifest
    >(
      "../fixtures/storage/poc-3-revision-store.manifest.json",
    );
  const ledgerFixture =
    await readJsonFixture<
      {
        readonly requestedSettings:
          Record<string, unknown>;
        readonly targetSchemaVersion:
          number;
      }
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
  const clock = createRuntimeClock();
  const identities =
    createRuntimeIdentities();
  const shardWidths = Array.from(
    {
      length:
        revisionFixture.counts
          .publishedShardCount,
    },
    () =>
      revisionFixture.counts
        .publishedShardWidth,
  );
  const checksumAlgorithm =
    selectRuntimeHash(
      shardWidths.reduce(
        (sum, width) =>
          sum + width,
        0,
      ),
    );
  const checksumIdentity =
    randomUUID();
  const blobRootDirectoryPath =
    join(
      temporaryRoot,
      randomUUID(),
    );
  const blobStore =
    await createNodeImmutableBlobStore(
      parseNodeImmutableBlobStoreProfile(
        {
          rootDirectoryPath:
            blobRootDirectoryPath,
          checksum: {
            identity:
              checksumIdentity,
            algorithm:
              checksumAlgorithm,
          },
          publishedLayout: {
            directorySegments: [
              randomUUID(),
            ],
            shardWidths,
            fileNamePrefix:
              randomUUID(),
            fileNameSuffix:
              randomUUID(),
          },
          temporaryLayout: {
            directorySegments: [
              randomUUID(),
            ],
          },
        },
      ),
    );
  const blobProfile =
    createRuntimeBlobProfile(
      checksumAlgorithm,
      clock,
    );
  const databasePath = join(
    temporaryRoot,
    randomUUID(),
  );
  const storageOpenProfile =
    parsePoc3StorageOpenProfile(
      {
        databasePath,
        checksumIdentity,
        requestedSettings:
          ledgerFixture
            .requestedSettings,
        targetSchemaVersion:
          ledgerFixture
            .targetSchemaVersion,
      },
    );
  const ledger =
    await openNodeSqliteLedger(
      storageOpenProfile,
    );
  try {
    const seedInput =
      createRuntimeAppendInput(
        identities,
        null,
        runtimeText(
          revisionFixture.counts
            .contentPartCount,
        ),
        clock,
      );
    const seedManifest =
      await publishSeedBlob(
        blobStore,
        blobProfile,
        seedInput,
      );
    const seedRecords =
      createSeedRecords({
        identities,
        revisionInput: seedInput,
        blobProfile,
        manifest: seedManifest,
        targetSchemaVersion:
          ledgerFixture
            .targetSchemaVersion,
        clock,
      });
    await ledger.transaction(
      async (tx) => {
        for (
          const record
          of seedRecords
        ) {
          tx.write(record);
        }
      },
    );
    return Object.freeze({
      revisionFixture,
      temporaryRoot,
      blobRootDirectoryPath,
      databasePath,
      checksumAlgorithm,
      checksumIdentity,
      storageOpenProfile,
      clock,
      identities,
      blobStore,
      blobProfile,
      ledger,
      seedInput,
      nextInput: () =>
        createRuntimeAppendInput(
          identities,
          seedInput.revisionId,
          runtimeText(
            revisionFixture.counts
              .contentPartCount,
          ),
          clock,
        ),
      close: async () => {
        ledger.close();
        await rm(
          temporaryRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    });
  } catch (error) {
    ledger.close();
    await rm(
      temporaryRoot,
      {
        recursive: true,
        force: true,
      },
    );
    throw error;
  }
}

type AuditSqliteStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<
    string,
    unknown
  >[];
  run(
    ...parameters: readonly unknown[]
  ): unknown;
};

type AuditSqliteDatabase = {
  prepare(
    sql: string,
  ): AuditSqliteStatement;
  close(): void;
};

type AuditSqliteModule = {
  readonly DatabaseSync: new (
    databasePath: string,
  ) => AuditSqliteDatabase;
};

function auditRows(
  databasePath: string,
  sql: string,
  parameters:
    readonly unknown[] = [],
): readonly Record<
  string,
  unknown
>[] {
  const module =
    process.getBuiltinModule(
      "node:sqlite",
    ) as AuditSqliteModule | undefined;
  if (module === undefined) {
    throw new Error(
      "Current runtime has no node:sqlite audit connection",
    );
  }
  const database =
    new module.DatabaseSync(
      databasePath,
    );
  try {
    return database
      .prepare(sql)
      .all(...parameters);
  } finally {
    database.close();
  }
}

function auditRun(
  databasePath: string,
  sql: string,
  parameters:
    readonly unknown[] = [],
): void {
  const module =
    process.getBuiltinModule(
      "node:sqlite",
    ) as AuditSqliteModule | undefined;
  if (module === undefined) {
    throw new Error(
      "Current runtime has no node:sqlite audit connection",
    );
  }
  const database =
    new module.DatabaseSync(
      databasePath,
    );
  try {
    database
      .prepare(sql)
      .run(...parameters);
  } finally {
    database.close();
  }
}

async function publishedPathForRevision(
  context:
    RuntimeRevisionContext,
  contentRef: string,
): Promise<string> {
  const address =
    context.blobProfile
      .addressForBlobRef(
        contentRef,
      );
  const inventory =
    await context.blobStore
      .inventory({
        isReachable:
          async (candidate) =>
            candidate
              .checksumIdentity ===
              address
                .checksumIdentity &&
            candidate
              .checksumValue ===
              address.checksumValue,
      });
  const entry =
    inventory.published.find(
      (candidate) =>
        candidate.address
          .checksumIdentity ===
          address
            .checksumIdentity &&
        candidate.address
          .checksumValue ===
          address.checksumValue,
    );
  if (entry === undefined) {
    throw new Error(
      "Committed revision has no exact published inventory entry",
    );
  }
  return join(
    context.blobRootDirectoryPath,
    ...entry.relativePathSegments,
  );
}

function addressForContent(
  context:
    RuntimeRevisionContext,
  content: string,
): BlobAddress {
  const bytes =
    context.blobProfile.codec
      .encode(content);
  return Object.freeze({
    checksumIdentity:
      context.checksumIdentity,
    checksumValue:
      createHash(
        context.checksumAlgorithm,
      )
        .update(bytes)
        .digest("hex"),
  });
}

function auditManifestRows(
  context:
    RuntimeRevisionContext,
  blobRef: string,
): readonly Record<
  string,
  unknown
>[] {
  return auditRows(
    context.databasePath,
    `
      SELECT
        blob_ref AS "blobRef",
        checksum_identity AS "checksumIdentity",
        checksum_value AS "checksumValue",
        byte_length AS "byteLength",
        created_at AS "createdAt",
        media_type AS "mediaType",
        original_name AS "originalName"
      FROM blob_manifests
      WHERE blob_ref = ?
    `,
    [blobRef],
  );
}

function auditPointerRows(
  context:
    RuntimeRevisionContext,
): readonly Record<
  string,
  unknown
>[] {
  return auditRows(
    context.databasePath,
    `
      SELECT
        current_revision_id AS "currentRevisionId",
        durable_revision_id AS "durableRevisionId",
        updated_at AS "updatedAt"
      FROM manuscripts
      WHERE id = ?
    `,
    [
      context.identities
        .manuscriptId,
    ],
  );
}

async function expectRejectedAppendLeavesOrphan(
  context:
    RuntimeRevisionContext,
  input: AppendRevisionInput,
  expectedMessage: RegExp,
): Promise<void> {
  const revisionStore =
    context.ledger
      .createRevisionStore({
        blobStore:
          context.blobStore,
        blobProfile:
          context.blobProfile,
      });
  const address =
    addressForContent(
      context,
      input.content,
    );
  const blobRef =
    context.blobProfile
      .blobRefForAddress(address);
  const revisionBefore =
    await revisionStore.getRevision(
      input.revisionId,
    );
  const pointerBefore =
    auditPointerRows(context);
  const manifestBefore =
    auditManifestRows(
      context,
      blobRef,
    );

  await expect(
    revisionStore.append(input),
  ).rejects.toThrow(
    expectedMessage,
  );

  expect(
    await revisionStore.getRevision(
      input.revisionId,
    ),
  ).toEqual(revisionBefore);
  expect(
    auditPointerRows(context),
  ).toEqual(pointerBefore);
  expect(
    auditManifestRows(
      context,
      blobRef,
    ),
  ).toEqual(manifestBefore);
  expect(
    await revisionStore.materialize(
      context.seedInput
        .revisionId,
    ),
  ).toBe(
    context.seedInput.content,
  );
  const inventory =
    await context.blobStore
      .inventory({
        isReachable:
          async (candidate) =>
            auditManifestRows(
              context,
              context.blobProfile
                .blobRefForAddress(
                  candidate,
                ),
            ).length === 1,
      });
  expect(
    inventory.published.find(
      (entry) =>
        entry.address
          .checksumIdentity ===
          address
            .checksumIdentity &&
        entry.address
          .checksumValue ===
          address.checksumValue,
    ),
  ).toEqual(
    expect.objectContaining({
      address,
      byteLength:
        context.blobProfile
          .codec.encode(
            input.content,
          ).byteLength,
      status: "verified",
      reachable: false,
    }),
  );
}

const MANIFEST_MISMATCH_FIELDS =
  Object.freeze([
    "checksumIdentity",
    "checksumValue",
    "byteLength",
    "createdAt",
    "mediaType",
    "originalName",
  ] as const);

type ManifestMismatchField =
  (typeof MANIFEST_MISMATCH_FIELDS)[number];

function mismatchedManifestRecord(
  context:
    RuntimeRevisionContext,
  manifest: Awaited<
    ReturnType<
      typeof publishSeedBlob
    >
  >,
  field: ManifestMismatchField,
): Extract<
  Poc3LedgerRecord,
  { readonly kind: "blobManifest" }
> {
  const exactRecord = {
    kind:
      "blobManifest" as const,
    blobRef: manifest.blobRef,
    checksumIdentity:
      manifest.checksumIdentity,
    checksumValue:
      manifest.checksumValue,
    byteLength:
      manifest.byteLength,
    createdAt: manifest.createdAt,
    ...(manifest.mediaType ===
    undefined
      ? {}
      : {
          mediaType:
            manifest.mediaType,
        }),
    ...(manifest.originalName ===
    undefined
      ? {}
      : {
          originalName:
            manifest.originalName,
        }),
  };
  switch (field) {
    case "checksumIdentity":
      return Object.freeze({
        ...exactRecord,
        checksumIdentity:
          randomUUID(),
      });
    case "checksumValue":
      return Object.freeze({
        ...exactRecord,
        checksumValue:
          randomUUID(),
      });
    case "byteLength":
      return Object.freeze({
        ...exactRecord,
        byteLength:
          manifest.byteLength +
          context.revisionFixture
            .counts
            .contentPartCount,
      });
    case "createdAt":
      return Object.freeze({
        ...exactRecord,
        createdAt: randomUUID(),
      });
    case "mediaType":
      return Object.freeze({
        ...exactRecord,
        mediaType: randomUUID(),
      });
    case "originalName":
      return Object.freeze({
        ...exactRecord,
        originalName:
          randomUUID(),
      });
  }
}

describe(
  "POC-3 node:sqlite revision store",
  () => {
    it(
      "publishes a caller-coded immutable blob and serves the committed revision through the existing reader contract",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const revisionStore =
            context.ledger
              .createRevisionStore({
                blobStore:
                  context.blobStore,
                blobProfile:
                  context.blobProfile,
              });
          const nextInput =
            context.nextInput();
          const appended =
            await revisionStore.append(
              nextInput,
            );
          const descriptor =
            context.blobProfile
              .codec.describe(
                nextInput.content,
              );

          expect(appended).toEqual({
            id: nextInput.revisionId,
            documentId:
              nextInput.documentId,
            parentRevisionId:
              context.seedInput
                .revisionId,
            contentRef:
              appended.contentRef,
            contentHash:
              descriptor.contentHash,
            length:
              descriptor.length,
            cause: nextInput.cause,
            createdAt:
              nextInput.createdAt,
            durableAt:
              nextInput.durableAt,
          });
          expect(
            await revisionStore
              .getCurrentRevision(
                nextInput.documentId,
              ),
          ).toEqual(appended);
          expect(
            await revisionStore
              .getRevision(
                nextInput.revisionId,
              ),
          ).toEqual(appended);
          expect(
            await revisionStore
              .materialize(
                nextInput.revisionId,
              ),
          ).toBe(nextInput.content);
        } finally {
          await context.close();
        }
      },
    );
    it(
      "rolls back every database reference when the caller database stage fails but leaves the published blob as an unreachable orphan",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const stageFailure =
            new Error(randomUUID());
          let stageCallCount = 0;
          const revisionStore =
            context.ledger
              .createRevisionStore({
                blobStore:
                  context.blobStore,
                blobProfile:
                  context.blobProfile,
                beforeDatabaseCommit:
                  async () => {
                    stageCallCount += 1;
                    throw stageFailure;
                  },
              });
          const failedInput =
            context.nextInput();
          const failedBytes =
            context.blobProfile
              .codec.encode(
                failedInput.content,
              );
          const failedAddress =
            Object.freeze({
              checksumIdentity:
                context
                  .checksumIdentity,
              checksumValue:
                createHash(
                  context
                    .checksumAlgorithm,
                )
                  .update(failedBytes)
                  .digest("hex"),
            });
          const failedBlobRef =
            context.blobProfile
              .blobRefForAddress(
                failedAddress,
              );

          await expect(
            revisionStore.append(
              failedInput,
            ),
          ).rejects.toBe(
            stageFailure,
          );
          expect(stageCallCount).toBe(1);
          expect(
            await revisionStore
              .getRevision(
                failedInput
                  .revisionId,
              ),
          ).toBeNull();
          expect(
            (
              await revisionStore
                .getCurrentRevision(
                  failedInput
                    .documentId,
                )
            )?.id,
          ).toBe(
            context.seedInput
              .revisionId,
          );
          expect(
            auditRows(
              context.databasePath,
              `
                SELECT blob_ref
                FROM blob_manifests
                WHERE blob_ref = ?
              `,
              [failedBlobRef],
            ),
          ).toEqual([]);
          expect(
            auditRows(
              context.databasePath,
              `
                SELECT id
                FROM document_revisions
                WHERE id = ?
              `,
              [
                failedInput
                  .revisionId,
              ],
            ),
          ).toEqual([]);
          expect(
            auditRows(
              context.databasePath,
              `
                SELECT
                  current_revision_id AS "currentRevisionId",
                  durable_revision_id AS "durableRevisionId"
                FROM manuscripts
                WHERE id = ?
              `,
              [
                context.identities
                  .manuscriptId,
              ],
            ),
          ).toEqual([
            {
              currentRevisionId:
                context.seedInput
                  .revisionId,
              durableRevisionId:
                context.seedInput
                  .revisionId,
            },
          ]);

          const inventory =
            await context.blobStore
              .inventory({
                isReachable:
                  async (address) =>
                    auditRows(
                      context
                        .databasePath,
                      `
                        SELECT blob_ref
                        FROM blob_manifests
                        WHERE blob_ref = ?
                      `,
                      [
                        context
                          .blobProfile
                          .blobRefForAddress(
                            address,
                          ),
                      ],
                    ).length === 1,
              });
          const orphan =
            inventory.published.find(
              (entry) =>
                entry.address
                  .checksumIdentity ===
                  failedAddress
                    .checksumIdentity &&
                entry.address
                  .checksumValue ===
                  failedAddress
                    .checksumValue,
            );
          expect(orphan).toEqual(
            expect.objectContaining({
              address:
                failedAddress,
              byteLength:
                failedBytes.byteLength,
              status: "verified",
              reachable: false,
            }),
          );
        } finally {
          await context.close();
        }
      },
    );
    it(
      "rejects a stale expected current revision without changing the revision or manuscript pointer and preserves the published orphan",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const staleInput =
            Object.freeze({
              ...context.nextInput(),
              expectedCurrentRevisionId:
                entityId<"DocumentRevision">(
                  randomUUID(),
                ),
            });
          await expectRejectedAppendLeavesOrphan(
            context,
            staleInput,
            /revision conflict/i,
          );
        } finally {
          await context.close();
        }
      },
    );
    it(
      "rejects a wrong work for an owned document without changing the revision or manuscript pointer and preserves the published orphan",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const wrongOwnershipInput =
            Object.freeze({
              ...context.nextInput(),
              workId:
                entityId<"Work">(
                  randomUUID(),
                ),
            });
          await expectRejectedAppendLeavesOrphan(
            context,
            wrongOwnershipInput,
            /work\/document boundary violation/i,
          );
        } finally {
          await context.close();
        }
      },
    );
    it(
      "rejects a duplicate revision identity without replacing its revision or manuscript pointer and preserves the new published orphan",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const duplicateInput =
            Object.freeze({
              ...context.nextInput(),
              revisionId:
                context.seedInput
                  .revisionId,
            });
          await expectRejectedAppendLeavesOrphan(
            context,
            duplicateInput,
            /duplicate revision identity/i,
          );
        } finally {
          await context.close();
        }
      },
    );
    it(
      "reuses an existing exact blob manifest row for same caller content without issuing an update or UPSERT",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const revisionStore =
            context.ledger
              .createRevisionStore({
                blobStore:
                  context.blobStore,
                blobProfile:
                  context.blobProfile,
              });
          const seedRevision =
            await revisionStore
              .getRevision(
                context.seedInput
                  .revisionId,
              );
          expect(
            seedRevision,
          ).not.toBeNull();
          const manifestBefore =
            auditManifestRows(
              context,
              seedRevision
                ?.contentRef ?? "",
            );
          const sameContentInput =
            Object.freeze({
              ...context.nextInput(),
              content:
                context.seedInput
                  .content,
            });

          const appended =
            await revisionStore.append(
              sameContentInput,
            );

          expect(
            appended.contentRef,
          ).toBe(
            seedRevision?.contentRef,
          );
          expect(
            auditManifestRows(
              context,
              appended.contentRef,
            ),
          ).toEqual(
            manifestBefore,
          );
          expect(
            (
              await revisionStore
                .getCurrentRevision(
                  appended.documentId,
                )
            )?.id,
          ).toBe(appended.id);
          expect(
            await revisionStore
              .materialize(
                appended.id,
              ),
          ).toBe(
            context.seedInput
              .content,
          );
        } finally {
          await context.close();
        }
      },
    );
    it.each(
      MANIFEST_MISMATCH_FIELDS,
    )(
      "rejects an existing blob manifest when only %s differs and leaves that exact row unchanged",
      async (mismatchField) => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const candidateInput =
            context.nextInput();
          const candidateManifest =
            await publishSeedBlob(
              context.blobStore,
              context.blobProfile,
              candidateInput,
            );
          const mismatchedRecord =
            mismatchedManifestRecord(
              context,
              candidateManifest,
              mismatchField,
            );
          if (
            mismatchField ===
            "checksumIdentity"
          ) {
            auditRun(
              context.databasePath,
              `
                INSERT INTO storage_ledger_identity (
                  checksum_identity,
                  target_schema_version
                )
                VALUES (?, ?)
              `,
              [
                mismatchedRecord
                  .checksumIdentity,
                context.clock
                  .revision(),
              ],
            );
          }
          await context.ledger
            .transaction(
              async (tx) => {
                tx.write(
                  mismatchedRecord,
                );
              },
            );
          const manifestBefore =
            auditManifestRows(
              context,
              candidateManifest
                .blobRef,
            );
          const pointerBefore =
            auditPointerRows(
              context,
            );
          const revisionStore =
            context.ledger
              .createRevisionStore({
                blobStore:
                  context.blobStore,
                blobProfile:
                  context.blobProfile,
              });

          await expect(
            revisionStore.append(
              candidateInput,
            ),
          ).rejects.toBeInstanceOf(
            BlobContentMismatchError,
          );

          expect(
            auditManifestRows(
              context,
              candidateManifest
                .blobRef,
            ),
          ).toEqual(
            manifestBefore,
          );
          expect(
            auditPointerRows(
              context,
            ),
          ).toEqual(pointerBefore);
          expect(
            await revisionStore
              .getRevision(
                candidateInput
                  .revisionId,
              ),
          ).toBeNull();
          expect(
            await context.blobStore
              .readExact(
                context.blobProfile
                  .addressForBlobRef(
                    candidateManifest
                      .blobRef,
                  ),
              ),
          ).toEqual(
            expect.objectContaining({
              byteLength:
                candidateManifest
                  .byteLength,
            }),
          );
          expect(
            await revisionStore
              .materialize(
                context.seedInput
                  .revisionId,
              ),
          ).toBe(
            context.seedInput
              .content,
          );
        } finally {
          await context.close();
        }
      },
    );
    it(
      "allows exactly one same-expected append across two SQLite connections and returns the competing lock without retry",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        const competingLedger =
          await openNodeSqliteLedger(
            context
              .storageOpenProfile,
          );
        try {
          let databaseStageCallCount =
            0;
          const databaseStageHook =
            async (): Promise<void> => {
              databaseStageCallCount +=
                1;
            };
          const firstStore =
            context.ledger
              .createRevisionStore({
                blobStore:
                  context.blobStore,
                blobProfile:
                  context.blobProfile,
                beforeDatabaseCommit:
                  databaseStageHook,
              });
          const competingStore =
            competingLedger
              .createRevisionStore({
                blobStore:
                  context.blobStore,
                blobProfile:
                  context.blobProfile,
                beforeDatabaseCommit:
                  databaseStageHook,
              });
          const firstInput =
            context.nextInput();
          const competingInput =
            context.nextInput();

          const results =
            await Promise.allSettled([
              firstStore.append(
                firstInput,
              ),
              competingStore.append(
                competingInput,
              ),
            ]);
          const committed =
            results.filter(
              (
                result,
              ): result is PromiseFulfilledResult<
                Awaited<
                  ReturnType<
                    typeof firstStore.append
                  >
                >
              > =>
                result.status ===
                "fulfilled",
            );
          const rejected =
            results.filter(
              (
                result,
              ): result is PromiseRejectedResult =>
                result.status ===
                "rejected",
            );

          expect(committed).toHaveLength(
            1,
          );
          expect(rejected).toHaveLength(
            1,
          );
          expect(
            databaseStageCallCount,
          ).toBe(1);
          expect(
            rejected[0]?.reason,
          ).toBeInstanceOf(Error);
          expect(
            (
              rejected[0]
                ?.reason as Error
            ).message,
          ).toMatch(
            /locked|busy|conflict/i,
          );
          const committedRevision =
            committed[0]?.value;
          expect(
            (
              await firstStore
                .getCurrentRevision(
                  firstInput
                    .documentId,
                )
            )?.id,
          ).toBe(
            committedRevision?.id,
          );
          const rejectedInput =
            committedRevision?.id ===
            firstInput.revisionId
              ? competingInput
              : firstInput;
          expect(
            await firstStore
              .getRevision(
                rejectedInput
                  .revisionId,
              ),
          ).toBeNull();
        } finally {
          competingLedger.close();
          await context.close();
        }
      },
    );
    it(
      "reports an explicitly missing committed blob without falling back to another revision",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const revisionStore =
            context.ledger
              .createRevisionStore({
                blobStore:
                  context.blobStore,
                blobProfile:
                  context.blobProfile,
              });
          const appended =
            await revisionStore.append(
              context.nextInput(),
            );
          const address =
            context.blobProfile
              .addressForBlobRef(
                appended.contentRef,
              );
          await unlink(
            await publishedPathForRevision(
              context,
              appended.contentRef,
            ),
          );

          await expect(
            context.blobStore
              .readExact(address),
          ).rejects.toBeInstanceOf(
            BlobNotFoundError,
          );
          await expect(
            revisionStore.materialize(
              appended.id,
            ),
          ).rejects.toBeInstanceOf(
            BlobNotFoundError,
          );
          expect(
            (
              await revisionStore
                .getCurrentRevision(
                  appended.documentId,
                )
            )?.id,
          ).toBe(appended.id);
        } finally {
          await context.close();
        }
      },
    );
    it(
      "reports physical checksum corruption before materializing a committed revision",
      async () => {
        const context =
          await createRuntimeRevisionContext();
        try {
          const revisionStore =
            context.ledger
              .createRevisionStore({
                blobStore:
                  context.blobStore,
                blobProfile:
                  context.blobProfile,
              });
          const appended =
            await revisionStore.append(
              context.nextInput(),
            );
          const address =
            context.blobProfile
              .addressForBlobRef(
                appended.contentRef,
              );
          const physical =
            await context.blobStore
              .readExact(address);
          const corruptBytes =
            Uint8Array.from(
              physical.bytes,
            );
          corruptBytes[0] =
            (corruptBytes[0] ?? 0) ^
            1;
          await writeFile(
            await publishedPathForRevision(
              context,
              appended.contentRef,
            ),
            corruptBytes,
          );

          await expect(
            context.blobStore
              .readExact(address),
          ).rejects.toBeInstanceOf(
            BlobContentMismatchError,
          );
          await expect(
            revisionStore.materialize(
              appended.id,
            ),
          ).rejects.toBeInstanceOf(
            BlobContentMismatchError,
          );
        } finally {
          await context.close();
        }
      },
    );
  },
);
