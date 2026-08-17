import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import {
  randomUUID,
} from "node:crypto";
import {
  join,
} from "node:path";
import {
  tmpdir,
} from "node:os";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";
import {
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import type {
  Poc3LedgerRecord,
} from "../../src/domain/poc-3-storage-ledger";
import type {
  StorageTransaction,
} from "../../src/application/storage/storage-service";

type Poc3LedgerFixtureManifest = {
  readonly requestedSettings: {
    readonly journalMode: {
      readonly applySql: string;
      readonly verifySql: string;
      readonly expectedRows:
        readonly Readonly<
          Record<
            string,
            string | number
          >
        >[];
    };
    readonly synchronous: {
      readonly applySql: string;
      readonly verifySql: string;
      readonly expectedRows:
        readonly Readonly<
          Record<
            string,
            string | number
          >
        >[];
    };
    readonly foreignKeys: {
      readonly applySql: string;
      readonly verifySql: string;
      readonly expectedRows:
        readonly Readonly<
          Record<
            string,
            string | number
          >
        >[];
    };
  };
  readonly targetSchemaVersion: number;
  readonly requiredTables:
    readonly string[];
};

type AuditSqliteStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
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

async function readFixtureManifest(): Promise<
  Poc3LedgerFixtureManifest
> {
  return JSON.parse(
    await readFile(
      new URL(
        "../fixtures/storage/poc-3-ledger.manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Poc3LedgerFixtureManifest;
}

function runtimeJson(): string {
  return JSON.stringify({
    [randomUUID()]: randomUUID(),
  });
}

function createRuntimeLedgerGraph(
  checksumIdentity: string,
  targetSchemaVersion: number,
): {
  readonly records:
    readonly Poc3LedgerRecord[];
  readonly slices:
    readonly {
      readonly workId: string;
      readonly folderId: string;
      readonly documentId: string;
      readonly revisionId: string;
      readonly anchorId: string;
      readonly blobRef: string;
      readonly snapshotId: string;
    }[];
} {
  let instantOffset = 0;
  const instant = (): string =>
    new Date(
      Date.now() +
        instantOffset++,
    ).toISOString();
  const revision = (): number =>
    Date.now() +
      instantOffset++;
  const studioId = randomUUID();
  const studio:
    Poc3LedgerRecord = {
      kind: "studio",
      id: studioId,
      displayName: randomUUID(),
      locale: randomUUID(),
      timezone: randomUUID(),
      settingsRevision:
        revision(),
      createdAt: instant(),
    };

  const slices = Array.from(
    {
      length:
        targetSchemaVersion + 1,
    },
    () => {
      const workId = randomUUID();
      const settingsId =
        randomUUID();
      const activityPolicyId =
        randomUUID();
      const focusPolicyId =
        randomUUID();
      const folderId =
        randomUUID();
      const documentId =
        randomUUID();
      const manuscriptId =
        randomUUID();
      const blobRef =
        randomUUID();
      const revisionId =
        randomUUID();
      const anchorId =
        randomUUID();
      const rangeGroupId =
        randomUUID();
      const eventBlockId =
        randomUUID();
      const eventSourceId =
        randomUUID();
      const checkpointId =
        randomUUID();
      const sessionId =
        randomUUID();
      const intervalId =
        randomUUID();
      const focusCycleId =
        randomUUID();
      const snapshotId =
        randomUUID();
      const meta = () => ({
        schemaVersion:
          targetSchemaVersion,
        revision: revision(),
        createdAt: instant(),
        updatedAt: instant(),
      });
      const content =
        randomUUID();
      const records:
        Poc3LedgerRecord[] = [
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
              revision(),
            navigationGrace:
              revision(),
            hiddenWindowPolicy:
              randomUUID(),
            activityClassRulesJson:
              runtimeJson(),
            autoStartEnabled:
              revision() % 2 === 0,
            autoResumeFromIdle:
              revision() % 2 === 0,
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
            revision: revision(),
          },
          {
            kind:
              "documentFolder",
            ...meta(),
            id: folderId,
            workId,
            title: randomUUID(),
            orderKey:
              randomUUID(),
          },
          {
            kind: "blobManifest",
            blobRef,
            checksumIdentity,
            checksumValue:
              randomUUID(),
            byteLength:
              content.length,
            createdAt: instant(),
            mediaType:
              randomUUID(),
            originalName:
              randomUUID(),
          },
          {
            kind: "document",
            ...meta(),
            id: documentId,
            workId,
            folderId,
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
              blobRef,
            contentHash:
              randomUUID(),
            length: content.length,
            cause: randomUUID(),
            createdAt: instant(),
            durableAt: instant(),
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
            updatedAt: instant(),
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
            endOffset:
              content.length,
            exactQuote: content,
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
            kind: "rangeGroup",
            ...meta(),
            id: rangeGroupId,
            workId,
            orderedAnchorIds: [
              anchorId,
            ],
          },
          {
            kind: "eventBlock",
            ...meta(),
            id: eventBlockId,
            workId,
            title: randomUUID(),
            outlineOrderKey:
              randomUUID(),
            collapsed:
              revision() % 2 === 0,
          },
          {
            kind: "eventSource",
            ...meta(),
            id: eventSourceId,
            workId,
            eventBlockId,
            rangeGroupId,
            role: "primary",
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
            capturedAt: instant(),
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
            startedAt: instant(),
            endedAt: instant(),
            lastDurableHeartbeatAt:
              instant(),
            startRevisionId:
              revisionId,
            endRevisionId:
              revisionId,
            recoveryEvidenceJson:
              runtimeJson(),
          },
          {
            kind:
              "activityInterval",
            id: intervalId,
            workId,
            sessionId,
            activityClass:
              randomUUID(),
            startedAt: instant(),
            endedAt: instant(),
            documentId,
            eventBlockIds: [
              eventBlockId,
            ],
            evidenceCount:
              revision(),
            source: randomUUID(),
          },
          {
            kind: "focusCycle",
            ...meta(),
            id: focusCycleId,
            workId,
            sessionId,
            policyId:
              focusPolicyId,
            phaseRef:
              randomUUID(),
            state: randomUUID(),
            targetDuration:
              revision(),
            startedAt: instant(),
            deadlineAt: instant(),
          },
          {
            kind: "workSnapshot",
            id: snapshotId,
            workId,
            documentRevisions: [
              {
                documentId,
                documentRevisionId:
                  revisionId,
              },
            ],
            structureRevisionRefsJson:
              runtimeJson(),
            dictionaryRevisionRefsJson:
              runtimeJson(),
            manifestHash:
              randomUUID(),
            label: randomUUID(),
            cause: randomUUID(),
            createdAt: instant(),
          },
        ];
      return {
        records,
        workId,
        folderId,
        documentId,
        revisionId,
        anchorId,
        blobRef,
        snapshotId,
      };
    },
  );
  const migrationReceipt:
    Poc3LedgerRecord = {
      kind: "migrationReceipt",
      id: randomUUID(),
      migrationId: randomUUID(),
      fromSchemaVersion:
        targetSchemaVersion - 1,
      toSchemaVersion:
        targetSchemaVersion,
      migrationChecksumIdentity:
        checksumIdentity,
      migrationChecksumValue:
        randomUUID(),
      beforeChecksumValue:
        randomUUID(),
      afterChecksumValue:
        randomUUID(),
      startedAt: instant(),
      completedAt: instant(),
      progressReceiptJson:
        runtimeJson(),
    };

  return {
    records: [
      studio,
      ...slices.flatMap(
        (slice) =>
          slice.records,
      ),
      migrationReceipt,
    ],
    slices,
  };
}

function ledgerRecordOfKind<
  TKind extends
    Poc3LedgerRecord["kind"],
>(
  records:
    readonly Poc3LedgerRecord[],
  kind: TKind,
  identity: string,
): Extract<
  Poc3LedgerRecord,
  { readonly kind: TKind }
> {
  const record = records.find(
    (candidate) => {
      if (
        candidate.kind !== kind
      ) {
        return false;
      }
      if (
        "id" in candidate
      ) {
        return candidate.id ===
          identity;
      }
      return "blobRef" in candidate &&
        candidate.blobRef === identity;
    },
  );
  if (
    record === undefined ||
    record.kind !== kind
  ) {
    throw new Error(
      `Missing runtime ${kind} record`,
    );
  }
  return record as Extract<
    Poc3LedgerRecord,
    { readonly kind: TKind }
  >;
}

function readImmutableAuditRows(
  databasePath: string,
  identities: {
    readonly blobRef: string;
    readonly revisionId: string;
    readonly snapshotId: string;
  },
): unknown {
  const loaded =
    process.getBuiltinModule(
      "node:sqlite",
    ) as AuditSqliteModule | undefined;
  if (loaded === undefined) {
    throw new Error(
      "node:sqlite is unavailable",
    );
  }
  const database =
    new loaded.DatabaseSync(
      databasePath,
    );
  try {
    return {
      blobManifest:
        database
          .prepare(`
            SELECT *
            FROM blob_manifests
            WHERE blob_ref = ?
          `)
          .all(
            identities.blobRef,
          ),
      documentRevision:
        database
          .prepare(`
            SELECT *
            FROM document_revisions
            WHERE id = ?
          `)
          .all(
            identities.revisionId,
          ),
      workSnapshot:
        database
          .prepare(`
            SELECT *
            FROM work_snapshots
            WHERE id = ?
          `)
          .all(
            identities.snapshotId,
          ),
      workSnapshotDocuments:
        database
          .prepare(`
            SELECT *
            FROM work_snapshot_document_revisions
            WHERE work_snapshot_id = ?
            ORDER BY document_id
          `)
          .all(
            identities.snapshotId,
          ),
    };
  } finally {
    database.close();
  }
}

function loadAuditSqlite():
  AuditSqliteModule {
  const loaded =
    process.getBuiltinModule(
      "node:sqlite",
    ) as AuditSqliteModule | undefined;
  if (loaded === undefined) {
    throw new Error(
      "node:sqlite is unavailable",
    );
  }
  return loaded;
}

type DeleteProtectedIdentities = {
  readonly blobRef: string;
  readonly revisionId: string;
  readonly snapshotId: string;
  readonly snapshotDocumentId:
    string;
};

function readDeleteProtectedRows(
  databasePath: string,
  identities:
    DeleteProtectedIdentities,
): unknown {
  const loaded =
    loadAuditSqlite();
  const database =
    new loaded.DatabaseSync(
      databasePath,
    );
  try {
    return {
      blobManifest:
        database
          .prepare(`
            SELECT *
            FROM blob_manifests
            WHERE blob_ref = ?
          `)
          .all(
            identities.blobRef,
          ),
      documentRevision:
        database
          .prepare(`
            SELECT *
            FROM document_revisions
            WHERE id = ?
          `)
          .all(
            identities.revisionId,
          ),
      workSnapshot:
        database
          .prepare(`
            SELECT *
            FROM work_snapshots
            WHERE id = ?
          `)
          .all(
            identities.snapshotId,
          ),
      workSnapshotDocument:
        database
          .prepare(`
            SELECT *
            FROM work_snapshot_document_revisions
            WHERE work_snapshot_id = ?
              AND document_id = ?
          `)
          .all(
            identities.snapshotId,
            identities
              .snapshotDocumentId,
          ),
    };
  } finally {
    database.close();
  }
}

describe(
  "POC-3 storage open profile",
  () => {
    it(
      "preserves the exact caller database identity and requested SQLite settings",
      () => {
        const input = {
          databasePath: join(
            tmpdir(),
            randomUUID(),
            `${randomUUID()}.sqlite`,
          ),
          checksumIdentity:
            randomUUID(),
          requestedSettings: {
            journalMode: {
              applySql:
                randomUUID(),
              verifySql:
                randomUUID(),
              expectedRows: [
                {
                  [randomUUID()]:
                    randomUUID(),
                },
              ],
            },
            synchronous: {
              applySql:
                randomUUID(),
              verifySql:
                randomUUID(),
              expectedRows: [
                {
                  [randomUUID()]:
                    Number(
                      `1${Date.now()}`,
                    ),
                },
              ],
            },
            foreignKeys: {
              applySql:
                randomUUID(),
              verifySql:
                randomUUID(),
              expectedRows: [
                {
                  [randomUUID()]: 1,
                },
              ],
            },
          },
          targetSchemaVersion:
            Number(
              `2${Date.now()}`,
            ),
        };

        const parsed =
          parsePoc3StorageOpenProfile(
            input,
          );

        expect(parsed).toEqual(input);
        expect(
          Object.isFrozen(parsed),
        ).toBe(true);
        expect(
          Object.isFrozen(
            parsed.requestedSettings,
          ),
        ).toBe(true);
      },
    );
  },
);

describe(
  "POC-3 node:sqlite ledger schema",
  () => {
    it(
      "opens the exact caller database with verified settings, identity and approved tables",
      async () => {
        const fixture =
          await readFixtureManifest();
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const profile =
          parsePoc3StorageOpenProfile({
            databasePath: join(
              temporaryRoot,
              `${randomUUID()}.sqlite`,
            ),
            checksumIdentity:
              randomUUID(),
            requestedSettings:
              fixture.requestedSettings,
            targetSchemaVersion:
              fixture.targetSchemaVersion,
          });

        try {
          const service =
            await openNodeSqliteLedger(
              profile,
            );
          try {
            const transactionValue =
              randomUUID();
            await expect(
              service.transaction(
                async () =>
                  transactionValue,
              ),
            ).resolves.toBe(
              transactionValue,
            );
            expect(
              service.openReceipt,
            ).toMatchObject({
              databasePath:
                profile.databasePath,
              checksumIdentity:
                profile.checksumIdentity,
              targetSchemaVersion:
                profile.targetSchemaVersion,
              settingReadbacks:
                Object.fromEntries(
                  Object.entries(
                    fixture
                      .requestedSettings,
                  ).map(
                    ([
                      setting,
                      request,
                    ]) => [
                      setting,
                      request.expectedRows,
                    ],
                  ),
                ),
            });
            expect(
              service.openReceipt
                .schemaTableNames,
            ).toEqual(
              fixture.requiredTables,
            );
          } finally {
            service.close();
          }
        } finally {
          await rm(
            temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "creates PlotEventLink ownership foreign keys and active uniqueness indexes",
      async () => {
        const fixture = await readFixtureManifest();
        const temporaryRoot = await mkdtemp(
          join(tmpdir(), randomUUID()),
        );
        const profile = parsePoc3StorageOpenProfile({
          databasePath: join(temporaryRoot, `${randomUUID()}.sqlite`),
          checksumIdentity: randomUUID(),
          requestedSettings: fixture.requestedSettings,
          targetSchemaVersion: fixture.targetSchemaVersion,
        });

        try {
          const service = await openNodeSqliteLedger(profile);
          try {
            const loaded = loadAuditSqlite();
            const database = new loaded.DatabaseSync(profile.databasePath);
            try {
              expect(database.prepare(`
                SELECT name
                FROM sqlite_master
                WHERE type = 'table' AND name = 'plot_event_links'
              `).all()).toEqual([{ name: "plot_event_links" }]);
              expect(database.prepare(`
                SELECT name
                FROM pragma_index_list('plot_event_links')
                WHERE name IN (
                  'plot_event_links_active_pair_idx',
                  'plot_event_links_active_primary_idx',
                  'plot_event_links_event_active_idx'
                )
                ORDER BY name ASC
              `).all()).toEqual([
                { name: "plot_event_links_active_pair_idx" },
                { name: "plot_event_links_active_primary_idx" },
                { name: "plot_event_links_event_active_idx" },
              ]);
              expect(database.prepare(`
                SELECT COUNT(DISTINCT id) AS count
                FROM pragma_foreign_key_list('plot_event_links')
              `).all()).toEqual([{ count: 2 }]);
            } finally {
              database.close();
            }
          } finally {
            service.close();
          }
        } finally {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      },
    );

    it(
      "creates PlotBoard lane and placement ownership indexes",
      async () => {
        const fixture = await readFixtureManifest();
        const temporaryRoot = await mkdtemp(join(tmpdir(), randomUUID()));
        const profile = parsePoc3StorageOpenProfile({
          databasePath: join(temporaryRoot, randomUUID() + ".sqlite"),
          checksumIdentity: randomUUID(),
          requestedSettings: fixture.requestedSettings,
          targetSchemaVersion: fixture.targetSchemaVersion,
        });

        try {
          const service = await openNodeSqliteLedger(profile);
          try {
            const loaded = loadAuditSqlite();
            const database = new loaded.DatabaseSync(profile.databasePath);
            try {
              expect(database.prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('plot_boards', 'plot_lanes', 'plot_placements') ORDER BY name",
              ).all()).toEqual([
                { name: "plot_boards" },
                { name: "plot_lanes" },
                { name: "plot_placements" },
              ]);
              expect(database.prepare(
                "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('plot_lanes_default_idx', 'plot_placements_active_plot_idx', 'plot_placements_active_order_idx', 'plot_placements_lane_active_idx') ORDER BY name",
              ).all()).toEqual([
                { name: "plot_lanes_default_idx" },
                { name: "plot_placements_active_order_idx" },
                { name: "plot_placements_active_plot_idx" },
                { name: "plot_placements_lane_active_idx" },
              ]);
              expect(database.prepare(
                "SELECT COUNT(DISTINCT id) AS count FROM pragma_foreign_key_list('plot_boards')",
              ).all()).toEqual([{ count: 1 }]);
              expect(database.prepare(
                "SELECT COUNT(DISTINCT id) AS count FROM pragma_foreign_key_list('plot_lanes')",
              ).all()).toEqual([{ count: 1 }]);
              expect(database.prepare(
                "SELECT COUNT(DISTINCT id) AS count FROM pragma_foreign_key_list('plot_placements')",
              ).all()).toEqual([{ count: 3 }]);
            } finally {
              database.close();
            }
          } finally {
            service.close();
          }
        } finally {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      },
    );

    it(
      "creates SceneProjection rule and manual event exception ownership indexes",
      async () => {
        const fixture = await readFixtureManifest();
        const temporaryRoot = await mkdtemp(join(tmpdir(), randomUUID()));
        const profile = parsePoc3StorageOpenProfile({
          databasePath: join(temporaryRoot, randomUUID() + ".sqlite"),
          checksumIdentity: randomUUID(),
          requestedSettings: fixture.requestedSettings,
          targetSchemaVersion: fixture.targetSchemaVersion,
        });

        try {
          const service = await openNodeSqliteLedger(profile);
          try {
            const loaded = loadAuditSqlite();
            const database = new loaded.DatabaseSync(profile.databasePath);
            try {
              expect(database.prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('scene_rule_sets', 'scene_event_overrides') ORDER BY name",
              ).all()).toEqual([
                { name: "scene_event_overrides" },
                { name: "scene_rule_sets" },
              ]);
              expect(database.prepare(
                "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'scene_event_overrides_active_pair_idx'",
              ).all()).toEqual([
                { name: "scene_event_overrides_active_pair_idx" },
              ]);
              expect(database.prepare(
                "SELECT COUNT(DISTINCT id) AS count FROM pragma_foreign_key_list('scene_rule_sets')",
              ).all()).toEqual([{ count: 1 }]);
              expect(database.prepare(
                "SELECT COUNT(DISTINCT id) AS count FROM pragma_foreign_key_list('scene_event_overrides')",
              ).all()).toEqual([{ count: 1 }]);
            } finally {
              database.close();
            }
          } finally {
            service.close();
          }
        } finally {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      },
    );

    it(
      "commits the approved relational ledger graph in one application transaction",
      async () => {
        const fixture =
          await readFixtureManifest();
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const checksumIdentity =
          randomUUID();
        const profile =
          parsePoc3StorageOpenProfile({
            databasePath: join(
              temporaryRoot,
              `${randomUUID()}.sqlite`,
            ),
            checksumIdentity,
            requestedSettings:
              fixture.requestedSettings,
            targetSchemaVersion:
              fixture.targetSchemaVersion,
          });
        const graph =
          createRuntimeLedgerGraph(
            checksumIdentity,
            fixture
              .targetSchemaVersion,
          );

        try {
          const service =
            await openNodeSqliteLedger(
              profile,
            );
          try {
            await expect(
              service.transaction(
                async (tx) => {
                  for (
                    const record
                    of graph.records
                  ) {
                    tx.write(record);
                  }
                },
              ),
            ).resolves.toBeUndefined();
          } finally {
            service.close();
          }
        } finally {
          await rm(
            temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "rejects cross-work and cross-document relations plus immutable ledger updates",
      async () => {
        const fixture =
          await readFixtureManifest();
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const checksumIdentity =
          randomUUID();
        const profile =
          parsePoc3StorageOpenProfile({
            databasePath: join(
              temporaryRoot,
              `${randomUUID()}.sqlite`,
            ),
            checksumIdentity,
            requestedSettings:
              fixture.requestedSettings,
            targetSchemaVersion:
              fixture.targetSchemaVersion,
          });
        const graph =
          createRuntimeLedgerGraph(
            checksumIdentity,
            fixture
              .targetSchemaVersion,
          );
        const [
          first,
          second,
        ] = graph.slices;
        if (
          first === undefined ||
          second === undefined
        ) {
          throw new Error(
            "Runtime graph requires two caller-generated work slices",
          );
        }

        try {
          const service =
            await openNodeSqliteLedger(
              profile,
            );
          try {
            await service.transaction(
              async (tx) => {
                for (
                  const record
                  of graph.records
                ) {
                  tx.write(record);
                }
              },
            );
            const rejected = async (
              record:
                Poc3LedgerRecord,
            ): Promise<boolean> => {
              try {
                await service.transaction(
                  async (tx) => {
                    tx.write(record);
                  },
                );
                return false;
              } catch {
                return true;
              }
            };
            const sourceFolder =
              ledgerRecordOfKind(
                graph.records,
                "documentFolder",
                first.folderId,
              );
            const sourceAnchor =
              ledgerRecordOfKind(
                graph.records,
                "anchor",
                first.anchorId,
              );
            const sourceBlob =
              ledgerRecordOfKind(
                graph.records,
                "blobManifest",
                first.blobRef,
              );
            const sourceRevision =
              ledgerRecordOfKind(
                graph.records,
                "documentRevision",
                first.revisionId,
              );
            const sourceSnapshot =
              ledgerRecordOfKind(
                graph.records,
                "workSnapshot",
                first.snapshotId,
              );

            const results = {
              crossWork:
                await rejected({
                  ...sourceFolder,
                  id: randomUUID(),
                  parentFolderId:
                    second.folderId,
                  title:
                    randomUUID(),
                  orderKey:
                    randomUUID(),
                }),
              crossDocument:
                await rejected({
                  ...sourceAnchor,
                  id: randomUUID(),
                  originRevisionId:
                    second
                      .revisionId,
                  resolvedRevisionId:
                    second
                      .revisionId,
                }),
              blobManifestUpdate:
                await rejected({
                  ...sourceBlob,
                  checksumValue:
                    randomUUID(),
                }),
              documentRevisionUpdate:
                await rejected({
                  ...sourceRevision,
                  contentHash:
                    randomUUID(),
                }),
              workSnapshotUpdate:
                await rejected({
                  ...sourceSnapshot,
                  documentRevisions:
                    [],
                  manifestHash:
                    randomUUID(),
                }),
            };

            expect(results).toEqual(
              Object.fromEntries(
                Object.keys(
                  results,
                ).map((requirement) => [
                  requirement,
                  true,
                ]),
              ),
            );
          } finally {
            service.close();
          }
        } finally {
          await rm(
            temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "invalidates escaped transaction writes after both commit and rollback without changing the ledger",
      async () => {
        const fixture =
          await readFixtureManifest();
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const profile =
          parsePoc3StorageOpenProfile({
            databasePath: join(
              temporaryRoot,
              `${randomUUID()}.sqlite`,
            ),
            checksumIdentity:
              randomUUID(),
            requestedSettings:
              fixture.requestedSettings,
            targetSchemaVersion:
              fixture.targetSchemaVersion,
          });
        const runtimeStudio = (
          id: string,
        ): Extract<
          Poc3LedgerRecord,
          {
            readonly kind:
              "studio";
          }
        > => ({
          kind: "studio",
          id,
          displayName:
            randomUUID(),
          locale: randomUUID(),
          timezone: randomUUID(),
          settingsRevision:
            Date.now(),
          createdAt:
            new Date().toISOString(),
        });
        const afterCommit =
          runtimeStudio(
            randomUUID(),
          );
        const rolledBack =
          runtimeStudio(
            randomUUID(),
          );
        const afterRollback =
          runtimeStudio(
            randomUUID(),
          );

        try {
          const service =
            await openNodeSqliteLedger(
              profile,
            );
          try {
            let committedTx:
              StorageTransaction
              | undefined;
            await service.transaction(
              async (tx) => {
                committedTx = tx;
              },
            );
            expect(() =>
              committedTx!.write(
                afterCommit,
              ),
            ).toThrow();
            await expect(
              service.transaction(
                async (tx) => {
                  tx.write(
                    afterCommit,
                  );
                },
              ),
            ).resolves.toBeUndefined();

            let rolledBackTx:
              StorageTransaction
              | undefined;
            const callerFailure =
              new Error(
                randomUUID(),
              );
            await expect(
              service.transaction(
                async (tx) => {
                  rolledBackTx = tx;
                  tx.write(
                    rolledBack,
                  );
                  throw callerFailure;
                },
              ),
            ).rejects.toBe(
              callerFailure,
            );
            expect(() =>
              rolledBackTx!.write(
                afterRollback,
              ),
            ).toThrow();
            await expect(
              service.transaction(
                async (tx) => {
                  tx.write(
                    rolledBack,
                  );
                  tx.write(
                    afterRollback,
                  );
                },
              ),
            ).resolves.toBeUndefined();
          } finally {
            service.close();
          }
        } finally {
          await rm(
            temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "rejects duplicate immutable identities without mutating their existing rows",
      async () => {
        const fixture =
          await readFixtureManifest();
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const checksumIdentity =
          randomUUID();
        const profile =
          parsePoc3StorageOpenProfile({
            databasePath: join(
              temporaryRoot,
              `${randomUUID()}.sqlite`,
            ),
            checksumIdentity,
            requestedSettings:
              fixture.requestedSettings,
            targetSchemaVersion:
              fixture.targetSchemaVersion,
          });
        const graph =
          createRuntimeLedgerGraph(
            checksumIdentity,
            fixture
              .targetSchemaVersion,
          );
        const first =
          graph.slices[0];
        if (first === undefined) {
          throw new Error(
            "Runtime graph requires a caller-generated work slice",
          );
        }

        try {
          const service =
            await openNodeSqliteLedger(
              profile,
            );
          try {
            await service.transaction(
              async (tx) => {
                for (
                  const record
                  of graph.records
                ) {
                  tx.write(record);
                }
              },
            );
            const before =
              readImmutableAuditRows(
                profile.databasePath,
                first,
              );
            const sourceBlob =
              ledgerRecordOfKind(
                graph.records,
                "blobManifest",
                first.blobRef,
              );
            const sourceRevision =
              ledgerRecordOfKind(
                graph.records,
                "documentRevision",
                first.revisionId,
              );
            const sourceSnapshot =
              ledgerRecordOfKind(
                graph.records,
                "workSnapshot",
                first.snapshotId,
              );
            const duplicates:
              readonly Poc3LedgerRecord[] =
              [
                {
                  ...sourceBlob,
                  checksumValue:
                    randomUUID(),
                },
                {
                  ...sourceRevision,
                  contentHash:
                    randomUUID(),
                },
                {
                  ...sourceSnapshot,
                  manifestHash:
                    randomUUID(),
                },
              ];
            const errors:
              Error[] = [];
            for (
              const duplicate
              of duplicates
            ) {
              try {
                await service.transaction(
                  async (tx) => {
                    tx.write(
                      duplicate,
                    );
                  },
                );
              } catch (error) {
                if (
                  error instanceof
                    Error
                ) {
                  errors.push(error);
                }
              }
            }

            expect(errors).toHaveLength(
              duplicates.length,
            );
            expect(
              errors.every((error) =>
                error.message.includes(
                  "UNIQUE constraint failed",
                ),
              ),
            ).toBe(true);
            expect(
              readImmutableAuditRows(
                profile.databasePath,
                first,
              ),
            ).toEqual(before);
          } finally {
            service.close();
          }
        } finally {
          await rm(
            temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "rejects revision references on a WritingSession without a document while preserving composite ownership checks",
      async () => {
        const fixture =
          await readFixtureManifest();
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const checksumIdentity =
          randomUUID();
        const profile =
          parsePoc3StorageOpenProfile({
            databasePath: join(
              temporaryRoot,
              `${randomUUID()}.sqlite`,
            ),
            checksumIdentity,
            requestedSettings:
              fixture.requestedSettings,
            targetSchemaVersion:
              fixture.targetSchemaVersion,
          });
        const graph =
          createRuntimeLedgerGraph(
            checksumIdentity,
            fixture
              .targetSchemaVersion,
          );
        const [
          first,
          second,
        ] = graph.slices;
        if (
          first === undefined ||
          second === undefined
        ) {
          throw new Error(
            "Runtime graph requires two caller-generated work slices",
          );
        }
        const sourceSession =
          graph.records.find(
            (record) =>
              record.kind ===
                "writingSession" &&
              record.workId ===
                first.workId,
          );
        if (
          sourceSession ===
            undefined ||
          sourceSession.kind !==
            "writingSession"
        ) {
          throw new Error(
            "Runtime graph requires a WritingSession",
          );
        }
        const {
          documentId:
            omittedDocumentId,
          ...sourceSessionWithoutDocument
        } = sourceSession;
        if (
          omittedDocumentId !==
            first.documentId
        ) {
          throw new Error(
            "Runtime WritingSession document does not match its work slice",
          );
        }
        const withoutDocument:
          Poc3LedgerRecord = {
            ...sourceSessionWithoutDocument,
            id: randomUUID(),
            startRevisionId:
              first.revisionId,
            endRevisionId:
              first.revisionId,
          };
        const crossOwnedRevision:
          Poc3LedgerRecord = {
            ...sourceSession,
            id: randomUUID(),
            documentId:
              first.documentId,
            startRevisionId:
              second.revisionId,
            endRevisionId:
              first.revisionId,
          };

        try {
          const service =
            await openNodeSqliteLedger(
              profile,
            );
          try {
            await service.transaction(
              async (tx) => {
                for (
                  const record
                  of graph.records
                ) {
                  tx.write(record);
                }
              },
            );
            await expect(
              service.transaction(
                async (tx) => {
                  tx.write(
                    withoutDocument,
                  );
                },
              ),
            ).rejects.toThrow();
            await expect(
              service.transaction(
                async (tx) => {
                  tx.write(
                    crossOwnedRevision,
                  );
                },
              ),
            ).rejects.toThrow();
          } finally {
            service.close();
          }
        } finally {
          await rm(
            temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "rejects direct deletion of immutable revision, snapshot manifest and blob manifest rows without changing them",
      async () => {
        const fixture =
          await readFixtureManifest();
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const checksumIdentity =
          randomUUID();
        const profile =
          parsePoc3StorageOpenProfile({
            databasePath: join(
              temporaryRoot,
              `${randomUUID()}.sqlite`,
            ),
            checksumIdentity,
            requestedSettings:
              fixture.requestedSettings,
            targetSchemaVersion:
              fixture.targetSchemaVersion,
          });
        const graph =
          createRuntimeLedgerGraph(
            checksumIdentity,
            fixture
              .targetSchemaVersion,
          );
        const first =
          graph.slices[0];
        if (first === undefined) {
          throw new Error(
            "Runtime graph requires a caller-generated work slice",
          );
        }
        let instantOffset = 0;
        const instant = (): string =>
          new Date(
            Date.now() +
              instantOffset++,
          ).toISOString();
        const protectedIdentities:
          DeleteProtectedIdentities = {
            blobRef: randomUUID(),
            revisionId:
              randomUUID(),
            snapshotId:
              randomUUID(),
            snapshotDocumentId:
              first.documentId,
          };
        const protectedRecords:
          readonly Poc3LedgerRecord[] =
          [
            {
              kind: "blobManifest",
              blobRef:
                protectedIdentities
                  .blobRef,
              checksumIdentity,
              checksumValue:
                randomUUID(),
              byteLength:
                Date.now(),
              createdAt: instant(),
            },
            {
              kind:
                "documentRevision",
              id:
                protectedIdentities
                  .revisionId,
              workId: first.workId,
              documentId:
                first.documentId,
              parentRevisionId:
                first.revisionId,
              contentRef:
                protectedIdentities
                  .blobRef,
              contentHash:
                randomUUID(),
              length: Date.now(),
              cause: randomUUID(),
              createdAt: instant(),
              durableAt: instant(),
            },
            {
              kind: "workSnapshot",
              id:
                protectedIdentities
                  .snapshotId,
              workId: first.workId,
              documentRevisions: [
                {
                  documentId:
                    protectedIdentities
                      .snapshotDocumentId,
                  documentRevisionId:
                    first.revisionId,
                },
              ],
              structureRevisionRefsJson:
                runtimeJson(),
              manifestHash:
                randomUUID(),
              cause: randomUUID(),
              createdAt: instant(),
            },
          ];

        try {
          const service =
            await openNodeSqliteLedger(
              profile,
            );
          try {
            await service.transaction(
              async (tx) => {
                for (
                  const record
                  of graph.records
                ) {
                  tx.write(record);
                }
                for (
                  const record
                  of protectedRecords
                ) {
                  tx.write(record);
                }
              },
            );
            const before =
              readDeleteProtectedRows(
                profile.databasePath,
                protectedIdentities,
              );
            const loaded =
              loadAuditSqlite();
            const database =
              new loaded.DatabaseSync(
                profile.databasePath,
              );
            const deletions =
              [
                {
                  sql: `
                    DELETE FROM work_snapshot_document_revisions
                    WHERE work_snapshot_id = ?
                      AND document_id = ?
                  `,
                  parameters: [
                    protectedIdentities
                      .snapshotId,
                    protectedIdentities
                      .snapshotDocumentId,
                  ],
                },
                {
                  sql: `
                    DELETE FROM document_revisions
                    WHERE id = ?
                  `,
                  parameters: [
                    protectedIdentities
                      .revisionId,
                  ],
                },
                {
                  sql: `
                    DELETE FROM work_snapshots
                    WHERE id = ?
                  `,
                  parameters: [
                    protectedIdentities
                      .snapshotId,
                  ],
                },
                {
                  sql: `
                    DELETE FROM blob_manifests
                    WHERE blob_ref = ?
                  `,
                  parameters: [
                    protectedIdentities
                      .blobRef,
                  ],
                },
              ] as const;
            const rejected:
              boolean[] = [];
            try {
              for (
                const deletion
                of deletions
              ) {
                try {
                  database
                    .prepare(
                      deletion.sql,
                    )
                    .run(
                      ...deletion
                        .parameters,
                    );
                  rejected.push(
                    false,
                  );
                } catch {
                  rejected.push(
                    true,
                  );
                }
              }
            } finally {
              database.close();
            }

            expect(rejected).toEqual(
              Array.from(
                {
                  length:
                    deletions.length,
                },
                () => true,
              ),
            );
            expect(
              readDeleteProtectedRows(
                profile.databasePath,
                protectedIdentities,
              ),
            ).toEqual(before);
          } finally {
            service.close();
          }
        } finally {
          await rm(
            temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );
  },
);
