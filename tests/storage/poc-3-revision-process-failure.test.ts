import {
  createHash,
  getHashes,
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
import type {
  Poc3LedgerRecord,
} from "../../src/domain/poc-3-storage-ledger";
import {
  entityId,
} from "../../src/domain/writing";
import {
  parsePoc3RevisionCrashGateProfile,
  type Poc3RevisionCrashGateProfile,
  checksumPoc3RevisionCrashGateProfile,
} from "../../src/desktop/poc-3-revision-crash-gate-profile";
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

type LedgerFixture = {
  readonly requestedSettings:
    Record<string, unknown>;
  readonly targetSchemaVersion:
    number;
};

type RevisionFixture = {
  readonly counts: {
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
  ) => AuditDatabase;
};

type LogicalDatabaseSnapshot = {
  readonly counts:
    Readonly<Record<string, number>>;
  readonly checksumValue: string;
};

const callerDeadlineValue =
  process.env
    .EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS;
const callerDeadline =
  callerDeadlineValue === undefined
    ? Number.NaN
    : Number(callerDeadlineValue);
if (
  !Number.isSafeInteger(callerDeadline) ||
  callerDeadline <= Date.now()
) {
  throw new Error(
    "EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS must be a future epoch millisecond safe integer",
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

function createRevisionBlobProfile(
  input:
    Poc3RevisionCrashGateProfile[
      "revisionBlobProfile"
    ],
): RevisionBlobProfile {
  if (!Buffer.isEncoding(input.encoding)) {
    throw new Error(
      `Unsupported caller encoding: ${input.encoding}`,
    );
  }
  const encoding =
    input.encoding as BufferEncoding;
  return Object.freeze({
    codec: Object.freeze({
      identity:
        input.codecIdentity,
      encode: (content: string) =>
        Uint8Array.from(
          Buffer.from(
            content,
            encoding,
          ),
        ),
      decode: (bytes: Uint8Array) =>
        Buffer.from(bytes)
          .toString(encoding),
      describe: (content: string) => {
        const bytes = Buffer.from(
          content,
          encoding,
        );
        const length =
          bytes.byteLength +
          input.contentLengthOffset;
        if (
          !Number.isSafeInteger(length)
        ) {
          throw new Error(
            "Caller revision length is not a safe integer",
          );
        }
        return Object.freeze({
          contentHash:
            createHash(
              input
                .contentHashAlgorithm,
            )
              .update(bytes)
              .digest("hex"),
          length,
        });
      },
    }),
    blobRefForAddress: (address) =>
      JSON.stringify([
        input
          .blobReferenceIdentity,
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
          input
            .blobReferenceIdentity ||
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
      input.metadata,
    temporaryEntryIdentityForAppend:
      () =>
        input
          .temporaryEntryIdentity,
    manifestMetadataForAppend:
      () =>
        input.manifestMetadata,
  });
}

function createAppendInput(input: {
  readonly revisionId: string;
  readonly identities:
    RuntimeIdentities;
  readonly expectedCurrentRevisionId:
    string | null;
  readonly content: string;
  readonly clock: RuntimeClock;
}): AppendRevisionInput {
  return Object.freeze({
    revisionId:
      entityId<"DocumentRevision">(
        input.revisionId,
      ),
    workId: entityId<"Work">(
      input.identities.workId,
    ),
    documentId:
      entityId<"Document">(
        input.identities.documentId,
      ),
    expectedCurrentRevisionId:
      input.expectedCurrentRevisionId ===
      null
        ? null
        : entityId<"DocumentRevision">(
            input
              .expectedCurrentRevisionId,
          ),
    content: input.content,
    cause: randomUUID(),
    createdAt:
      input.clock.instant(),
    durableAt:
      input.clock.instant(),
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
    ...blobProfile
      .manifestMetadataForAppend(
        input,
      ),
  });
}

function createSeedRecords(input: {
  readonly identities:
    RuntimeIdentities;
  readonly revisionInput:
    AppendRevisionInput;
  readonly blobProfile:
    RevisionBlobProfile;
  readonly manifest:
    Awaited<
      ReturnType<
        typeof publishSeedBlob
      >
    >;
  readonly targetSchemaVersion:
    number;
  readonly clock: RuntimeClock;
}): readonly Poc3LedgerRecord[] {
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
        identities.activityPolicyId,
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
        clock.revision() % 2 === 0,
      autoResumeFromIdle:
        clock.revision() % 2 === 0,
      recoveryPolicy:
        randomUUID(),
    },
    {
      kind: "focusPolicy",
      ...meta(),
      id: identities.focusPolicyId,
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
        identities.activityPolicyId,
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
      ...(revisionInput
        .changeSetRef ===
      undefined
        ? {}
        : {
            changeSetRef:
              revisionInput
                .changeSetRef,
          }),
      cause: revisionInput.cause,
      createdAt:
        revisionInput.createdAt,
      durableAt:
        revisionInput.durableAt,
    },
    {
      kind: "manuscript",
      id: identities.manuscriptId,
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

function loadAuditModule():
AuditModule {
  const module =
    process.getBuiltinModule(
      "node:sqlite",
    ) as AuditModule | undefined;
  if (module === undefined) {
    throw new Error(
      "Current runtime has no node:sqlite audit connection",
    );
  }
  return module;
}

function quoteIdentifier(
  identifier: string,
): string {
  return `"${identifier.replaceAll(
    "\"",
    "\"\"",
  )}"`;
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
  const { DatabaseSync } =
    loadAuditModule();
  const database =
    new DatabaseSync(databasePath);
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
            "SQLite schema returned an invalid table name",
          );
        }
        const quoted =
          quoteIdentifier(tableName);
        const columnRows =
          database.prepare(
            `PRAGMA table_info(${quoted})`,
          ).all();
        const columns =
          columnRows.map((row) => {
            if (
              typeof row.name !==
                "string" ||
              row.name.length === 0
            ) {
              throw new Error(
                "SQLite schema returned an invalid column name",
              );
            }
            return row.name;
          });
        const rows =
          database.prepare(
            `SELECT * FROM ${quoted}`,
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
  parameters:
    readonly unknown[] = [],
): readonly Record<string, unknown>[] {
  const { DatabaseSync } =
    loadAuditModule();
  const database =
    new DatabaseSync(databasePath);
  try {
    return database.prepare(sql)
      .all(...parameters);
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
            "Caller deadline elapsed before worker ready",
          ),
        );
        return;
      }
      const timer = setTimeout(
        () => {
          cleanup();
          rejectNow(
            new Error(
              "Caller deadline elapsed before worker ready",
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
              "poc-3-revision-crash-worker-ready"
          ) {
            cleanup();
            resolveNow();
          }
        };
      const handleExit = () => {
        cleanup();
        rejectNow(
          new Error(
            "Revision crash worker exited before ready",
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
      child.on("exit", handleExit);
    },
  );
}

async function waitForMarker(
  markerPath: string,
  child: ChildProcess,
  deadline: number,
): Promise<readonly unknown[]> {
  let workerFailure: string | null =
    null;
  const handleMessage =
    (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        Reflect.get(
          message,
          "type",
        ) ===
          "poc-3-revision-crash-worker-failed"
      ) {
        workerFailure = String(
          Reflect.get(
            message,
            "errorName",
          ),
        );
      }
    };
  child.on("message", handleMessage);
  try {
    for (;;) {
      if (Date.now() >= deadline) {
        throw new Error(
          "Caller deadline elapsed before durable marker",
        );
      }
      if (workerFailure !== null) {
        throw new Error(
          `Revision crash worker failed before marker: ${workerFailure}`,
        );
      }
      if (
        child.exitCode !== null ||
        child.signalCode !== null
      ) {
        throw new Error(
          "Revision crash worker exited before durable marker",
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
          (error as NodeJS.ErrnoException)
            .code !== "ENOENT"
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
  child: ChildProcess,
  exitObservation:
    Promise<readonly unknown[]>,
  deadline: number,
): Promise<readonly unknown[]> {
  const remaining =
    deadline - Date.now();
  if (remaining <= 0) {
    throw new Error(
      "Caller deadline elapsed before worker exit",
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
            () =>
              rejectNow(
                new Error(
                  "Caller deadline elapsed before worker exit",
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

function addressReachableInDatabase(
  databasePath: string,
  address: BlobAddress,
): boolean {
  const rows = auditRows(
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
  );
  return (
    rows.length === 1 &&
    rows[0]?.count === 1
  );
}

describe(
  "POC-3 RevisionStore process failure",
  () => {
    it(
      "keeps the durable revision graph unchanged and leaves only a verified unreachable physical blob when the writer is terminated before database commit",
      async () => {
        const ledgerFixture =
          await readJsonFixture<
            LedgerFixture
          >(
            "../fixtures/storage/poc-3-ledger.manifest.json",
          );
        const revisionFixture =
          await readJsonFixture<
            RevisionFixture
          >(
            "../fixtures/storage/poc-3-revision-store.manifest.json",
          );
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const resolvedTemporaryRoot =
          resolve(temporaryRoot);
        const resolvedOsTemporaryRoot =
          resolve(tmpdir());
        if (
          resolvedTemporaryRoot ===
            resolvedOsTemporaryRoot ||
          !resolvedTemporaryRoot.startsWith(
            `${resolvedOsTemporaryRoot}${sep}`,
          )
        ) {
          throw new Error(
            "Process-failure directory is outside the verified OS temporary path",
          );
        }
        const clock =
          createRuntimeClock();
        const identities =
          createRuntimeIdentities();
        const checksumAlgorithm =
          selectRuntimeHash();
        const callerChecksumAlgorithm =
          selectRuntimeHash();
        const checksumIdentity =
          randomUUID();
        const callerChecksumIdentity =
          randomUUID();
        const shardWidths =
          Array.from(
            {
              length:
                revisionFixture.counts
                  .publishedShardCount,
            },
            () =>
              revisionFixture.counts
                .publishedShardWidth,
          );
        const blobStoreProfile =
          parseNodeImmutableBlobStoreProfile(
            {
              rootDirectoryPath:
                join(
                  temporaryRoot,
                  randomUUID(),
                ),
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
          );
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
        const revisionBlobProfileInput =
          Object.freeze({
            codecIdentity:
              randomUUID(),
            encoding:
              new TextEncoder()
                .encoding,
            contentHashAlgorithm:
              selectRuntimeHash(),
            contentLengthOffset:
              clock.revision(),
            blobReferenceIdentity:
              randomUUID(),
            metadata:
              Object.freeze({
                [randomUUID()]:
                  randomUUID(),
              }),
            temporaryEntryIdentity:
              randomUUID(),
            manifestMetadata:
              Object.freeze({
                createdAt:
                  clock.instant(),
                mediaType:
                  randomUUID(),
                originalName:
                  randomUUID(),
              }),
          });
        const blobProfile =
          createRevisionBlobProfile(
            revisionBlobProfileInput,
          );
        const blobStore =
          await createNodeImmutableBlobStore(
            blobStoreProfile,
          );
        const baselineRevisionId =
          randomUUID();
        const baselineContent =
          runtimeText(
            revisionFixture.counts
              .contentPartCount,
          );
        const baselineInput =
          createAppendInput({
            revisionId:
              baselineRevisionId,
            identities,
            expectedCurrentRevisionId:
              null,
            content:
              baselineContent,
            clock,
          });
        const seedManifest =
          await publishSeedBlob(
            blobStore,
            blobProfile,
            baselineInput,
          );
        let ledger =
          await openNodeSqliteLedger(
            storageOpenProfile,
          );
        let child:
          ChildProcess | undefined;
        try {
          const seedRecords =
            createSeedRecords({
              identities,
              revisionInput:
                baselineInput,
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
          ledger.close();

          const baselineLogical =
            logicalDatabaseSnapshot(
              storageOpenProfile
                .databasePath,
              callerChecksumAlgorithm,
            );
          const baselinePointers =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  current_revision_id AS "currentRevisionId",
                  durable_revision_id AS "durableRevisionId"
                FROM manuscripts
                WHERE document_id = ?
              `,
              [identities.documentId],
            );
          const baselineRevisions =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM document_revisions
                ORDER BY id
              `,
            );
          const baselineManifests =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM blob_manifests
                ORDER BY blob_ref
              `,
            );
          const baselineInventory =
            await blobStore.inventory({
              isReachable: async (
                address,
              ) =>
                addressReachableInDatabase(
                  storageOpenProfile
                    .databasePath,
                  address,
                ),
            });

          const failedRevisionId =
            randomUUID();
          const failedContent =
            runtimeText(
              revisionFixture.counts
                .contentPartCount,
            );
          const failedInput =
            createAppendInput({
              revisionId:
                failedRevisionId,
              identities,
              expectedCurrentRevisionId:
                baselineRevisionId,
              content: failedContent,
              clock,
            });
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
            parsePoc3RevisionCrashGateProfile(
              {
                schemaVersion: 1,
                scenarioId:
                  randomUUID(),
                reachedPath:
                  markerPath,
                reachedTemporaryPath:
                  markerTemporaryPath,
                storageOpenProfile,
                blobStoreProfile,
                revisionBlobProfile:
                  revisionBlobProfileInput,
                appendInput: {
                  revisionId:
                    failedInput.revisionId,
                  workId:
                    failedInput.workId,
                  documentId:
                    failedInput.documentId,
                  expectedCurrentRevisionId:
                    failedInput
                      .expectedCurrentRevisionId,
                  content:
                    failedInput.content,
                  cause:
                    failedInput.cause,
                  createdAt:
                    failedInput
                      .createdAt,
                  durableAt:
                    failedInput
                      .durableAt,
                },
              },
            );
          expect(() =>
            parsePoc3RevisionCrashGateProfile({
              ...profile,
              [randomUUID()]:
                randomUUID(),
            }),
          ).toThrow(/Unsupported/);
          const callerChecksumValue =
            checksumPoc3RevisionCrashGateProfile(
              profile,
              callerChecksumAlgorithm,
            );
          const workerPath =
            join(
              process.cwd(),
              "dist-electron",
              "desktop",
              "poc-3-revision-crash-worker.js",
            );
          child = fork(
            workerPath,
            [],
            {
              cwd: process.cwd(),
              env: {
                ...process.env,
                EUM_STUDIO_POC_3_REVISION_CRASH_WORKER:
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
              "poc-3-revision-crash-worker-run",
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
            "poc-3-revision-crash-gate-reached",
            profile.schemaVersion,
            profile.scenarioId,
            profile.appendInput
              .revisionId,
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
              "Revision crash worker has no PID",
            );
          }
          expect(() =>
            process.kill(childPid, 0),
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
              child,
              exitObservation,
              callerDeadline,
            );
          expect(exit.length).toBe(2);
          expect(
            child.exitCode !== null ||
              child.signalCode !== null,
          ).toBe(true);
          child = undefined;

          ledger =
            await openNodeSqliteLedger(
              storageOpenProfile,
            );
          const reopenedStore =
            ledger.createRevisionStore({
              blobStore,
              blobProfile,
            });
          await expect(
            reopenedStore
              .getCurrentRevision(
                entityId<"Document">(
                  identities.documentId,
                ),
              ),
          ).resolves.toEqual(
            expect.objectContaining({
              id:
                baselineInput
                  .revisionId,
              contentHash:
                blobProfile.codec
                  .describe(
                    baselineContent,
                  )
                  .contentHash,
            }),
          );
          await expect(
            reopenedStore.materialize(
              baselineInput.revisionId,
            ),
          ).resolves.toBe(
            baselineContent,
          );
          await expect(
            reopenedStore.getRevision(
              failedInput.revisionId,
            ),
          ).resolves.toBeNull();
          ledger.close();

          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  current_revision_id AS "currentRevisionId",
                  durable_revision_id AS "durableRevisionId"
                FROM manuscripts
                WHERE document_id = ?
              `,
              [identities.documentId],
            ),
          ).toEqual(
            baselinePointers,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM document_revisions
                ORDER BY id
              `,
            ),
          ).toEqual(
            baselineRevisions,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM blob_manifests
                ORDER BY blob_ref
              `,
            ),
          ).toEqual(
            baselineManifests,
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

          const failedBytes =
            blobProfile.codec.encode(
              failedContent,
            );
          const failedAddress =
            Object.freeze({
              checksumIdentity,
              checksumValue:
                createHash(
                  checksumAlgorithm,
                )
                  .update(failedBytes)
                  .digest("hex"),
            });
          const afterInventory =
            await blobStore.inventory({
              isReachable: async (
                address,
              ) =>
                addressReachableInDatabase(
                  storageOpenProfile
                    .databasePath,
                  address,
                ),
            });
          expect(
            afterInventory.published,
          ).toHaveLength(
            baselineInventory
              .published.length + 1,
          );
          expect(
            afterInventory.temporary,
          ).toEqual([]);
          expect(
            afterInventory.published
              .filter(
                (entry) =>
                  !entry.reachable,
              ),
          ).toEqual([
            expect.objectContaining({
              address:
                failedAddress,
              actualChecksumValue:
                failedAddress
                  .checksumValue,
              byteLength:
                failedBytes.byteLength,
              status: "verified",
              reachable: false,
            }),
          ]);
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
          ledger.close();
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
    it(
      "allows only the holder actual process to commit when two processes append from the same baseline storage",
      async () => {
        const ledgerFixture =
          await readJsonFixture<
            LedgerFixture
          >(
            "../fixtures/storage/poc-3-ledger.manifest.json",
          );
        const revisionFixture =
          await readJsonFixture<
            RevisionFixture
          >(
            "../fixtures/storage/poc-3-revision-store.manifest.json",
          );
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const resolvedTemporaryRoot =
          resolve(temporaryRoot);
        const resolvedOsTemporaryRoot =
          resolve(tmpdir());
        if (
          resolvedTemporaryRoot ===
            resolvedOsTemporaryRoot ||
          !resolvedTemporaryRoot.startsWith(
            `${resolvedOsTemporaryRoot}${sep}`,
          )
        ) {
          throw new Error(
            "Revision race directory is outside the verified OS temporary path",
          );
        }
        const clock =
          createRuntimeClock();
        const identities =
          createRuntimeIdentities();
        const checksumAlgorithm =
          selectRuntimeHash();
        const callerChecksumAlgorithm =
          selectRuntimeHash();
        const checksumIdentity =
          randomUUID();
        const shardWidths =
          Array.from(
            {
              length:
                revisionFixture.counts
                  .publishedShardCount,
            },
            () =>
              revisionFixture.counts
                .publishedShardWidth,
          );
        const blobStoreProfile =
          parseNodeImmutableBlobStoreProfile(
            {
              rootDirectoryPath:
                join(
                  temporaryRoot,
                  randomUUID(),
                ),
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
          );
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
        const commonRevisionBlobProfile =
          Object.freeze({
            codecIdentity:
              randomUUID(),
            encoding:
              new TextEncoder()
                .encoding,
            contentHashAlgorithm:
              selectRuntimeHash(),
            contentLengthOffset:
              clock.revision(),
            blobReferenceIdentity:
              randomUUID(),
            metadata:
              Object.freeze({
                [randomUUID()]:
                  randomUUID(),
              }),
            manifestMetadata:
              Object.freeze({
                createdAt:
                  clock.instant(),
                mediaType:
                  randomUUID(),
                originalName:
                  randomUUID(),
              }),
          });
        const seedTemporaryEntryIdentity =
          randomUUID();
        const holderTemporaryEntryIdentity =
          randomUUID();
        const contenderTemporaryEntryIdentity =
          randomUUID();
        expect(
          new Set([
            seedTemporaryEntryIdentity,
            holderTemporaryEntryIdentity,
            contenderTemporaryEntryIdentity,
          ]).size,
        ).toBe(3);
        const seedRevisionBlobProfileInput =
          Object.freeze({
            ...commonRevisionBlobProfile,
            temporaryEntryIdentity:
              seedTemporaryEntryIdentity,
          });
        const holderRevisionBlobProfileInput =
          Object.freeze({
            ...commonRevisionBlobProfile,
            temporaryEntryIdentity:
              holderTemporaryEntryIdentity,
          });
        const contenderRevisionBlobProfileInput =
          Object.freeze({
            ...commonRevisionBlobProfile,
            temporaryEntryIdentity:
              contenderTemporaryEntryIdentity,
          });
        const blobProfile =
          createRevisionBlobProfile(
            seedRevisionBlobProfileInput,
          );
        const blobStore =
          await createNodeImmutableBlobStore(
            blobStoreProfile,
          );
        const baselineRevisionId =
          randomUUID();
        const baselineContent =
          runtimeText(
            revisionFixture.counts
              .contentPartCount,
          );
        const baselineInput =
          createAppendInput({
            revisionId:
              baselineRevisionId,
            identities,
            expectedCurrentRevisionId:
              null,
            content: baselineContent,
            clock,
          });
        const seedManifest =
          await publishSeedBlob(
            blobStore,
            blobProfile,
            baselineInput,
          );
        let ledger =
          await openNodeSqliteLedger(
            storageOpenProfile,
          );
        let holderChild:
          ChildProcess | undefined;
        let contenderChild:
          ChildProcess | undefined;
        try {
          const seedRecords =
            createSeedRecords({
              identities,
              revisionInput:
                baselineInput,
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
          ledger.close();

          const baselinePointers =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  current_revision_id AS "currentRevisionId",
                  durable_revision_id AS "durableRevisionId"
                FROM manuscripts
                WHERE document_id = ?
              `,
              [identities.documentId],
            );
          const baselineRevisions =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM document_revisions
                ORDER BY id
              `,
            );
          const baselineManifests =
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM blob_manifests
                ORDER BY blob_ref
              `,
            );
          const baselineInventory =
            await blobStore.inventory({
              isReachable: async (
                address,
              ) =>
                addressReachableInDatabase(
                  storageOpenProfile
                    .databasePath,
                  address,
                ),
            });

          const holderInput =
            createAppendInput({
              revisionId:
                randomUUID(),
              identities,
              expectedCurrentRevisionId:
                baselineRevisionId,
              content:
                runtimeText(
                  revisionFixture.counts
                    .contentPartCount,
                ),
              clock,
            });
          const contenderInput =
            createAppendInput({
              revisionId:
                randomUUID(),
              identities,
              expectedCurrentRevisionId:
                baselineRevisionId,
              content:
                runtimeText(
                  revisionFixture.counts
                    .contentPartCount,
                ),
              clock,
            });
          expect(
            holderInput.revisionId,
          ).not.toBe(
            contenderInput.revisionId,
          );
          expect(
            holderInput.content,
          ).not.toBe(
            contenderInput.content,
          );
          const holderProfile =
            parsePoc3RevisionCrashGateProfile(
              {
                schemaVersion: 1,
                scenarioId:
                  randomUUID(),
                reachedPath:
                  join(
                    temporaryRoot,
                    randomUUID(),
                  ),
                reachedTemporaryPath:
                  join(
                    temporaryRoot,
                    randomUUID(),
                  ),
                storageOpenProfile,
                blobStoreProfile,
                revisionBlobProfile:
                  holderRevisionBlobProfileInput,
                appendInput: {
                  revisionId:
                    holderInput.revisionId,
                  workId:
                    holderInput.workId,
                  documentId:
                    holderInput.documentId,
                  expectedCurrentRevisionId:
                    holderInput
                      .expectedCurrentRevisionId,
                  content:
                    holderInput.content,
                  cause:
                    holderInput.cause,
                  createdAt:
                    holderInput
                      .createdAt,
                  durableAt:
                    holderInput
                      .durableAt,
                },
              },
            );
          const contenderProfile =
            parsePoc3RevisionCrashGateProfile(
              {
                schemaVersion: 1,
                scenarioId:
                  randomUUID(),
                reachedPath:
                  join(
                    temporaryRoot,
                    randomUUID(),
                  ),
                reachedTemporaryPath:
                  join(
                    temporaryRoot,
                    randomUUID(),
                  ),
                storageOpenProfile,
                blobStoreProfile,
                revisionBlobProfile:
                  contenderRevisionBlobProfileInput,
                appendInput: {
                  revisionId:
                    contenderInput.revisionId,
                  workId:
                    contenderInput.workId,
                  documentId:
                    contenderInput.documentId,
                  expectedCurrentRevisionId:
                    contenderInput
                      .expectedCurrentRevisionId,
                  content:
                    contenderInput.content,
                  cause:
                    contenderInput.cause,
                  createdAt:
                    contenderInput
                      .createdAt,
                  durableAt:
                    contenderInput
                      .durableAt,
                },
              },
            );
          const holderCallerChecksum = {
            identity: randomUUID(),
            algorithm:
              callerChecksumAlgorithm,
            value:
              checksumPoc3RevisionCrashGateProfile(
                holderProfile,
                callerChecksumAlgorithm,
              ),
          };
          const contenderCallerChecksum = {
            identity: randomUUID(),
            algorithm:
              callerChecksumAlgorithm,
            value:
              checksumPoc3RevisionCrashGateProfile(
                contenderProfile,
                callerChecksumAlgorithm,
              ),
          };
          const workerPath =
            join(
              process.cwd(),
              "dist-electron",
              "desktop",
              "poc-3-revision-race-worker.js",
            );
          const forkRaceWorker = () =>
            fork(
              workerPath,
              [],
              {
                cwd: process.cwd(),
                env: {
                  ...process.env,
                  EUM_STUDIO_POC_3_REVISION_PROCESS_TEST_DEADLINE_EPOCH_MS:
                    String(
                      callerDeadline,
                    ),
                  EUM_STUDIO_POC_3_REVISION_RACE_WORKER:
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
          const waitForRaceWorkerMessage =
            async (
              child: ChildProcess,
              expectedTypes:
                readonly string[],
            ): Promise<
              Record<string, unknown>
            > =>
              new Promise(
                (
                  resolveNow,
                  rejectNow,
                ) => {
                  const remaining =
                    callerDeadline -
                    Date.now();
                  if (remaining <= 0) {
                    rejectNow(
                      new Error(
                        "Caller deadline elapsed before revision race worker message",
                      ),
                    );
                    return;
                  }
                  const expected =
                    new Set(
                      expectedTypes,
                    );
                  const timer:
                    ReturnType<
                      typeof setTimeout
                    > = setTimeout(
                      () => {
                        cleanup();
                        rejectNow(
                          new Error(
                            "Caller deadline elapsed before revision race worker message",
                          ),
                        );
                      },
                      remaining,
                    );
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
                  const handleMessage =
                    (message: unknown) => {
                      if (
                        typeof message ===
                          "object" &&
                        message !== null &&
                        !Array.isArray(
                          message,
                        ) &&
                        expected.has(
                          String(
                            Reflect.get(
                              message,
                              "type",
                            ),
                          ),
                        )
                      ) {
                        cleanup();
                        resolveNow(
                          message as
                            Record<
                              string,
                              unknown
                            >,
                        );
                      }
                    };
                  const handleExit = () => {
                    cleanup();
                    rejectNow(
                      new Error(
                        "Revision race worker exited before expected IPC message",
                      ),
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

          holderChild =
            forkRaceWorker();
          await expect(
            waitForRaceWorkerMessage(
              holderChild,
              [
                "poc-3-revision-race-worker-ready",
              ],
            ),
          ).resolves.toEqual({
            type:
              "poc-3-revision-race-worker-ready",
          });
          const holderHolding =
            waitForRaceWorkerMessage(
              holderChild,
              [
                "poc-3-revision-race-worker-holding",
              ],
            );
          holderChild.send({
            type:
              "poc-3-revision-race-worker-run",
            role: "holder",
            callerChecksum:
              holderCallerChecksum,
            profile:
              holderProfile,
          });
          const [
            marker,
            holding,
          ] = await Promise.all([
            waitForMarker(
              holderProfile.reachedPath,
              holderChild,
              callerDeadline,
            ),
            holderHolding,
          ]);
          expect(holding).toEqual({
            type:
              "poc-3-revision-race-worker-holding",
          });
          expect(marker).toEqual([
            "poc-3-revision-crash-gate-reached",
            holderProfile.schemaVersion,
            holderProfile.scenarioId,
            holderProfile.appendInput
              .revisionId,
            holderCallerChecksum
              .identity,
            holderCallerChecksum.value,
          ]);
          await expect(
            lstat(
              holderProfile
                .reachedTemporaryPath,
            ),
          ).rejects.toMatchObject({
            code: "ENOENT",
          });
          const holderPid =
            holderChild.pid;
          if (holderPid === undefined) {
            throw new Error(
              "Revision race holder has no PID",
            );
          }
          expect(() =>
            process.kill(holderPid, 0),
          ).not.toThrow();

          contenderChild =
            forkRaceWorker();
          await expect(
            waitForRaceWorkerMessage(
              contenderChild,
              [
                "poc-3-revision-race-worker-ready",
              ],
            ),
          ).resolves.toEqual({
            type:
              "poc-3-revision-race-worker-ready",
          });
          const contenderTerminal =
            waitForRaceWorkerMessage(
              contenderChild,
              [
                "poc-3-revision-race-worker-failed",
              ],
            );
          const contenderExitObservation =
            once(
              contenderChild,
              "exit",
            ) as Promise<
              readonly unknown[]
            >;
          contenderChild.send({
            type:
              "poc-3-revision-race-worker-run",
            role: "contender",
            callerChecksum:
              contenderCallerChecksum,
            profile:
              contenderProfile,
          });
          const contenderFailure =
            await contenderTerminal;
          expect(
            Object.keys(
              contenderFailure,
            ).sort(),
          ).toEqual([
            "errorCode",
            "errorName",
            "type",
          ]);
          expect(
            contenderFailure,
          ).toMatchObject({
            type:
              "poc-3-revision-race-worker-failed",
            errorName:
              expect.any(String),
            errorCode:
              expect.stringMatching(
                /^(SQLITE_BUSY|SQLITE_LOCKED|REVISION_CONFLICT)$/,
              ),
          });
          expect(
            contenderFailure,
          ).not.toHaveProperty(
            "message",
          );
          await expect(
            waitForExit(
              contenderChild,
              contenderExitObservation,
              callerDeadline,
            ),
          ).resolves.toEqual([
            1,
            null,
          ]);
          contenderChild =
            undefined;
          expect(() =>
            process.kill(holderPid, 0),
          ).not.toThrow();
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  current_revision_id AS "currentRevisionId",
                  durable_revision_id AS "durableRevisionId"
                FROM manuscripts
                WHERE document_id = ?
              `,
              [identities.documentId],
            ),
          ).toEqual(
            baselinePointers,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM document_revisions
                ORDER BY id
              `,
            ),
          ).toEqual(
            baselineRevisions,
          );
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM blob_manifests
                ORDER BY blob_ref
              `,
            ),
          ).toEqual(
            baselineManifests,
          );

          const holderTerminal =
            waitForRaceWorkerMessage(
              holderChild,
              [
                "poc-3-revision-race-worker-completed",
              ],
            );
          const holderExitObservation =
            once(
              holderChild,
              "exit",
            ) as Promise<
              readonly unknown[]
            >;
          holderChild.send({
            type:
              "poc-3-revision-race-worker-release",
            scenarioId:
              holderProfile
                .scenarioId,
          });
          await expect(
            holderTerminal,
          ).resolves.toEqual({
            type:
              "poc-3-revision-race-worker-completed",
          });
          await expect(
            waitForExit(
              holderChild,
              holderExitObservation,
              callerDeadline,
            ),
          ).resolves.toEqual([
            0,
            null,
          ]);
          holderChild =
            undefined;

          ledger =
            await openNodeSqliteLedger(
              storageOpenProfile,
            );
          const reopenedStore =
            ledger.createRevisionStore({
              blobStore,
              blobProfile,
            });
          await expect(
            reopenedStore
              .getCurrentRevision(
                entityId<"Document">(
                  identities.documentId,
                ),
              ),
          ).resolves.toEqual(
            expect.objectContaining({
              id:
                holderInput
                  .revisionId,
              parentRevisionId:
                baselineInput
                  .revisionId,
            }),
          );
          await expect(
            reopenedStore.materialize(
              holderInput.revisionId,
            ),
          ).resolves.toBe(
            holderInput.content,
          );
          await expect(
            reopenedStore.getRevision(
              contenderInput
                .revisionId,
            ),
          ).resolves.toBeNull();
          ledger.close();

          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  current_revision_id AS "currentRevisionId",
                  durable_revision_id AS "durableRevisionId"
                FROM manuscripts
                WHERE document_id = ?
              `,
              [identities.documentId],
            ),
          ).toEqual([
            {
              currentRevisionId:
                holderInput.revisionId,
              durableRevisionId:
                holderInput.revisionId,
            },
          ]);
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT COUNT(*) AS "count"
                FROM document_revisions
              `,
            ),
          ).toEqual([
            {
              count:
                baselineRevisions
                  .length + 1,
            },
          ]);
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT COUNT(*) AS "count"
                FROM blob_manifests
              `,
            ),
          ).toEqual([
            {
              count:
                baselineManifests
                  .length + 1,
            },
          ]);
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT
                  id,
                  content_ref AS "contentRef"
                FROM document_revisions
                WHERE id IN (?, ?)
                ORDER BY id
              `,
              [
                holderInput.revisionId,
                contenderInput
                  .revisionId,
              ],
            ),
          ).toEqual([
            {
              id:
                holderInput
                  .revisionId,
              contentRef:
                blobProfile
                  .blobRefForAddress(
                    Object.freeze({
                      checksumIdentity,
                      checksumValue:
                        createHash(
                          checksumAlgorithm,
                        )
                          .update(
                            blobProfile.codec
                              .encode(
                                holderInput
                                  .content,
                              ),
                          )
                          .digest(
                            "hex",
                          ),
                    }),
                  ),
            },
          ]);
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM document_revisions
                WHERE id = ?
              `,
              [
                contenderInput
                  .revisionId,
              ],
            ),
          ).toEqual([]);
          const contenderBytes =
            blobProfile.codec.encode(
              contenderInput.content,
            );
          const contenderAddress =
            Object.freeze({
              checksumIdentity,
              checksumValue:
                createHash(
                  checksumAlgorithm,
                )
                  .update(
                    contenderBytes,
                  )
                  .digest("hex"),
            });
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              `
                SELECT *
                FROM blob_manifests
                WHERE blob_ref = ?
              `,
              [
                blobProfile
                  .blobRefForAddress(
                    contenderAddress,
                  ),
              ],
            ),
          ).toEqual([]);
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              "PRAGMA foreign_key_check",
            ),
          ).toEqual([]);
          expect(
            auditRows(
              storageOpenProfile
                .databasePath,
              "PRAGMA integrity_check",
            ),
          ).toEqual([
            {
              integrity_check: "ok",
            },
          ]);
          const afterInventory =
            await blobStore.inventory({
              isReachable: async (
                address,
              ) =>
                addressReachableInDatabase(
                  storageOpenProfile
                    .databasePath,
                  address,
                ),
            });
          expect(
            afterInventory.published,
          ).toHaveLength(
            baselineInventory
              .published.length + 2,
          );
          expect(
            afterInventory.temporary,
          ).toEqual([]);
          expect(
            afterInventory.published
              .filter(
                (entry) =>
                  !entry.reachable,
              ),
          ).toEqual([
            expect.objectContaining({
              address:
                contenderAddress,
              actualChecksumValue:
                contenderAddress
                  .checksumValue,
              byteLength:
                contenderBytes
                  .byteLength,
              status: "verified",
              reachable: false,
            }),
          ]);
        } finally {
          for (
            const child
            of [
              holderChild,
              contenderChild,
            ]
          ) {
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
          }
          ledger.close();
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
