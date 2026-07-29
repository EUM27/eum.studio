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
  DatabaseSync,
} from "node:sqlite";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  inspectStorageIntegrity,
} from "../../src/application/storage/storage-integrity";
import type {
  AppendImmutableBlobReceipt,
  BlobAddress,
  ImmutableBlobStore,
} from "../../src/application/storage/blob-store";
import type {
  StorageIntegrityReport,
} from "../../src/application/storage/storage-integrity";
import type {
  Poc3LedgerRecord,
} from "../../src/domain/poc-3-storage-ledger";
import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";
import {
  inspectNodeSqliteStorageIntegrity,
} from "../../src/platform/storage/node-sqlite-integrity";
import {
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";

type IntegrityFixture = {
  readonly counts: {
    readonly publishedDirectorySegmentCount:
      number;
    readonly temporaryDirectorySegmentCount:
      number;
    readonly publishedShardCount:
      number;
    readonly publishedShardWidth:
      number;
    readonly contentPartCount: number;
    readonly temporaryByteCount: number;
  };
};

type LedgerFixture = {
  readonly requestedSettings:
    Record<string, unknown>;
  readonly targetSchemaVersion:
    number;
};

type RuntimeClock = {
  instant(): string;
  revision(): number;
};

type RuntimeIntegrityContext = {
  readonly temporaryRoot: string;
  readonly databasePath: string;
  readonly blobRootDirectoryPath:
    string;
  readonly checksumAlgorithm:
    string;
  readonly checksumIdentity:
    string;
  readonly targetSchemaVersion:
    number;
  readonly materialByteCount:
    number;
  readonly content: string;
  readonly contentBlobRef: string;
  readonly contentAddress:
    BlobAddress;
  readonly contentByteLength:
    number;
  readonly revisionId: string;
  readonly studioId: string;
  readonly workId: string;
  readonly documentId: string;
  readonly blobStore:
    ImmutableBlobStore;
  readonly blobProfile:
    ReturnType<
      typeof parseNodeImmutableBlobStoreProfile
    >;
  readonly ledger: Awaited<
    ReturnType<
      typeof openNodeSqliteLedger
    >
  >;
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

function runtimeContent(
  partCount: number,
): string {
  return Array.from(
    {
      length: partCount,
    },
    randomUUID,
  ).join(randomUUID());
}

function selectRuntimeHash(
  minimumHexLength: number,
): string {
  for (const candidate of getHashes()) {
    try {
      const output =
        createHash(candidate)
          .update(randomBytes(1))
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
    "Current runtime exposes no usable integrity checksum",
  );
}

function seedRecords(
  input: {
    readonly checksumIdentity:
      string;
    readonly targetSchemaVersion:
      number;
    readonly blobRef: string;
    readonly checksumValue: string;
    readonly byteLength: number;
    readonly content: string;
    readonly clock: RuntimeClock;
    readonly identities: {
      readonly studioId: string;
      readonly workId: string;
      readonly settingsId: string;
      readonly activityPolicyId:
        string;
      readonly focusPolicyId:
        string;
      readonly documentId: string;
      readonly manuscriptId: string;
      readonly revisionId: string;
    };
  },
): readonly Poc3LedgerRecord[] {
  const {
    checksumIdentity,
    targetSchemaVersion,
    blobRef,
    checksumValue,
    byteLength,
    content,
    clock,
    identities,
  } = input;
  const meta = () =>
    Object.freeze({
      schemaVersion:
        targetSchemaVersion,
      revision: clock.revision(),
      createdAt: clock.instant(),
      updatedAt: clock.instant(),
    });
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
      studioId: identities.studioId,
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
      blobRef,
      checksumIdentity,
      checksumValue,
      byteLength,
      createdAt: clock.instant(),
      mediaType: randomUUID(),
      originalName: randomUUID(),
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
      id: identities.revisionId,
      workId: identities.workId,
      documentId:
        identities.documentId,
      contentRef: blobRef,
      contentHash: checksumValue,
      length: content.length,
      cause: randomUUID(),
      createdAt: clock.instant(),
      durableAt: clock.instant(),
    },
    {
      kind: "manuscript",
      id:
        identities.manuscriptId,
      workId: identities.workId,
      documentId:
        identities.documentId,
      currentRevisionId:
        identities.revisionId,
      durableRevisionId:
        identities.revisionId,
      updatedAt: clock.instant(),
    },
  ]);
}

async function createRuntimeIntegrityContext():
  Promise<RuntimeIntegrityContext> {
  const integrityFixture =
    await readJsonFixture<
      IntegrityFixture
    >(
      "../fixtures/storage/poc-3-storage-integrity.manifest.json",
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
  const checksumIdentity =
    randomUUID();
  const shardWidths =
    Array.from(
      {
        length:
          integrityFixture.counts
            .publishedShardCount,
      },
      () =>
        integrityFixture.counts
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
  const blobRootDirectoryPath =
    join(
      temporaryRoot,
      randomUUID(),
    );
  const blobProfile =
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
          directorySegments:
            Array.from(
              {
                length:
                  integrityFixture
                    .counts
                    .publishedDirectorySegmentCount,
              },
              randomUUID,
            ),
          shardWidths,
          fileNamePrefix:
            randomUUID(),
          fileNameSuffix:
            randomUUID(),
        },
        temporaryLayout: {
          directorySegments:
            Array.from(
              {
                length:
                  integrityFixture
                    .counts
                    .temporaryDirectorySegmentCount,
              },
              randomUUID,
            ),
        },
      },
    );
  const blobStore =
    await createNodeImmutableBlobStore(
      blobProfile,
    );
  const databasePath = join(
    temporaryRoot,
    randomUUID(),
  );
  const ledger =
    await openNodeSqliteLedger(
      parsePoc3StorageOpenProfile({
        databasePath,
        checksumIdentity,
        requestedSettings:
          ledgerFixture
            .requestedSettings,
        targetSchemaVersion:
          ledgerFixture
            .targetSchemaVersion,
      }),
    );
  try {
    const content =
      runtimeContent(
        integrityFixture.counts
          .contentPartCount,
      );
    const bytes =
      new TextEncoder().encode(
        content,
      );
    const published =
      await blobStore.append({
        bytes,
        metadata: {
          [randomUUID()]:
            randomUUID(),
        },
        temporaryEntryIdentity:
          randomUUID(),
      });
    const contentBlobRef =
      randomUUID();
    const identities = {
      studioId: randomUUID(),
      workId: randomUUID(),
      settingsId: randomUUID(),
      activityPolicyId:
        randomUUID(),
      focusPolicyId: randomUUID(),
      documentId: randomUUID(),
      manuscriptId: randomUUID(),
      revisionId: randomUUID(),
    };
    const clock =
      createRuntimeClock();
    await ledger.transaction(
      async (transaction) => {
        for (
          const record
          of seedRecords({
            checksumIdentity,
            targetSchemaVersion:
              ledgerFixture
                .targetSchemaVersion,
            blobRef:
              contentBlobRef,
            checksumValue:
              published.address
                .checksumValue,
            byteLength:
              published.byteLength,
            content,
            clock,
            identities,
          })
        ) {
          transaction.write(record);
        }
      },
    );
    return {
      temporaryRoot,
      databasePath,
      blobRootDirectoryPath,
      checksumAlgorithm,
      checksumIdentity,
      targetSchemaVersion:
        ledgerFixture
          .targetSchemaVersion,
      materialByteCount:
        integrityFixture.counts
          .temporaryByteCount,
      content,
      contentBlobRef,
      contentAddress:
        published.address,
      contentByteLength:
        published.byteLength,
      revisionId:
        identities.revisionId,
      studioId:
        identities.studioId,
      workId: identities.workId,
      documentId:
        identities.documentId,
      blobStore,
      blobProfile,
      ledger,
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
    };
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

const unreachable = {
  isReachable:
    async () => false,
};

function fingerprintFor(
  context:
    RuntimeIntegrityContext,
): (
  canonicalReport: string,
) => string {
  return (canonicalReport) =>
    createHash(
      context.checksumAlgorithm,
    )
      .update(
        canonicalReport,
        "utf8",
      )
      .digest("hex");
}

async function inspectWithoutMutation(
  context:
    RuntimeIntegrityContext,
  blobStore:
    ImmutableBlobStore =
      context.blobStore,
): Promise<
  StorageIntegrityReport
> {
  const databaseBefore =
    await readFile(
      context.databasePath,
    );
  const inventoryBefore =
    await context.blobStore
      .inventory(unreachable);
  const report =
    await inspectNodeSqliteStorageIntegrity(
      {
        databasePath:
          context.databasePath,
        blobStore,
        reportIdentity:
          randomUUID(),
        fingerprint:
          fingerprintFor(
            context,
          ),
      },
    );
  expect(
    await readFile(
      context.databasePath,
    ),
  ).toEqual(databaseBefore);
  expect(
    await context.blobStore
      .inventory(unreachable),
  ).toEqual(inventoryBefore);
  return report;
}

async function publishedPathFor(
  context:
    RuntimeIntegrityContext,
  address: BlobAddress,
): Promise<string> {
  const inventory =
    await context.blobStore
      .inventory(unreachable);
  const matches =
    inventory.published.filter(
      (entry) =>
        entry.address
          .checksumIdentity ===
          address
            .checksumIdentity &&
        entry.address
          .checksumValue ===
          address.checksumValue,
    );
  const match = matches[0];
  if (
    matches.length !== 1 ||
    match === undefined
  ) {
    throw new Error(
      "Caller address requires exactly one published inventory entry",
    );
  }
  return join(
    context
      .blobRootDirectoryPath,
    ...match.relativePathSegments,
  );
}

function withAuditDatabase<T>(
  databasePath: string,
  inspect: (
    database:
      DatabaseSync,
  ) => T,
): T {
  const database =
    new DatabaseSync(
      databasePath,
      {
        enableForeignKeyConstraints:
          false,
      },
    );
  try {
    return inspect(database);
  } finally {
    database.close();
  }
}

describe(
  "POC-3 storage integrity",
  () => {
    it(
      "exposes the narrow application integrity report command",
      () => {
        expect(
          inspectStorageIntegrity,
        ).toEqual(
          expect.any(Function),
        );
      },
    );

    it(
      "exposes the read-only Node SQLite verifier",
      () => {
        expect(
          inspectNodeSqliteStorageIntegrity,
        ).toEqual(
          expect.any(Function),
        );
      },
    );

    it(
      "returns a deterministic healthy report without manuscript data, paths, or storage mutation",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        const reportIdentity =
          randomUUID();
        const canonicalReports:
          string[] = [];
        const fingerprint = (
          canonicalReport: string,
        ): string => {
          canonicalReports.push(
            canonicalReport,
          );
          return createHash(
            context
              .checksumAlgorithm,
          )
            .update(
              canonicalReport,
              "utf8",
            )
            .digest("hex");
        };
        try {
          context.ledger.close();
          const databaseBefore =
            await readFile(
              context.databasePath,
            );
          const inventoryBefore =
            await context.blobStore
              .inventory(unreachable);

          const first =
            await inspectNodeSqliteStorageIntegrity(
              {
                databasePath:
                  context
                    .databasePath,
                blobStore:
                  context.blobStore,
                reportIdentity,
                fingerprint,
              },
            );
          const second =
            await inspectNodeSqliteStorageIntegrity(
              {
                databasePath:
                  context
                    .databasePath,
                blobStore:
                  context.blobStore,
                reportIdentity,
                fingerprint,
              },
            );

          expect(first).toEqual(
            second,
          );
          expect(first).toMatchObject({
            reportIdentity,
            userSchemaVersion:
              context
                .targetSchemaVersion,
            valid: true,
            findings: [],
            counts: {
              databaseIntegrityFailureCount:
                0,
              foreignKeyViolationCount:
                0,
              storageIdentityCount:
                1,
              blobManifestCount:
                1,
              revisionCount: 1,
              revisionReferenceCount:
                1,
              publishedBlobCount:
                1,
              temporaryRemnantCount:
                0,
            },
          });
          expect(
            canonicalReports,
          ).toHaveLength(2);
          expect(
            first.fingerprint,
          ).toBe(
            createHash(
              context
                .checksumAlgorithm,
            )
              .update(
                canonicalReports[0] ??
                  "",
                "utf8",
              )
              .digest("hex"),
          );
          const serialized =
            JSON.stringify(first);
          expect(serialized).not
            .toContain(
              context.content,
            );
          expect(serialized).not
            .toContain(
              context.databasePath,
            );
          expect(serialized).not
            .toContain(
              context
                .blobRootDirectoryPath,
            );
          expect(
            await readFile(
              context.databasePath,
            ),
          ).toEqual(
            databaseBefore,
          );
          expect(
            await context.blobStore
              .inventory(unreachable),
          ).toEqual(
            inventoryBefore,
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "reports a manifest without an actual revision reference as an orphan",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        try {
          const extra =
            await context.blobStore
              .append({
                bytes: randomBytes(
                  context
                    .materialByteCount,
                ),
                metadata: {
                  [randomUUID()]:
                    randomUUID(),
                },
                temporaryEntryIdentity:
                  randomUUID(),
              });
          const orphanBlobRef =
            randomUUID();
          await context.ledger
            .transaction(
              async (transaction) => {
                transaction.write({
                  kind:
                    "blobManifest",
                  blobRef:
                    orphanBlobRef,
                  checksumIdentity:
                    extra.address
                      .checksumIdentity,
                  checksumValue:
                    extra.address
                      .checksumValue,
                  byteLength:
                    extra.byteLength,
                  createdAt:
                    new Date()
                      .toISOString(),
                });
              },
            );
          context.ledger.close();

          const report =
            await inspectNodeSqliteStorageIntegrity(
              {
                databasePath:
                  context
                    .databasePath,
                blobStore:
                  context.blobStore,
                reportIdentity:
                  randomUUID(),
                fingerprint:
                  (canonical) =>
                    createHash(
                      context
                        .checksumAlgorithm,
                    )
                      .update(
                        canonical,
                        "utf8",
                      )
                      .digest("hex"),
              },
            );

          expect(report.valid).toBe(
            false,
          );
          expect(
            report.findings,
          ).toContainEqual({
            kind:
              "orphan-manifest",
            blobRef: orphanBlobRef,
            checksumIdentity:
              extra.address
                .checksumIdentity,
            checksumValue:
              extra.address
                .checksumValue,
            byteLength:
              extra.byteLength,
          });
          expect(
            report.findings.map(
              (finding) =>
                finding.kind,
            ),
          ).toContain(
            "orphan-published-blob",
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "reports a revision reference whose exact manifest is missing",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        try {
          context.ledger.close();
          withAuditDatabase(
            context.databasePath,
            (database) => {
              database.exec(
                "DROP TRIGGER blob_manifests_reject_delete",
              );
              database
                .prepare(`
                  DELETE FROM blob_manifests
                  WHERE blob_ref = ?
                `)
                .run(
                  context
                    .contentBlobRef,
                );
            },
          );

          const report =
            await inspectWithoutMutation(
              context,
            );

          expect(report.valid).toBe(
            false,
          );
          expect(
            report.findings,
          ).toContainEqual({
            kind:
              "missing-manifest",
            blobRef:
              context
                .contentBlobRef,
          });
          expect(
            report.findings.map(
              (finding) =>
                finding.kind,
            ),
          ).toEqual(
            expect.arrayContaining([
              "foreign-key-violation",
              "orphan-published-blob",
            ]),
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "reports a referenced manifest whose exact physical blob is missing",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        try {
          const publishedPath =
            await publishedPathFor(
              context,
              context
                .contentAddress,
            );
          context.ledger.close();
          await unlink(
            publishedPath,
          );

          const report =
            await inspectWithoutMutation(
              context,
            );

          expect(report.valid).toBe(
            false,
          );
          expect(
            report.findings,
          ).toContainEqual({
            kind: "missing-blob",
            blobRef:
              context
                .contentBlobRef,
            checksumIdentity:
              context
                .contentAddress
                .checksumIdentity,
            checksumValue:
              context
                .contentAddress
                .checksumValue,
            byteLength:
              context
                .contentByteLength,
          });
        } finally {
          await context.close();
        }
      },
    );

    it(
      "reports checksum-corrupt bytes at a referenced exact address",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        try {
          const publishedPath =
            await publishedPathFor(
              context,
              context
                .contentAddress,
            );
          const existing =
            await readFile(
              publishedPath,
            );
          const corruptBytes =
            Uint8Array.from([
              ...existing,
              ...randomBytes(
                context
                  .materialByteCount,
              ),
            ]);
          context.ledger.close();
          await writeFile(
            publishedPath,
            corruptBytes,
          );

          const report =
            await inspectWithoutMutation(
              context,
            );

          expect(report.valid).toBe(
            false,
          );
          expect(
            report.findings,
          ).toContainEqual({
            kind: "corrupt-blob",
            blobRef:
              context
                .contentBlobRef,
            checksumIdentity:
              context
                .contentAddress
                .checksumIdentity,
            checksumValue:
              context
                .contentAddress
                .checksumValue,
            byteLength:
              context
                .contentByteLength,
          });
          expect(
            report.findings.map(
              (finding) =>
                finding.kind,
            ),
          ).not.toContain(
            "orphan-corrupt-published-blob",
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "reports a manifest whose recorded byte length does not match readExact",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        const mismatchedByteLength =
          context
            .contentByteLength +
          context.materialByteCount;
        try {
          context.ledger.close();
          withAuditDatabase(
            context.databasePath,
            (database) => {
              const original =
                database
                  .prepare(`
                    SELECT
                      blob_ref,
                      checksum_identity,
                      checksum_value,
                      created_at,
                      media_type,
                      original_name
                    FROM blob_manifests
                    WHERE blob_ref = ?
                  `)
                  .get(
                    context
                      .contentBlobRef,
                  );
              if (
                original ===
                undefined
              ) {
                throw new Error(
                  "Caller manifest replacement requires its original row",
                );
              }
              const originalBlobRef =
                original.blob_ref;
              const originalChecksumIdentity =
                original
                  .checksum_identity;
              const originalChecksumValue =
                original
                  .checksum_value;
              const originalCreatedAt =
                original.created_at;
              const originalMediaType =
                original.media_type;
              const originalName =
                original.original_name;
              if (
                typeof originalBlobRef !==
                  "string" ||
                typeof originalChecksumIdentity !==
                  "string" ||
                typeof originalChecksumValue !==
                  "string" ||
                typeof originalCreatedAt !==
                  "string" ||
                !(
                  originalMediaType ===
                    null ||
                  typeof originalMediaType ===
                    "string"
                ) ||
                !(
                  originalName === null ||
                  typeof originalName ===
                    "string"
                )
              ) {
                throw new Error(
                  "Caller manifest replacement requires exact SQLite values",
                );
              }
              database.exec(
                "DROP TRIGGER blob_manifests_reject_delete",
              );
              database.exec("BEGIN");
              try {
                database
                  .prepare(`
                    DELETE FROM blob_manifests
                    WHERE blob_ref = ?
                  `)
                  .run(
                    context
                      .contentBlobRef,
                  );
                database
                  .prepare(`
                    INSERT INTO blob_manifests (
                      blob_ref,
                      checksum_identity,
                      checksum_value,
                      byte_length,
                      created_at,
                      media_type,
                      original_name
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                  `)
                  .run(
                    originalBlobRef,
                    originalChecksumIdentity,
                    originalChecksumValue,
                    mismatchedByteLength,
                    originalCreatedAt,
                    originalMediaType,
                    originalName,
                  );
                database.exec(
                  "COMMIT",
                );
              } catch (error) {
                database.exec(
                  "ROLLBACK",
                );
                throw error;
              }
            },
          );

          const report =
            await inspectWithoutMutation(
              context,
            );

          expect(report.valid).toBe(
            false,
          );
          expect(
            report.findings,
          ).toContainEqual({
            kind:
              "manifest-mismatch",
            blobRef:
              context
                .contentBlobRef,
            checksumIdentity:
              context
                .contentAddress
                .checksumIdentity,
            checksumValue:
              context
                .contentAddress
                .checksumValue,
            byteLength:
              mismatchedByteLength,
          });
          expect(
            report.counts
              .foreignKeyViolationCount,
          ).toBe(0);
        } finally {
          await context.close();
        }
      },
    );

    it(
      "reports every foreign key violation found inside the pinned database snapshot",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        try {
          context.ledger.close();
          withAuditDatabase(
            context.databasePath,
            (database) => {
              database
                .prepare(`
                  DELETE FROM studios
                  WHERE id = ?
                `)
                .run(
                  context.studioId,
                );
            },
          );

          const report =
            await inspectWithoutMutation(
              context,
            );
          const finding =
            report.findings.find(
              (candidate) =>
                candidate.kind ===
                "foreign-key-violation",
            );

          expect(report.valid).toBe(
            false,
          );
          expect(
            report.counts
              .foreignKeyViolationCount,
          ).toBeGreaterThan(0);
          expect(finding).toEqual({
            kind:
              "foreign-key-violation",
            count:
              report.counts
                .foreignKeyViolationCount,
          });
        } finally {
          await context.close();
        }
      },
    );

    it(
      "reports verified and corrupt physical orphans plus temporary remnants without cleanup",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        try {
          const verifiedBytes =
            randomBytes(
              context
                .materialByteCount,
            );
          const corruptSourceBytes =
            Uint8Array.from([
              ...verifiedBytes,
              ...randomBytes(
                context
                  .materialByteCount,
              ),
            ]);
          const verified =
            await context.blobStore
              .append({
                bytes: verifiedBytes,
                metadata: {
                  [randomUUID()]:
                    randomUUID(),
                },
                temporaryEntryIdentity:
                  randomUUID(),
              });
          const corrupt =
            await context.blobStore
              .append({
                bytes:
                  corruptSourceBytes,
                metadata: {
                  [randomUUID()]:
                    randomUUID(),
                },
                temporaryEntryIdentity:
                  randomUUID(),
              });
          const corruptPath =
            await publishedPathFor(
              context,
              corrupt.address,
            );
          const corruptPhysicalBytes =
            Uint8Array.from([
              ...corruptSourceBytes,
              ...randomBytes(
                context
                  .materialByteCount,
              ),
            ]);
          await writeFile(
            corruptPath,
            corruptPhysicalBytes,
          );
          const temporaryIdentity =
            randomUUID();
          const temporaryBytes =
            randomBytes(
              context
                .materialByteCount,
            );
          await writeFile(
            join(
              context
                .blobProfile
                .rootDirectoryPath,
              ...context
                .blobProfile
                .temporaryLayout
                .directorySegments,
              temporaryIdentity,
            ),
            temporaryBytes,
          );
          context.ledger.close();

          const report =
            await inspectWithoutMutation(
              context,
            );

          expect(report.valid).toBe(
            false,
          );
          expect(
            report.findings,
          ).toEqual(
            expect.arrayContaining([
              {
                kind:
                  "orphan-published-blob",
                checksumIdentity:
                  verified.address
                    .checksumIdentity,
                checksumValue:
                  verified.address
                    .checksumValue,
                byteLength:
                  verified.byteLength,
              },
              {
                kind:
                  "orphan-corrupt-published-blob",
                checksumIdentity:
                  corrupt.address
                    .checksumIdentity,
                checksumValue:
                  corrupt.address
                    .checksumValue,
                byteLength:
                  corruptPhysicalBytes
                    .byteLength,
              },
              {
                kind:
                  "temporary-remnant",
                checksumIdentity:
                  context
                    .checksumIdentity,
                checksumValue:
                  createHash(
                    context
                      .checksumAlgorithm,
                  )
                    .update(
                      temporaryBytes,
                    )
                    .digest("hex"),
                byteLength:
                  temporaryBytes
                    .byteLength,
                temporaryEntryIdentity:
                  temporaryIdentity,
              },
            ]),
          );
          expect(
            report.findings.map(
              (finding) =>
                finding.kind,
            ),
          ).not.toContain(
            "orphan-manifest",
          );
        } finally {
          await context.close();
        }
      },
    );

    it(
      "keeps a concurrent post-snapshot revision commit outside the pinned baseline and reports its blob as orphaned",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        let concurrent:
          | {
            readonly blobRef:
              string;
            readonly revisionId:
              string;
            readonly receipt:
              AppendImmutableBlobReceipt;
          }
          | undefined;
        const baseStore =
          context.blobStore;
        const concurrentStore:
          ImmutableBlobStore =
          {
            append: (input) =>
              baseStore.append(input),
            readExact:
              async (address) => {
                if (
                  concurrent ===
                  undefined
                ) {
                  const content =
                    randomUUID();
                  const receipt =
                    await baseStore
                      .append({
                        bytes:
                          new TextEncoder()
                            .encode(
                              content,
                            ),
                        metadata: {
                          [randomUUID()]:
                            randomUUID(),
                        },
                        temporaryEntryIdentity:
                          randomUUID(),
                      });
                  const blobRef =
                    randomUUID();
                  const revisionId =
                    randomUUID();
                  const committedAt =
                    new Date()
                      .toISOString();
                  await context.ledger
                    .transaction(
                      async (
                        transaction,
                      ) => {
                        transaction.write({
                          kind:
                            "blobManifest",
                          blobRef,
                          checksumIdentity:
                            receipt
                              .address
                              .checksumIdentity,
                          checksumValue:
                            receipt
                              .address
                              .checksumValue,
                          byteLength:
                            receipt
                              .byteLength,
                          createdAt:
                            committedAt,
                        });
                        transaction.write({
                          kind:
                            "documentRevision",
                          id: revisionId,
                          workId:
                            context
                              .workId,
                          documentId:
                            context
                              .documentId,
                          parentRevisionId:
                            context
                              .revisionId,
                          contentRef:
                            blobRef,
                          contentHash:
                            receipt
                              .address
                              .checksumValue,
                          length:
                            content.length,
                          cause:
                            randomUUID(),
                          createdAt:
                            committedAt,
                          durableAt:
                            committedAt,
                        });
                      },
                    );
                  concurrent = {
                    blobRef,
                    revisionId,
                    receipt,
                  };
                }
                return baseStore
                  .readExact(address);
              },
            inventory: (input) =>
              baseStore.inventory(
                input,
              ),
            cleanup: (input) =>
              baseStore.cleanup(input),
          };
        try {
          const report =
            await inspectNodeSqliteStorageIntegrity(
              {
                databasePath:
                  context
                    .databasePath,
                blobStore:
                  concurrentStore,
                reportIdentity:
                  randomUUID(),
                fingerprint:
                  fingerprintFor(
                    context,
                  ),
              },
            );
          if (
            concurrent === undefined
          ) {
            throw new Error(
              "Concurrent probe did not commit after the pinned snapshot",
            );
          }
          const committedConcurrent =
            concurrent;

          expect(report.valid).toBe(
            false,
          );
          expect(report.counts).toMatchObject({
            blobManifestCount: 1,
            revisionCount: 1,
            revisionReferenceCount:
              1,
            publishedBlobCount: 2,
          });
          expect(
            report.findings,
          ).toContainEqual({
            kind:
              "orphan-published-blob",
            checksumIdentity:
              committedConcurrent
                .receipt
                .address
                .checksumIdentity,
            checksumValue:
              committedConcurrent
                .receipt
                .address
                .checksumValue,
            byteLength:
              committedConcurrent
                .receipt
                .byteLength,
          });
          expect(
            withAuditDatabase(
              context.databasePath,
              (database) =>
                database
                  .prepare(`
                    SELECT COUNT(*) AS count
                    FROM document_revisions
                    WHERE id = ?
                  `)
                  .get(
                    committedConcurrent
                      .revisionId,
                  )?.count,
            ),
          ).toBe(1);
          await expect(
            baseStore.readExact(
              committedConcurrent
                .receipt
                .address,
            ),
          ).resolves.toMatchObject({
            address:
              committedConcurrent
                .receipt
                .address,
            byteLength:
              committedConcurrent
                .receipt
                .byteLength,
          });
        } finally {
          await context.close();
        }
      },
    );

    it(
      "verifies both content_ref and change_set_ref from actual revisions",
      async () => {
        const context =
          await createRuntimeIntegrityContext();
        try {
          const changeSet =
            await context.blobStore
              .append({
                bytes: randomBytes(
                  context
                    .materialByteCount,
                ),
                metadata: {
                  [randomUUID()]:
                    randomUUID(),
                },
                temporaryEntryIdentity:
                  randomUUID(),
              });
          const changeSetBlobRef =
            randomUUID();
          const nextRevisionId =
            randomUUID();
          const committedAt =
            new Date()
              .toISOString();
          await context.ledger
            .transaction(
              async (transaction) => {
                transaction.write({
                  kind:
                    "blobManifest",
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
                    committedAt,
                });
                transaction.write({
                  kind:
                    "documentRevision",
                  id: nextRevisionId,
                  workId:
                    context.workId,
                  documentId:
                    context.documentId,
                  parentRevisionId:
                    context.revisionId,
                  contentRef:
                    context
                      .contentBlobRef,
                  contentHash:
                    context
                      .contentAddress
                      .checksumValue,
                  length:
                    context
                      .content.length,
                  changeSetRef:
                    changeSetBlobRef,
                  cause: randomUUID(),
                  createdAt:
                    committedAt,
                  durableAt:
                    committedAt,
                });
              },
            );
          context.ledger.close();

          const report =
            await inspectWithoutMutation(
              context,
            );

          expect(report.valid).toBe(
            true,
          );
          expect(report.findings).toEqual(
            [],
          );
          expect(report.counts).toMatchObject({
            blobManifestCount: 2,
            revisionCount: 2,
            revisionReferenceCount:
              3,
            publishedBlobCount: 2,
          });
        } finally {
          await context.close();
        }
      },
    );
  },
);
