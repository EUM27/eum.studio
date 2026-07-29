import {
  createHash,
  getHashes,
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
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  join,
} from "node:path";
import {
  tmpdir,
} from "node:os";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";
import type {
  NodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";
import {
  createNodeSqliteBackupBundle,
  restoreNodeSqliteBackupBundle,
} from "../../src/platform/storage/node-sqlite-backup";
import type {
  CreateNodeSqliteBackupBundleInput,
  NodeSqliteBackupCanonicalBytesAdapter,
  NodeSqliteBackupChecksumAdapter,
  NodeSqliteBackupCounts,
  NodeSqliteBackupManifest,
  NodeSqliteBackupManifestCodec,
  NodeSqliteRestorePreflightInput,
  RestoreNodeSqliteBackupBundleInput,
} from "../../src/platform/storage/node-sqlite-backup";
import {
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";
import type {
  Poc3LedgerRecord,
} from "../../src/domain/poc-3-storage-ledger";

type BackupCoreFixture = {
  readonly emptyCounts:
    NodeSqliteBackupCounts;
  readonly seededCounts:
    NodeSqliteBackupCounts;
  readonly byteMaterialLengths:
    readonly number[];
  readonly standaloneSnapshotJournalMode:
    string;
};

type NodeSqliteStatement = {
  all():
    readonly Record<
      string,
      unknown
    >[];
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

type RuntimeBackupProfile = {
  readonly root: string;
  readonly sourceDatabasePath:
    string;
  readonly sourceBlobStore:
    Awaited<
      ReturnType<
        typeof createNodeImmutableBlobStore
      >
    >;
  readonly sourceTemporaryBlobDirectoryPath:
    string;
  readonly sourceBlobRootDirectoryPath:
    string;
  readonly storageChecksumIdentity:
    string;
  readonly targetSchemaVersion:
    number;
  readonly requestedSettings:
    unknown;
  readonly createInput:
    CreateNodeSqliteBackupBundleInput;
  readonly restoreInput:
    RestoreNodeSqliteBackupBundleInput;
  readonly preflightRequiredBytes:
    number[];
  readonly preflightChecks:
    Set<string>;
};

const cleanupRoots: string[] = [];

afterEach(async () => {
  for (
    const root
    of cleanupRoots.splice(0)
  ) {
    await rm(root, {
      recursive: true,
      force: true,
    });
  }
});

async function loadJson(
  path: string,
): Promise<unknown> {
  return JSON.parse(
    await readFile(
      path,
      "utf8",
    ),
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
          left.localeCompare(
            right,
          ),
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

function createManifestCodec(
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
): NodeSqliteBackupManifestCodec {
  return Object.freeze({
    encodeCanonical: (
      manifest:
        NodeSqliteBackupManifest,
    ): Uint8Array =>
      canonicalBytes.encode(
        manifest,
      ),
    decodeCanonical: (
      bytes: Uint8Array,
    ):
      NodeSqliteBackupManifest =>
      canonicalBytes.decode(
        bytes,
      ) as
        NodeSqliteBackupManifest,
  });
}

function selectChecksumAlgorithm():
  string {
  const algorithms =
    getHashes();
  const offset =
    randomInt(
      algorithms.length,
    );
  const probe =
    randomBytes(
      randomInt(1, 32),
    );
  for (
    let index = 0;
    index < algorithms.length;
    index += 1
  ) {
    const algorithm =
      algorithms[
        (
          offset + index
        ) % algorithms.length
      ];
    if (algorithm === undefined) {
      continue;
    }
    try {
      createHash(algorithm)
        .update(probe)
        .digest();
      return algorithm;
    } catch {
      continue;
    }
  }
  throw new Error(
    "No runtime checksum algorithm is usable",
  );
}

function createChecksumAdapter():
  NodeSqliteBackupChecksumAdapter {
  const algorithm =
    selectChecksumAlgorithm();
  return Object.freeze({
    identity: randomUUID(),
    checksum: (
      bytes: Uint8Array,
    ): string =>
      createHash(algorithm)
        .update(bytes)
        .digest("hex"),
  });
}

async function pathExists(
  path: string,
): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function transientSqliteSidecarPaths(
  databasePath: string,
): readonly string[] {
  return Object.freeze([
    `${databasePath}-wal`,
    `${databasePath}-shm`,
    `${databasePath}-journal`,
  ]);
}

async function treeFingerprint(
  root: string,
  segments:
    readonly string[] = [],
): Promise<readonly string[]> {
  const directoryPath =
    join(root, ...segments);
  const entries =
    await readdir(
      directoryPath,
      {
        withFileTypes: true,
      },
    );
  const fingerprint:
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
      fingerprint.push(
        JSON.stringify([
          "directory",
          childSegments,
        ]),
      );
      fingerprint.push(
        ...await treeFingerprint(
          root,
          childSegments,
        ),
      );
    } else if (entry.isFile()) {
      fingerprint.push(
        JSON.stringify([
          "file",
          childSegments,
          Buffer.from(
            await readFile(
              join(
                root,
                ...childSegments,
              ),
            ),
          ).toString("hex"),
        ]),
      );
    } else {
      throw new Error(
        "Unexpected bundle entry type",
      );
    }
  }
  return Object.freeze(
    fingerprint,
  );
}

async function flipOneByte(
  path: string,
): Promise<void> {
  const bytes =
    new Uint8Array(
      await readFile(path),
    );
  if (bytes.byteLength === 0) {
    throw new Error(
      "Cannot tamper an empty file",
    );
  }
  const index =
    randomInt(
      bytes.byteLength,
    );
  bytes[index] =
    (
      bytes[index] ?? 0
    ) ^ 0xff;
  await writeFile(path, bytes);
}

async function discoverDatabaseName(
  databasePath: string,
): Promise<string> {
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
        "string"
    ) {
      throw new Error(
        "Database name is unavailable",
      );
    }
    return row.name;
  } finally {
    database.close();
  }
}

async function createEmptyLedger(
  databasePath: string,
  checksumIdentity: string,
  targetSchemaVersion: number,
  requestedSettings: unknown,
): Promise<void> {
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
  ledger.close();
}

async function createRuntimeProfile():
  Promise<RuntimeBackupProfile> {
  const backupFixture =
    await loadFixture();
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        randomUUID(),
      ),
    );
  cleanupRoots.push(root);
  const sourceDatabasePath =
    join(
      root,
      randomUUID(),
    );
  const sourceBlobRoot =
    join(
      root,
      randomUUID(),
    );
  const sourceBlobProfile:
    NodeImmutableBlobStoreProfile =
    Object.freeze({
      rootDirectoryPath:
        sourceBlobRoot,
      checksum: Object.freeze({
        identity: randomUUID(),
        algorithm:
          selectChecksumAlgorithm(),
      }),
      publishedLayout:
        Object.freeze({
          directorySegments:
            Object.freeze([
              randomUUID(),
            ]),
          shardWidths:
            Object.freeze([]),
          fileNamePrefix:
            randomUUID(),
          fileNameSuffix:
            randomUUID(),
        }),
      temporaryLayout:
        Object.freeze({
          directorySegments:
            Object.freeze([
              randomUUID(),
            ]),
        }),
    });
  const sourceBlobStore =
    await createNodeImmutableBlobStore(
      sourceBlobProfile,
    );
  const ledgerFixture =
    await loadJson(
      join(
        process.cwd(),
        "tests",
        "fixtures",
        "storage",
        "poc-3-ledger.manifest.json",
      ),
    ) as Record<
      string,
      unknown
    >;
  const requestedSettings =
    ledgerFixture[
      "requestedSettings"
    ];
  const targetSchemaVersion =
    randomInt(1, 128);
  await createEmptyLedger(
    sourceDatabasePath,
    sourceBlobProfile
      .checksum.identity,
    targetSchemaVersion,
    requestedSettings,
  );

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
  const databaseEntrySegments =
    Object.freeze([
      randomUUID(),
      randomUUID(),
    ]);
  const manifestEntrySegments =
    Object.freeze([
      randomUUID(),
      randomUUID(),
    ]);
  const checksumEntrySegments =
    Object.freeze([
      randomUUID(),
      randomUUID(),
    ]);
  const targetDatabaseSegments =
    Object.freeze([
      randomUUID(),
      randomUUID(),
    ]);
  const bundleBlobDirectory =
    randomUUID();
  const targetBlobDirectory =
    randomUUID();
  const canonicalBytes =
    createCanonicalBytes();
  const manifestCodec =
    createManifestCodec(
      canonicalBytes,
    );
  const checksum =
    createChecksumAdapter();
  const format =
    Object.freeze({
      identity: randomUUID(),
      version: randomUUID(),
    });
  const databaseName =
    await discoverDatabaseName(
      sourceDatabasePath,
    );
  const bundleLayout =
    Object.freeze({
      databaseEntrySegments,
      manifestEntrySegments,
      manifestChecksumEntrySegments:
        checksumEntrySegments,
      blobEntrySegments: (
        address: {
          readonly checksumValue:
            string;
        },
      ): readonly string[] =>
        Object.freeze([
          bundleBlobDirectory,
          address.checksumValue,
        ]),
    });
  const preflightRequiredBytes:
    number[] = [];
  const preflightChecks =
    new Set<string>();
  const createInput:
    CreateNodeSqliteBackupBundleInput =
    Object.freeze({
      sourceDatabasePath,
      sourceBlobStore,
      temporaryBundleRoot,
      finalBundleRoot,
      layout: bundleLayout,
      format,
      sqlite: Object.freeze({
        sourceDatabaseName:
          databaseName,
        targetDatabaseName:
          databaseName,
        pagesPerStep:
          randomInt(1, 64),
        standaloneSnapshotJournalMode:
          backupFixture
            .standaloneSnapshotJournalMode,
      }),
      manifestCodec,
      canonicalBytes,
      checksum,
      clock: Object.freeze({
        now: () =>
          new Date()
            .toISOString(),
      }),
    });
  const restoreInput:
    RestoreNodeSqliteBackupBundleInput =
    Object.freeze({
      finalBundleRoot,
      bundleLayout,
      targetStagingRoot,
      targetFinalRoot,
      targetLayout:
        Object.freeze({
          databaseEntrySegments:
            targetDatabaseSegments,
          blobEntrySegments: (
            address: {
              readonly checksumValue:
                string;
            },
          ):
            readonly string[] =>
            Object.freeze([
              targetBlobDirectory,
              address
                .checksumValue,
            ]),
        }),
      expectedFormat: format,
      manifestCodec,
      canonicalBytes,
      checksum,
      preflight:
        Object.freeze({
          preflight:
            async (
              input:
                NodeSqliteRestorePreflightInput,
            ) => {
              preflightRequiredBytes
                .push(
                  input
                    .requiredByteCount,
                );
              preflightChecks.add(
                "capacity",
              );
              preflightChecks.add(
                "authorization",
              );
            },
        }),
    });
  return Object.freeze({
    root,
    sourceDatabasePath,
    sourceBlobStore,
    sourceBlobRootDirectoryPath:
      sourceBlobProfile
        .rootDirectoryPath,
    sourceTemporaryBlobDirectoryPath:
      join(
        sourceBlobProfile
          .rootDirectoryPath,
        ...sourceBlobProfile
          .temporaryLayout
          .directorySegments,
      ),
    storageChecksumIdentity:
      sourceBlobProfile
        .checksum.identity,
    targetSchemaVersion,
    requestedSettings,
    createInput,
    restoreInput,
    preflightRequiredBytes,
    preflightChecks,
  });
}

async function loadFixture():
  Promise<BackupCoreFixture> {
  return await loadJson(
    join(
      process.cwd(),
      "tests",
      "fixtures",
      "backup",
      "poc-3-backup-core.manifest.json",
    ),
  ) as BackupCoreFixture;
}

function runtimeJson(): string {
  return JSON.stringify({
    [randomUUID()]: randomUUID(),
  });
}

function createRuntimeClock(): {
  readonly instant:
    () => string;
  readonly revision:
    () => number;
} {
  let offset = 0;
  return Object.freeze({
    instant: (): string =>
      new Date(
        Date.now() +
          offset++,
      ).toISOString(),
    revision: (): number =>
      Date.now() +
        offset++,
  });
}

async function openRuntimeLedger(
  runtime:
    RuntimeBackupProfile,
) {
  return openNodeSqliteLedger(
    parsePoc3StorageOpenProfile({
      databasePath:
        runtime
          .sourceDatabasePath,
      checksumIdentity:
        runtime
          .storageChecksumIdentity,
      requestedSettings:
        runtime
          .requestedSettings,
      targetSchemaVersion:
        runtime
          .targetSchemaVersion,
    }),
  );
}

type SeededGraph = {
  readonly workId: string;
  readonly documentId: string;
  readonly revisionId: string;
  readonly contentBlobRef: string;
  readonly contentChecksumValue:
    string;
  readonly contentBytes: Uint8Array;
  readonly contentPlaintext:
    string;
  readonly changeSetChecksumValue?:
    string;
  readonly changeSetBytes?:
    Uint8Array;
};

async function seedSingleGraph(
  runtime:
    RuntimeBackupProfile,
  contentByteLength: number,
  changeSetByteLength?:
    number,
): Promise<SeededGraph> {
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
  const contentPlaintext =
    Array.from(
      {
        length:
          contentByteLength,
      },
      () => randomUUID(),
    )
      .join(randomUUID())
      .slice(
        0,
        contentByteLength,
      );
  const contentBytes =
    new TextEncoder().encode(
      contentPlaintext,
    );
  const content =
    await runtime
      .sourceBlobStore
      .append({
        bytes: contentBytes,
        metadata:
          Object.freeze({
            [randomUUID()]:
              randomUUID(),
          }),
        temporaryEntryIdentity:
          randomUUID(),
      });
  const changeSetBlobRef =
    randomUUID();
  const changeSetBytes =
    changeSetByteLength ===
      undefined
      ? undefined
      : Uint8Array.from(
        randomBytes(
          changeSetByteLength,
        ),
      );
  const changeSet =
    changeSetBytes ===
      undefined
      ? undefined
      : await runtime
        .sourceBlobStore
        .append({
          bytes:
            changeSetBytes,
          metadata:
            Object.freeze({
              [randomUUID()]:
                randomUUID(),
            }),
          temporaryEntryIdentity:
            randomUUID(),
        });
  const meta = () =>
    Object.freeze({
      schemaVersion:
        runtime
          .targetSchemaVersion,
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
          false,
        autoResumeFromIdle:
          true,
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
      ...(
        changeSet === undefined
          ? []
          : [
              {
                kind:
                  "blobManifest",
                blobRef:
                  changeSetBlobRef,
                checksumIdentity:
                  changeSet
                    .address
                    .checksumIdentity,
                checksumValue:
                  changeSet
                    .address
                    .checksumValue,
                byteLength:
                  changeSet
                    .byteLength,
                createdAt:
                  clock.instant(),
              } satisfies
                Poc3LedgerRecord,
            ]
      ),
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
        ...(
          changeSet ===
            undefined
            ? {}
            : {
                changeSetRef:
                  changeSetBlobRef,
              }
        ),
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
        startOffset: 0,
        endOffset: 0,
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
  const ledger =
    await openRuntimeLedger(
      runtime,
    );
  try {
    await ledger.transaction(
      async (transaction) => {
        for (
          const record
          of records
        ) {
          transaction.write(
            record,
          );
        }
      },
    );
  } finally {
    ledger.close();
  }
  const seeded =
    Object.freeze({
      workId,
      documentId,
      revisionId,
      contentBlobRef,
      contentChecksumValue:
        content.address
          .checksumValue,
      contentBytes,
      contentPlaintext,
    });
  if (
    changeSet === undefined ||
    changeSetBytes ===
      undefined
  ) {
    return seeded;
  }
  return Object.freeze({
    ...seeded,
    changeSetChecksumValue:
      changeSet.address
        .checksumValue,
    changeSetBytes,
  });
}

async function appendLaterRevision(
  runtime:
    RuntimeBackupProfile,
  baseline: SeededGraph,
  contentByteLength: number,
): Promise<{
  readonly revisionId: string;
  readonly checksumValue: string;
}> {
  const clock =
    createRuntimeClock();
  const revisionId =
    randomUUID();
  const blobRef =
    randomUUID();
  const content =
    await runtime
      .sourceBlobStore
      .append({
        bytes:
          randomBytes(
            contentByteLength,
          ),
        metadata:
          Object.freeze({
            [randomUUID()]:
              randomUUID(),
          }),
        temporaryEntryIdentity:
          randomUUID(),
      });
  const ledger =
    await openRuntimeLedger(
      runtime,
    );
  try {
    await ledger.transaction(
      async (transaction) => {
        transaction.write({
          kind: "blobManifest",
          blobRef,
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
        });
        transaction.write({
          kind:
            "documentRevision",
          id: revisionId,
          workId:
            baseline.workId,
          documentId:
            baseline
              .documentId,
          parentRevisionId:
            baseline
              .revisionId,
          contentRef: blobRef,
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
        });
      },
    );
  } finally {
    ledger.close();
  }
  return Object.freeze({
    revisionId,
    checksumValue:
      content.address
        .checksumValue,
  });
}

describe(
  "POC-3 backup core",
  () => {
    it(
      "creates a complete bundle and restores it into a new empty target",
      async () => {
        const fixture =
          await loadFixture();
        const runtime =
          await createRuntimeProfile();

        const created =
          await createNodeSqliteBackupBundle(
            runtime.createInput,
          );

        expect(
          created.manifest.counts,
        ).toEqual(
          fixture.emptyCounts,
        );
        expect(
          JSON.stringify(
            created.manifest,
          ),
        ).not.toContain(
          runtime.sourceDatabasePath,
        );
        expect(
          await pathExists(
            runtime
              .createInput
              .temporaryBundleRoot,
          ),
        ).toBe(false);
        expect(
          await pathExists(
            runtime
              .createInput
              .finalBundleRoot,
          ),
        ).toBe(true);
        const bundleDatabasePath =
          join(
            runtime
              .createInput
              .finalBundleRoot,
            ...runtime
              .createInput
              .layout
              .databaseEntrySegments,
          );
        const bundleFingerprintBeforeRestore =
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          );
        for (
          const sidecarPath
          of transientSqliteSidecarPaths(
            bundleDatabasePath,
          )
        ) {
          expect(
            await pathExists(
              sidecarPath,
            ),
          ).toBe(false);
        }

        const restored =
          await restoreNodeSqliteBackupBundle(
            runtime.restoreInput,
          );

        expect(
          runtime.preflightChecks,
        ).toEqual(
          new Set([
            "capacity",
            "authorization",
          ]),
        );
        expect(
          runtime
            .preflightRequiredBytes,
        ).toHaveLength(1);
        expect(
          runtime
            .preflightRequiredBytes[
              0
            ],
        ).toBeGreaterThan(0);
        expect(
          restored.restoredCounts,
        ).toEqual(
          fixture.emptyCounts,
        );
        expect(
          restored.logicalChecksums,
        ).toEqual(
          created
            .manifest
            .logicalChecksums,
        );
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetStagingRoot,
          ),
        ).toBe(false);
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetFinalRoot,
          ),
        ).toBe(true);
        expect(
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          ),
        ).toEqual(
          bundleFingerprintBeforeRestore,
        );
        for (
          const sidecarPath
          of transientSqliteSidecarPaths(
            bundleDatabasePath,
          )
        ) {
          expect(
            await pathExists(
              sidecarPath,
            ),
          ).toBe(false);
        }
      },
    );

    it(
      "pins the snapshot baseline while later source revisions and blobs are excluded",
      async () => {
        const fixture =
          await loadFixture();
        const runtime =
          await createRuntimeProfile();
        const baseline =
          await seedSingleGraph(
            runtime,
            fixture
              .byteMaterialLengths[
                0
              ] ?? 1,
            fixture
              .byteMaterialLengths[
                1
              ] ?? 1,
          );
        const unrelated =
          await runtime
            .sourceBlobStore
            .append({
              bytes:
                randomBytes(
                  fixture
                    .byteMaterialLengths[
                      1
                    ] ?? 1,
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
        await writeFile(
          join(
            runtime
              .sourceTemporaryBlobDirectoryPath,
            unrelatedTemporaryIdentity,
          ),
          randomBytes(
            fixture
              .byteMaterialLengths[
                0
              ] ?? 1,
          ),
        );
        let releaseSnapshot:
          (() => void) | undefined;
        const snapshotReleased =
          new Promise<void>(
            (resolve) => {
              releaseSnapshot =
                resolve;
            },
          );
        let snapshotPinned:
          (() => void) | undefined;
        const snapshotReached =
          new Promise<void>(
            (resolve) => {
              snapshotPinned =
                resolve;
            },
          );
        const createInput =
          Object.freeze({
            ...runtime.createInput,
            stageHook:
              async (stage) => {
                if (
                  stage ===
                  "database-snapshot-pinned"
                ) {
                  snapshotPinned?.();
                  await snapshotReleased;
                }
              },
          }) satisfies
            CreateNodeSqliteBackupBundleInput;
        const creating =
          createNodeSqliteBackupBundle(
            createInput,
          );
        await snapshotReached;
        const later =
          await appendLaterRevision(
            runtime,
            baseline,
            fixture
              .byteMaterialLengths[
                1
              ] ?? 1,
          );
        releaseSnapshot?.();
        const created =
          await creating;

        expect(
          created.manifest.counts,
        ).toEqual(
          fixture.seededCounts,
        );
        expect(
          created
            .manifest
            .revisionReferences
            .map(
              (entry) =>
                entry.revisionId,
            ),
        ).toEqual([
          baseline.revisionId,
        ]);
        expect(
          new Set(
            created.manifest
              .blobs
              .map(
                (entry) =>
                  entry
                    .sourceAddress
                    .checksumValue,
              ),
          ),
        ).toEqual(
          new Set([
            baseline
              .contentChecksumValue,
            baseline
              .changeSetChecksumValue,
          ]),
        );
        expect(
          JSON.stringify(
            created.manifest,
          ),
        ).not.toContain(
          later.revisionId,
        );
        expect(
          JSON.stringify(
            created.manifest,
          ),
        ).not.toContain(
          later.checksumValue,
        );
        expect(
          JSON.stringify(
            created.manifest,
          ),
        ).not.toContain(
          baseline
            .contentPlaintext,
        );
        expect(
          JSON.stringify(
            created.manifest,
          ),
        ).not.toContain(
          unrelated.address
            .checksumValue,
        );
        expect(
          JSON.stringify(
            created.manifest,
          ),
        ).not.toContain(
          unrelatedTemporaryIdentity,
        );
        const bundledDatabaseBytes =
          new Uint8Array(
            await readFile(
              join(
                runtime
                  .createInput
                  .finalBundleRoot,
                ...runtime
                  .createInput
                  .layout
                  .databaseEntrySegments,
              ),
            ),
          );
        expect(
          await runtime
            .createInput
            .checksum
            .checksum(
              bundledDatabaseBytes,
            ),
        ).toBe(
          created.manifest
            .database
            .checksumValue,
        );
        const bundledBlobEntry =
          created.manifest
            .blobs[0];
        expect(
          bundledBlobEntry,
        ).toBeDefined();
        if (
          bundledBlobEntry !==
            undefined
        ) {
          const bundledBlobBytes =
            new Uint8Array(
              await readFile(
                join(
                  runtime
                    .createInput
                    .finalBundleRoot,
                  ...bundledBlobEntry
                    .bundleRelativeSegments,
                ),
              ),
            );
          expect(
            await runtime
              .createInput
              .checksum
              .checksum(
                bundledBlobBytes,
              ),
          ).toBe(
            bundledBlobEntry
              .checksumValue,
          );
        }

        const restored =
          await restoreNodeSqliteBackupBundle(
            runtime.restoreInput,
          );

        expect(
          restored.restoredCounts,
        ).toEqual(
          fixture.seededCounts,
        );
        expect(
          restored.logicalChecksums,
        ).toEqual(
          created
            .manifest
            .logicalChecksums,
        );
        expect(
          new Uint8Array(
            await readFile(
              join(
                runtime
                  .restoreInput
                  .targetFinalRoot,
                ...runtime
                  .restoreInput
                  .targetLayout
                  .databaseEntrySegments,
              ),
            ),
          ),
        ).toEqual(
          bundledDatabaseBytes,
        );
        expect(
          runtime
            .preflightRequiredBytes,
        ).toEqual([
          created.manifest
            .database
            .byteLength +
            created.manifest
              .blobs
              .reduce(
                (
                  total,
                  entry,
                ) =>
                  total +
                  entry
                    .byteLength,
                0,
              ),
        ]);
        const restoredBlob =
          created.manifest.blobs
            .find(
              (entry) =>
                entry
                  .sourceAddress
                  .checksumValue ===
                baseline
                  .contentChecksumValue,
            );
        expect(
          restoredBlob,
        ).toBeDefined();
        if (
          restoredBlob !==
            undefined
        ) {
          const targetBlobPath =
            join(
              runtime
                .restoreInput
                .targetFinalRoot,
              ...runtime
                .restoreInput
                .targetLayout
                .blobEntrySegments(
                  restoredBlob
                    .sourceAddress,
                ),
            );
          expect(
            new Uint8Array(
              await readFile(
                targetBlobPath,
              ),
            ),
          ).toEqual(
            baseline
              .contentBytes,
          );
        }
        const restoredChangeSet =
          created.manifest.blobs
            .find(
              (entry) =>
                entry
                  .sourceAddress
                  .checksumValue ===
                baseline
                  .changeSetChecksumValue,
            );
        expect(
          restoredChangeSet,
        ).toBeDefined();
        if (
          restoredChangeSet !==
            undefined &&
          baseline.changeSetBytes !==
            undefined
        ) {
          expect(
            new Uint8Array(
              await readFile(
                join(
                  runtime
                    .restoreInput
                    .targetFinalRoot,
                  ...runtime
                    .restoreInput
                    .targetLayout
                    .blobEntrySegments(
                      restoredChangeSet
                        .sourceAddress,
                    ),
                ),
              ),
            ),
          ).toEqual(
            baseline
              .changeSetBytes,
          );
        }
      },
    );

    it(
      "rejects a canonically re-signed manifest with an unknown nested field",
      async () => {
        const runtime =
          await createRuntimeProfile();
        const created =
          await createNodeSqliteBackupBundle(
            runtime.createInput,
          );
        const unknownField =
          randomUUID();
        const modified =
          Object.freeze({
            ...created.manifest,
            database:
              Object.freeze({
                ...created
                  .manifest
                  .database,
                [unknownField]:
                  randomUUID(),
              }),
          }) as
            NodeSqliteBackupManifest;
        const manifestBytes =
          runtime
            .createInput
            .manifestCodec
            .encodeCanonical(
              modified,
            );
        const checksumValue =
          await runtime
            .createInput
            .checksum
            .checksum(
              manifestBytes,
            );
        const sidecarBytes =
          runtime
            .createInput
            .canonicalBytes
            .encode({
              checksumIdentity:
                runtime
                  .createInput
                  .checksum
                  .identity,
              checksumValue,
              byteLength:
                manifestBytes
                  .byteLength,
              manifestEntrySegments:
                runtime
                  .createInput
                  .layout
                  .manifestEntrySegments,
            });
        await writeFile(
          join(
            runtime
              .createInput
              .finalBundleRoot,
            ...runtime
              .createInput
              .layout
              .manifestEntrySegments,
          ),
          manifestBytes,
        );
        await writeFile(
          join(
            runtime
              .createInput
              .finalBundleRoot,
            ...runtime
              .createInput
              .layout
              .manifestChecksumEntrySegments,
          ),
          sidecarBytes,
        );

        await expect(
          restoreNodeSqliteBackupBundle(
            runtime.restoreInput,
          ),
        ).rejects.toThrow();
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetFinalRoot,
          ),
        ).toBe(false);
      },
    );

    it.each(
      [
        "sidecar",
        "manifest",
        "database",
        "blob",
      ] as const,
    )(
      "rejects a damaged %s before preflight or target creation without mutating the bundle",
      async (damagedEntry) => {
        const fixture =
          await loadFixture();
        const runtime =
          await createRuntimeProfile();
        await seedSingleGraph(
          runtime,
          fixture
            .byteMaterialLengths[
              0
            ] ?? 1,
        );
        const created =
          await createNodeSqliteBackupBundle(
            runtime.createInput,
          );
        const blob =
          created.manifest
            .blobs[0];
        if (
          damagedEntry ===
            "blob" &&
          blob === undefined
        ) {
          throw new Error(
            "Seeded bundle blob is missing",
          );
        }
        const segments =
          damagedEntry ===
            "sidecar"
            ? runtime
              .createInput
              .layout
              .manifestChecksumEntrySegments
            : damagedEntry ===
              "manifest"
              ? runtime
                .createInput
                .layout
                .manifestEntrySegments
              : damagedEntry ===
                "database"
                ? runtime
                  .createInput
                  .layout
                  .databaseEntrySegments
                : blob
                  ?.bundleRelativeSegments ??
                  [];
        await flipOneByte(
          join(
            runtime
              .createInput
              .finalBundleRoot,
            ...segments,
          ),
        );
        const damagedFingerprint =
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          );

        await expect(
          restoreNodeSqliteBackupBundle(
            runtime.restoreInput,
          ),
        ).rejects.toThrow();

        expect(
          runtime
            .preflightRequiredBytes,
        ).toHaveLength(0);
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetStagingRoot,
          ),
        ).toBe(false);
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetFinalRoot,
          ),
        ).toBe(false);
        expect(
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          ),
        ).toEqual(
          damagedFingerprint,
        );
      },
    );

    it(
      "rejects a missing required bundle blob before preflight and target creation",
      async () => {
        const fixture =
          await loadFixture();
        const runtime =
          await createRuntimeProfile();
        await seedSingleGraph(
          runtime,
          fixture
            .byteMaterialLengths[
              0
            ] ?? 1,
        );
        const created =
          await createNodeSqliteBackupBundle(
            runtime.createInput,
          );
        const blob =
          created.manifest
            .blobs[0];
        if (blob === undefined) {
          throw new Error(
            "Seeded bundle blob is missing",
          );
        }
        await rm(
          join(
            runtime
              .createInput
              .finalBundleRoot,
            ...blob
              .bundleRelativeSegments,
          ),
        );
        const missingFingerprint =
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          );

        await expect(
          restoreNodeSqliteBackupBundle(
            runtime.restoreInput,
          ),
        ).rejects.toThrow();

        expect(
          runtime
            .preflightRequiredBytes,
        ).toHaveLength(0);
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetStagingRoot,
          ),
        ).toBe(false);
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetFinalRoot,
          ),
        ).toBe(false);
        expect(
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          ),
        ).toEqual(
          missingFingerprint,
        );
      },
    );

    it.each(
      [
        "capacity",
        "authorization",
      ] as const,
    )(
      "keeps the verified bundle and target unchanged when caller %s preflight rejects",
      async (rejectedCheck) => {
        const fixture =
          await loadFixture();
        const runtime =
          await createRuntimeProfile();
        await seedSingleGraph(
          runtime,
          fixture
            .byteMaterialLengths[
              0
            ] ?? 1,
        );
        await createNodeSqliteBackupBundle(
          runtime.createInput,
        );
        const bundleFingerprint =
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          );
        const requiredBytes:
          number[] = [];
        const restoreInput =
          Object.freeze({
            ...runtime.restoreInput,
            preflight:
              Object.freeze({
                preflight:
                  async (
                    input:
                      NodeSqliteRestorePreflightInput,
                  ) => {
                    expect(
                      await pathExists(
                        runtime
                          .restoreInput
                          .targetStagingRoot,
                      ),
                    ).toBe(false);
                    expect(
                      await pathExists(
                        runtime
                          .restoreInput
                          .targetFinalRoot,
                      ),
                    ).toBe(false);
                    requiredBytes.push(
                      input
                        .requiredByteCount,
                    );
                    throw new Error(
                      rejectedCheck,
                    );
                  },
              }),
          }) satisfies
            RestoreNodeSqliteBackupBundleInput;

        await expect(
          restoreNodeSqliteBackupBundle(
            restoreInput,
          ),
        ).rejects.toThrow(
          rejectedCheck,
        );

        expect(
          requiredBytes,
        ).toHaveLength(1);
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetStagingRoot,
          ),
        ).toBe(false);
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetFinalRoot,
          ),
        ).toBe(false);
        expect(
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          ),
        ).toEqual(
          bundleFingerprint,
        );
      },
    );

    it.each(
      [
        "database-snapshot-pinned",
        "before-blob-copy",
        "before-bundle-publish",
      ] as const,
    )(
      "leaves source storage unchanged and publishes no final bundle when create hook %s rejects",
      async (rejectedStage) => {
        const fixture =
          await loadFixture();
        const runtime =
          await createRuntimeProfile();
        const baseline =
          await seedSingleGraph(
            runtime,
            fixture
              .byteMaterialLengths[
                0
              ] ?? 1,
          );
        const databaseBefore =
          new Uint8Array(
            await readFile(
              runtime
                .sourceDatabasePath,
            ),
          );
        const blobBefore =
          await runtime
            .sourceBlobStore
            .readExact({
              checksumIdentity:
                runtime
                  .storageChecksumIdentity,
              checksumValue:
                baseline
                  .contentChecksumValue,
            });
        const sourceBlobFingerprint =
          await treeFingerprint(
            runtime
              .sourceBlobRootDirectoryPath,
          );
        const rejection =
          randomUUID();
        const createInput =
          Object.freeze({
            ...runtime.createInput,
            stageHook:
              async (stage) => {
                if (
                  stage ===
                  rejectedStage
                ) {
                  throw new Error(
                    rejection,
                  );
                }
              },
          }) satisfies
            CreateNodeSqliteBackupBundleInput;

        await expect(
          createNodeSqliteBackupBundle(
            createInput,
          ),
        ).rejects.toThrow(
          rejection,
        );

        expect(
          new Uint8Array(
            await readFile(
              runtime
                .sourceDatabasePath,
            ),
          ),
        ).toEqual(
          databaseBefore,
        );
        expect(
          (
            await runtime
              .sourceBlobStore
              .readExact({
                checksumIdentity:
                  runtime
                    .storageChecksumIdentity,
                checksumValue:
                  baseline
                    .contentChecksumValue,
              })
          ).bytes,
        ).toEqual(
          blobBefore.bytes,
        );
        expect(
          await treeFingerprint(
            runtime
              .sourceBlobRootDirectoryPath,
          ),
        ).toEqual(
          sourceBlobFingerprint,
        );
        expect(
          await pathExists(
            runtime
              .createInput
              .temporaryBundleRoot,
          ),
        ).toBe(false);
        expect(
          await pathExists(
            runtime
              .createInput
              .finalBundleRoot,
          ),
        ).toBe(false);
      },
    );

    it.each(
      [
        "-wal",
        "-shm",
        "-journal",
      ] as const,
    )(
      "rejects an unmanifested transient database sidecar %s before bundle publication",
      async (sidecarSuffix) => {
        const runtime =
          await createRuntimeProfile();
        const snapshotPath =
          join(
            runtime
              .createInput
              .temporaryBundleRoot,
            ...runtime
              .createInput
              .layout
              .databaseEntrySegments,
          );
        const createInput =
          Object.freeze({
            ...runtime.createInput,
            stageHook:
              async (stage) => {
                if (
                  stage ===
                  "before-bundle-publish"
                ) {
                  await writeFile(
                    `${snapshotPath}${sidecarSuffix}`,
                    randomBytes(
                      randomInt(1, 64),
                    ),
                  );
                }
              },
          }) satisfies
            CreateNodeSqliteBackupBundleInput;

        await expect(
          createNodeSqliteBackupBundle(
            createInput,
          ),
        ).rejects.toThrow(
          /transient SQLite sidecar/u,
        );

        expect(
          await pathExists(
            runtime
              .createInput
              .temporaryBundleRoot,
          ),
        ).toBe(false);
        expect(
          await pathExists(
            runtime
              .createInput
              .finalBundleRoot,
          ),
        ).toBe(false);
      },
    );

    it(
      "does not overwrite a final bundle created at the publication boundary",
      async () => {
        const runtime =
          await createRuntimeProfile();
        const markerSegment =
          randomUUID();
        const markerBytes =
          randomBytes(
            randomInt(1, 64),
          );
        const createInput =
          Object.freeze({
            ...runtime.createInput,
            stageHook:
              async (stage) => {
                if (
                  stage ===
                  "before-bundle-publish"
                ) {
                  await mkdir(
                    runtime
                      .createInput
                      .finalBundleRoot,
                  );
                  await writeFile(
                    join(
                      runtime
                        .createInput
                        .finalBundleRoot,
                      markerSegment,
                    ),
                    markerBytes,
                  );
                }
              },
          }) satisfies
            CreateNodeSqliteBackupBundleInput;

        await expect(
          createNodeSqliteBackupBundle(
            createInput,
          ),
        ).rejects.toThrow();

        expect(
          await readFile(
            join(
              runtime
                .createInput
                .finalBundleRoot,
              markerSegment,
            ),
          ),
        ).toEqual(
          markerBytes,
        );
        expect(
          await pathExists(
            runtime
              .createInput
              .temporaryBundleRoot,
          ),
        ).toBe(false);
      },
    );

    it.each(
      [
        "bundle-verified",
        "before-target-publish",
      ] as const,
    )(
      "keeps the bundle and unrelated target sibling unchanged when restore hook %s rejects",
      async (rejectedStage) => {
        const runtime =
          await createRuntimeProfile();
        await createNodeSqliteBackupBundle(
          runtime.createInput,
        );
        const bundleFingerprint =
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          );
        const siblingRoot =
          join(
            dirname(
              runtime
                .restoreInput
                .targetFinalRoot,
            ),
            randomUUID(),
          );
        const markerSegment =
          randomUUID();
        const markerBytes =
          randomBytes(
            randomInt(1, 64),
          );
        await mkdir(siblingRoot);
        await writeFile(
          join(
            siblingRoot,
            markerSegment,
          ),
          markerBytes,
        );
        const rejection =
          randomUUID();
        const restoreInput =
          Object.freeze({
            ...runtime.restoreInput,
            stageHook:
              async (stage) => {
                if (
                  stage ===
                  rejectedStage
                ) {
                  throw new Error(
                    rejection,
                  );
                }
              },
          }) satisfies
            RestoreNodeSqliteBackupBundleInput;

        await expect(
          restoreNodeSqliteBackupBundle(
            restoreInput,
          ),
        ).rejects.toThrow(
          rejection,
        );

        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetStagingRoot,
          ),
        ).toBe(false);
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetFinalRoot,
          ),
        ).toBe(false);
        expect(
          await readFile(
            join(
              siblingRoot,
              markerSegment,
            ),
          ),
        ).toEqual(
          markerBytes,
        );
        expect(
          await treeFingerprint(
            runtime
              .createInput
              .finalBundleRoot,
          ),
        ).toEqual(
          bundleFingerprint,
        );
      },
    );

    it(
      "does not overwrite a final restore target created at the publication boundary",
      async () => {
        const runtime =
          await createRuntimeProfile();
        await createNodeSqliteBackupBundle(
          runtime.createInput,
        );
        const markerSegment =
          randomUUID();
        const markerBytes =
          randomBytes(
            randomInt(1, 64),
          );
        const restoreInput =
          Object.freeze({
            ...runtime.restoreInput,
            stageHook:
              async (stage) => {
                if (
                  stage ===
                  "before-target-publish"
                ) {
                  await mkdir(
                    runtime
                      .restoreInput
                      .targetFinalRoot,
                  );
                  await writeFile(
                    join(
                      runtime
                        .restoreInput
                        .targetFinalRoot,
                      markerSegment,
                    ),
                    markerBytes,
                  );
                }
              },
          }) satisfies
            RestoreNodeSqliteBackupBundleInput;

        await expect(
          restoreNodeSqliteBackupBundle(
            restoreInput,
          ),
        ).rejects.toThrow();

        expect(
          await readFile(
            join(
              runtime
                .restoreInput
                .targetFinalRoot,
              markerSegment,
            ),
          ),
        ).toEqual(
          markerBytes,
        );
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetStagingRoot,
          ),
        ).toBe(false);
      },
    );

    it(
      "never removes a caller staging root that existed before restore",
      async () => {
        const runtime =
          await createRuntimeProfile();
        await createNodeSqliteBackupBundle(
          runtime.createInput,
        );
        const markerSegment =
          randomUUID();
        const markerBytes =
          randomBytes(
            randomInt(1, 64),
          );
        await mkdir(
          runtime
            .restoreInput
            .targetStagingRoot,
        );
        await writeFile(
          join(
            runtime
              .restoreInput
              .targetStagingRoot,
            markerSegment,
          ),
          markerBytes,
        );

        await expect(
          restoreNodeSqliteBackupBundle(
            runtime.restoreInput,
          ),
        ).rejects.toThrow();

        expect(
          await readFile(
            join(
              runtime
                .restoreInput
                .targetStagingRoot,
              markerSegment,
            ),
          ),
        ).toEqual(
          markerBytes,
        );
        expect(
          await pathExists(
            runtime
              .restoreInput
              .targetFinalRoot,
          ),
        ).toBe(false);
      },
    );
  },
);
