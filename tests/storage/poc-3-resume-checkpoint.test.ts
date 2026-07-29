import {
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
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

import {
  CaptureResumeCheckpointWithAnchors,
  type CaptureResumeCheckpointWithAnchorsInput,
} from "../../src/application/checkpoints/capture-resume-checkpoint-with-anchors";
import {
  ResumeCheckpointConflictError,
} from "../../src/application/checkpoints/capture-resume-checkpoint";
import type {
  RevisionStore,
} from "../../src/application/revisions/revision-store";
import type {
  Poc3AnchorRecord,
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
  openNodeSqliteLedger,
} from "../../src/platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../../src/platform/storage/node-sqlite-ledger-profile";

type LedgerFixtureManifest = {
  readonly requestedSettings:
    Record<string, unknown>;
  readonly targetSchemaVersion:
    number;
};

type ResumeCheckpointFixtureManifest = {
  readonly counts: {
    readonly concurrentConnectionCount:
      number;
    readonly selectionWidth:
      number;
    readonly contextWidth:
      number;
  };
  readonly materials: {
    readonly manuscriptTextParts:
      readonly [
        string,
        ...string[],
      ];
    readonly anchorStatuses:
      readonly [
        AnchorStatus,
        ...AnchorStatus[],
      ];
    readonly resolutionMethods:
      readonly [
        AnchorResolutionMethod,
        ...AnchorResolutionMethod[],
      ];
    readonly matchedEvidence:
      readonly [
        AnchorMatchedEvidence,
        ...AnchorMatchedEvidence[],
      ];
  };
};

type RuntimeClock = {
  instant(): string;
  revision(): number;
};

type Deferred = {
  readonly promise:
    Promise<void>;
  resolve(): void;
};

function createDeferred():
  Deferred {
  let resolvePromise:
    (() => void) | undefined;
  const promise =
    new Promise<void>(
      (resolve) => {
        resolvePromise =
          resolve;
      },
    );
  return Object.freeze({
    promise,
    resolve:
      resolvePromise!,
  });
}

type RuntimeWorkBundle = {
  readonly work: Work;
  readonly document: Document;
  readonly revision:
    DocumentRevision;
  readonly content: string;
  readonly records:
    readonly Poc3LedgerRecord[];
};

type RuntimeContext = {
  readonly fixture:
    ResumeCheckpointFixtureManifest;
  readonly temporaryRoot:
    string;
  readonly storageOpenProfile:
    ReturnType<
      typeof parsePoc3StorageOpenProfile
    >;
  readonly clock: RuntimeClock;
  readonly primary:
    RuntimeWorkBundle;
  readonly secondary:
    RuntimeWorkBundle;
  readonly revisionStore:
    RevisionStore;
  readonly ledger: Awaited<
    ReturnType<
      typeof openNodeSqliteLedger
    >
  >;
  readonly transaction:
    ReturnType<
      Awaited<
        ReturnType<
          typeof openNodeSqliteLedger
        >
      >[
        "createResumeCheckpointCaptureTransaction"
      ]
    >;
  readonly command:
    CaptureResumeCheckpointWithAnchors;
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

function createMeta<
  TEntity extends string,
>(
  id: EntityId<TEntity>,
  targetSchemaVersion: number,
  clock: RuntimeClock,
): RecordMeta<TEntity> {
  const createdAt =
    clock.instant();
  return Object.freeze({
    id,
    schemaVersion:
      targetSchemaVersion,
    revision: clock.revision(),
    createdAt,
    updatedAt: clock.instant(),
  });
}

function runtimeJsonObject():
  Readonly<
    Record<string, unknown>
  > {
  return Object.freeze({
    [randomUUID()]:
      Object.freeze({
        [randomUUID()]:
          randomUUID(),
      }),
    [randomUUID()]:
      Object.freeze([
        randomUUID(),
      ]),
  });
}

function runtimeManuscript(
  fixture:
    ResumeCheckpointFixtureManifest,
): string {
  return fixture
    .materials
    .manuscriptTextParts
    .map(
      (part) =>
        `${part}${randomUUID()}`,
    )
    .join(randomUUID());
}

function createWorkBundle(input: {
  readonly studioId: string;
  readonly checksumIdentity:
    string;
  readonly targetSchemaVersion:
    number;
  readonly clock: RuntimeClock;
  readonly fixture:
    ResumeCheckpointFixtureManifest;
  readonly includeOptionals:
    boolean;
  readonly divergentDurable:
    boolean;
}): RuntimeWorkBundle {
  const workId =
    entityId<"Work">(
      randomUUID(),
    );
  const settingsId =
    entityId<"WorkSettings">(
      randomUUID(),
    );
  const activityPolicyId =
    randomUUID();
  const focusPolicyId =
    randomUUID();
  const workMeta =
    createMeta(
      workId,
      input.targetSchemaVersion,
      input.clock,
    );
  const customFields =
    input.includeOptionals
      ? runtimeJsonObject()
      : undefined;
  const work: Work =
    Object.freeze({
      meta: workMeta,
      studioId:
        entityId<"Studio">(
          input.studioId,
        ),
      title: randomUUID(),
      ...(input.includeOptionals
        ? {
            subtitle:
              randomUUID(),
            kindRef:
              entityId<"DictionaryValue">(
                randomUUID(),
              ),
            statusRef:
              entityId<"DictionaryValue">(
                randomUUID(),
              ),
          }
        : {}),
      orderKey: randomUUID(),
      settingsId,
      ...(customFields ===
      undefined
        ? {}
        : { customFields }),
    });
  const documentId =
    entityId<"Document">(
      randomUUID(),
    );
  const manuscriptId =
    entityId<"Manuscript">(
      randomUUID(),
    );
  const documentMeta =
    createMeta(
      documentId,
      input.targetSchemaVersion,
      input.clock,
    );
  const document:
    Document =
    Object.freeze({
      meta: documentMeta,
      workId,
      ...(input.includeOptionals
        ? {
            folderId:
              entityId<"DocumentFolder">(
                randomUUID(),
              ),
            documentKindRef:
              entityId<"DictionaryValue">(
                randomUUID(),
              ),
          }
        : {}),
      title: randomUUID(),
      orderKey: randomUUID(),
      manuscriptId,
      ...(input.includeOptionals
        ? {
            sceneRuleSetId:
              entityId<"SceneRuleSet">(
                randomUUID(),
              ),
            archivedAt:
              input.clock.instant(),
          }
        : {}),
    });
  const content =
    runtimeManuscript(
      input.fixture,
    );
  const currentBlobRef =
    randomUUID();
  const currentRevision:
    DocumentRevision =
    Object.freeze({
      id:
        entityId<"DocumentRevision">(
          randomUUID(),
        ),
      documentId,
      contentRef:
        currentBlobRef,
      contentHash:
        randomUUID(),
      length: content.length,
      cause: randomUUID(),
      createdAt:
        input.clock.instant(),
      durableAt:
        input.clock.instant(),
    });
  const previousBlobRef =
    input.divergentDurable
      ? randomUUID()
      : null;
  const previousRevision =
    input.divergentDurable
      ? Object.freeze({
          id:
            entityId<"DocumentRevision">(
              randomUUID(),
            ),
          documentId,
          contentRef:
            previousBlobRef as string,
          contentHash:
            randomUUID(),
          length:
            runtimeManuscript(
              input.fixture,
            ).length,
          cause: randomUUID(),
          createdAt:
            input.clock.instant(),
          durableAt:
            input.clock.instant(),
        } satisfies DocumentRevision)
      : null;
  const revision:
    DocumentRevision =
    previousRevision === null
      ? currentRevision
      : Object.freeze({
          ...currentRevision,
          parentRevisionId:
            previousRevision.id,
        });
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
    Poc3LedgerRecord[] = [
      {
        kind: "work",
        ...metaRecord(work.meta),
        id: work.meta.id,
        studioId:
          work.studioId,
        title: work.title,
        ...(work.subtitle ===
        undefined
          ? {}
          : {
              subtitle:
                work.subtitle,
            }),
        ...(work.kindRef ===
        undefined
          ? {}
          : {
              kindRef:
                work.kindRef,
            }),
        ...(work.statusRef ===
        undefined
          ? {}
          : {
              statusRef:
                work.statusRef,
            }),
        orderKey:
          work.orderKey,
        settingsId:
          work.settingsId,
        ...(work.customFields ===
        undefined
          ? {}
          : {
              customFieldsJson:
                JSON.stringify(
                  work.customFields,
                ),
            }),
      },
      {
        kind:
          "activityPolicy",
        ...metaRecord(
          createMeta(
            entityId<"ActivityPolicy">(
              activityPolicyId,
            ),
            input
              .targetSchemaVersion,
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
          JSON.stringify(
            runtimeJsonObject(),
          ),
        autoStartEnabled:
          input.clock.revision() %
            input
              .targetSchemaVersion ===
          0,
        autoResumeFromIdle:
          input.clock.revision() %
            input
              .targetSchemaVersion ===
          0,
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
            input
              .targetSchemaVersion,
            input.clock,
          ),
        ),
        id: focusPolicyId,
        workId,
        phaseDefinitionsJson:
          JSON.stringify(
            runtimeJsonObject(),
          ),
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
          JSON.stringify(
            runtimeJsonObject(),
          ),
        revision:
          input.clock.revision(),
      },
    ];
  if (
    document.folderId !==
    undefined
  ) {
    records.push({
      kind:
        "documentFolder",
      ...metaRecord(
        createMeta(
          document.folderId,
          input
            .targetSchemaVersion,
          input.clock,
        ),
      ),
      id: document.folderId,
      workId,
      title: randomUUID(),
      orderKey: randomUUID(),
    });
  }
  records.push({
    kind: "document",
    ...metaRecord(
      document.meta,
    ),
    id: document.meta.id,
    workId,
    ...(document.folderId ===
    undefined
      ? {}
      : {
          folderId:
            document.folderId,
        }),
    ...(document.documentKindRef ===
    undefined
      ? {}
      : {
          documentKindRef:
            document
              .documentKindRef,
        }),
    title: document.title,
    orderKey:
      document.orderKey,
    manuscriptId,
    ...(document.sceneRuleSetId ===
    undefined
      ? {}
      : {
          sceneRuleSetId:
            document
              .sceneRuleSetId,
        }),
    ...(document.archivedAt ===
    undefined
      ? {}
      : {
          archivedAt:
            document.archivedAt,
        }),
  });
  const pushRevisionRecords = (
    value: DocumentRevision,
  ): void => {
    records.push(
      {
        kind: "blobManifest",
        blobRef:
          value.contentRef,
        checksumIdentity:
          input.checksumIdentity,
        checksumValue:
          randomUUID(),
        byteLength:
          value.length,
        createdAt:
          input.clock.instant(),
        mediaType: randomUUID(),
        originalName:
          randomUUID(),
      },
      {
        kind:
          "documentRevision",
        id: value.id,
        workId,
        documentId,
        ...(value.parentRevisionId ===
        undefined
          ? {}
          : {
              parentRevisionId:
                value
                  .parentRevisionId,
            }),
        contentRef:
          value.contentRef,
        contentHash:
          value.contentHash,
        length: value.length,
        cause: value.cause,
        createdAt:
          value.createdAt,
        durableAt:
          value.durableAt,
      },
    );
  };
  if (
    previousRevision !== null
  ) {
    pushRevisionRecords(
      previousRevision,
    );
  }
  pushRevisionRecords(
    revision,
  );
  records.push({
    kind: "manuscript",
    id: manuscriptId,
    workId,
    documentId,
    currentRevisionId:
      revision.id,
    durableRevisionId:
      previousRevision?.id ??
      revision.id,
    updatedAt:
      revision.durableAt,
  });

  return Object.freeze({
    work,
    document,
    revision,
    content,
    records:
      Object.freeze(records),
  });
}

function createRevisionStore(
  bundles:
    readonly RuntimeWorkBundle[],
): RevisionStore {
  const revisionsByDocument =
    new Map<
      EntityId<"Document">,
      DocumentRevision
    >();
  const revisionsById =
    new Map<
      EntityId<"DocumentRevision">,
      DocumentRevision
    >();
  const contentByRevision =
    new Map<
      EntityId<"DocumentRevision">,
      string
    >();
  for (
    const bundle of bundles
  ) {
    revisionsByDocument.set(
      bundle.document.meta.id,
      bundle.revision,
    );
    revisionsById.set(
      bundle.revision.id,
      bundle.revision,
    );
    contentByRevision.set(
      bundle.revision.id,
      bundle.content,
    );
  }
  return Object.freeze({
    append: async () => {
      throw new Error(
        randomUUID(),
      );
    },
    getCurrentRevision: async (
      documentId,
    ) =>
      revisionsByDocument.get(
        documentId,
      ) ?? null,
    getRevision: async (
      revisionId,
    ) =>
      revisionsById.get(
        revisionId,
      ) ?? null,
    materialize: async (
      revisionId,
    ) => {
      const content =
        contentByRevision.get(
          revisionId,
        );
      if (
        content === undefined
      ) {
        throw new Error(
          randomUUID(),
        );
      }
      return content;
    },
  });
}

async function createRuntimeContext(
  options: {
    readonly includeOptionals?:
      boolean;
    readonly divergentDurable?:
      boolean;
    readonly beforeDatabaseCommit?:
      () => Promise<void>;
  } = {},
): Promise<RuntimeContext> {
  const ledgerFixture =
    await readJsonFixture<
      LedgerFixtureManifest
    >(
      "../fixtures/storage/poc-3-ledger.manifest.json",
    );
  const fixture =
    await readJsonFixture<
      ResumeCheckpointFixtureManifest
    >(
      "../fixtures/storage/poc-3-resume-checkpoint.manifest.json",
    );
  const temporaryRoot =
    await mkdtemp(
      join(
        tmpdir(),
        randomUUID(),
      ),
    );
  const clock =
    createRuntimeClock();
  const studioId =
    randomUUID();
  const checksumIdentity =
    randomUUID();
  const storageOpenProfile =
    parsePoc3StorageOpenProfile(
      {
        databasePath: join(
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
  const ledger =
    await openNodeSqliteLedger(
      storageOpenProfile,
    );
  try {
    const primary =
      createWorkBundle({
        studioId,
        checksumIdentity,
        targetSchemaVersion:
          ledgerFixture
            .targetSchemaVersion,
        clock,
        fixture,
        includeOptionals:
          options
            .includeOptionals ??
          true,
        divergentDurable:
          options
            .divergentDurable ??
          false,
      });
    const secondary =
      createWorkBundle({
        studioId,
        checksumIdentity,
        targetSchemaVersion:
          ledgerFixture
            .targetSchemaVersion,
        clock,
        fixture,
        includeOptionals:
          true,
        divergentDurable:
          false,
      });
    await ledger.transaction(
      async (tx) => {
        tx.write({
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
        });
        for (
          const record of [
            ...primary.records,
            ...secondary.records,
          ]
        ) {
          tx.write(record);
        }
      },
    );
    const catalog =
      createWritingCatalog({
        works: [
          primary.work,
          secondary.work,
        ],
        documents: [
          primary.document,
          secondary.document,
        ],
      });
    const revisionStore =
      createRevisionStore([
        primary,
        secondary,
      ]);
    const transaction =
      ledger
        .createResumeCheckpointCaptureTransaction(
          {
            ...(options
              .beforeDatabaseCommit ===
            undefined
              ? {}
              : {
                  beforeDatabaseCommit:
                    options
                      .beforeDatabaseCommit,
                }),
          },
        );
    const command =
      new CaptureResumeCheckpointWithAnchors(
        {
          catalog,
          revisionStore,
          transaction,
        },
      );
    return Object.freeze({
      fixture,
      temporaryRoot,
      storageOpenProfile,
      clock,
      primary,
      secondary,
      revisionStore,
      ledger,
      transaction,
      command,
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

function createAnchor(input: {
  readonly context:
    RuntimeContext;
  readonly bundle:
    RuntimeWorkBundle;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly includeOptionals:
    boolean;
  readonly anchorId?:
    EntityId<"Anchor">;
  readonly originRevisionId?:
    EntityId<"DocumentRevision">;
  readonly resolvedRevisionId?:
    EntityId<"DocumentRevision">;
}): Anchor {
  const {
    context,
    bundle,
  } = input;
  const startOffset =
    input.startOffset;
  const endOffset =
    input.endOffset;
  const contextWidth =
    context.fixture
      .counts.contextWidth;
  return Object.freeze({
    meta: createMeta(
      input.anchorId ??
        entityId<"Anchor">(
          randomUUID(),
        ),
      context
        .storageOpenProfile
        .targetSchemaVersion,
      context.clock,
    ),
    documentId:
      bundle.document.meta.id,
    originRevisionId:
      input.originRevisionId ??
      bundle.revision.id,
    resolvedRevisionId:
      input.resolvedRevisionId ??
      bundle.revision.id,
    startOffset,
    endOffset,
    exactQuote:
      bundle.content.slice(
        startOffset,
        endOffset,
      ),
    prefixContext:
      bundle.content.slice(
        Math.max(
          0,
          startOffset -
            contextWidth,
        ),
        startOffset,
      ),
    suffixContext:
      bundle.content.slice(
        endOffset,
        endOffset +
          contextWidth,
      ),
    quoteHash: randomUUID(),
    contextHash:
      randomUUID(),
    ...(input.includeOptionals
      ? {
          lineageRef:
            entityId<"AnchorLineage">(
              randomUUID(),
            ),
        }
      : {}),
    status:
      context.fixture
        .materials
        .anchorStatuses[0],
    resolutionEvidence:
      Object.freeze({
        targetRevisionId:
          bundle.revision.id,
        method:
          context.fixture
            .materials
            .resolutionMethods[0],
        matchedEvidence:
          Object.freeze([
            ...context.fixture
              .materials
              .matchedEvidence,
          ]),
        candidateOffsets:
          Object.freeze([
            startOffset,
            endOffset,
          ]),
        policyVersion:
          randomUUID(),
        assessedAt:
          context.clock.instant(),
        ...(input.includeOptionals
          ? {
              commandRef:
                randomUUID(),
              actorRef:
                randomUUID(),
            }
          : {}),
      }),
  });
}

function createCaptureInput(input: {
  readonly context:
    RuntimeContext;
  readonly bundle?:
    RuntimeWorkBundle;
  readonly work?: Work;
  readonly includeSelection?:
    boolean;
  readonly includeOptionals?:
    boolean;
  readonly checkpointId?:
    EntityId<"ResumeCheckpoint">;
}): CaptureResumeCheckpointWithAnchorsInput {
  const bundle =
    input.bundle ??
    input.context.primary;
  const work =
    input.work ??
    bundle.work;
  const includeSelection =
    input.includeSelection ??
    true;
  const includeOptionals =
    input.includeOptionals ??
    true;
  const cursorOffset =
    randomInt(
      0,
      bundle.content.length +
        1,
    );
  const selectionWidth =
    input.context.fixture
      .counts.selectionWidth;
  const selectionStart =
    randomInt(
      0,
      bundle.content.length -
        selectionWidth +
        1,
    );
  const cursorAnchor =
    createAnchor({
      context:
        input.context,
      bundle,
      startOffset:
        cursorOffset,
      endOffset:
        cursorOffset,
      includeOptionals,
    });
  const selectionAnchor =
    includeSelection
      ? createAnchor({
          context:
            input.context,
          bundle,
          startOffset:
            selectionStart,
          endOffset:
            selectionStart +
            selectionWidth,
          includeOptionals,
        })
      : undefined;
  const capturedAt =
    input.context
      .clock.instant();
  const checkpoint:
    ResumeCheckpoint =
    Object.freeze({
      meta: createMeta(
        input.checkpointId ??
          entityId<"ResumeCheckpoint">(
            randomUUID(),
          ),
        input.context
          .storageOpenProfile
          .targetSchemaVersion,
        input.context.clock,
      ),
      workId: work.meta.id,
      documentId:
        bundle.document.meta.id,
      documentRevisionId:
        bundle.revision.id,
      cursorAnchorId:
        cursorAnchor.meta.id,
      ...(selectionAnchor ===
      undefined
        ? {}
        : {
            selectionAnchorId:
              selectionAnchor
                .meta.id,
          }),
      workspaceMode:
        randomUUID(),
      ...(includeOptionals
        ? {
            contextRefs:
              Object.freeze([
                Object.freeze({
                  entityType:
                    randomUUID(),
                  entityId:
                    randomUUID(),
                }),
              ]),
            focusCheckpointId:
              entityId<"FocusCheckpoint">(
                randomUUID(),
              ),
            musicCheckpointId:
              entityId<"MusicCheckpoint">(
                randomUUID(),
              ),
          }
        : {}),
      capturedAt,
    });
  return Object.freeze({
    checkpoint,
    cursorAnchor,
    ...(selectionAnchor ===
    undefined
      ? {}
      : { selectionAnchor }),
    expectedWorkRevision:
      work.meta.revision,
    expectedResumeCheckpointId:
      work.resumeCheckpointId ??
      null,
    expectedDocumentRevisionId:
      bundle.revision.id,
  });
}

function expectedWork(
  work: Work,
  checkpoint:
    ResumeCheckpoint,
): Work {
  return {
    ...work,
    meta: {
      ...work.meta,
      revision:
        work.meta.revision + 1,
      updatedAt:
        checkpoint.capturedAt,
    },
    resumeCheckpointId:
      checkpoint.meta.id,
  };
}

function anchorRecord(
  workId:
    EntityId<"Work">,
  anchor: Anchor,
): Poc3AnchorRecord {
  return {
    kind: "anchor",
    id: anchor.meta.id,
    schemaVersion:
      anchor.meta.schemaVersion,
    revision:
      anchor.meta.revision,
    createdAt:
      anchor.meta.createdAt,
    updatedAt:
      anchor.meta.updatedAt,
    ...(anchor.meta.retiredAt ===
    undefined
      ? {}
      : {
          retiredAt:
            anchor.meta.retiredAt,
        }),
    workId,
    documentId:
      anchor.documentId,
    originRevisionId:
      anchor.originRevisionId,
    resolvedRevisionId:
      anchor.resolvedRevisionId,
    startOffset:
      anchor.startOffset,
    endOffset:
      anchor.endOffset,
    exactQuote:
      anchor.exactQuote,
    prefixContext:
      anchor.prefixContext,
    suffixContext:
      anchor.suffixContext,
    quoteHash:
      anchor.quoteHash,
    contextHash:
      anchor.contextHash,
    ...(anchor.lineageRef ===
    undefined
      ? {}
      : {
          lineageRef:
            anchor.lineageRef,
        }),
    status: anchor.status,
    resolutionEvidenceJson:
      JSON.stringify(
        anchor
          .resolutionEvidence,
      ),
  };
}

function commitInput(
  capture:
    CaptureResumeCheckpointWithAnchorsInput,
  work: Work,
) {
  return {
    checkpoint:
      capture.checkpoint,
    cursorAnchor:
      capture.cursorAnchor,
    ...(capture.selectionAnchor ===
    undefined
      ? {}
      : {
          selectionAnchor:
            capture
              .selectionAnchor,
        }),
    expectedWorkRevision:
      capture
        .expectedWorkRevision,
    expectedResumeCheckpointId:
      capture
        .expectedResumeCheckpointId,
    expectedDocumentRevisionId:
      capture
        .expectedDocumentRevisionId,
    expectedDocumentRevisionLength:
      work.meta.id ===
      capture.checkpoint.workId
        ? capture.cursorAnchor
            .resolutionEvidence
            .candidateOffsets
            .reduce(
              (maximum, value) =>
                Math.max(
                  maximum,
                  value,
                ),
              0,
            ) +
          (
            capture.selectionAnchor
              ?.suffixContext
              .length ?? 0
          )
        : 0,
    nextWork: expectedWork(
      work,
      capture.checkpoint,
    ),
  };
}

async function expectNoCapture(
  context: RuntimeContext,
  capture:
    CaptureResumeCheckpointWithAnchorsInput,
): Promise<void> {
  await expect(
    context.transaction.getWork(
      context.primary.work
        .meta.id,
    ),
  ).resolves.toEqual(
    context.primary.work,
  );
  await expect(
    context.transaction.getWork(
      context.secondary.work
        .meta.id,
    ),
  ).resolves.toEqual(
    context.secondary.work,
  );
  await expect(
    context.transaction
      .getCheckpointById(
        capture.checkpoint
          .meta.id,
      ),
  ).resolves.toBeNull();
  await expect(
    context.transaction
      .getAnchorById(
        capture.cursorAnchor
          .meta.id,
      ),
  ).resolves.toBeNull();
  if (
    capture.selectionAnchor !==
    undefined
  ) {
    await expect(
      context.transaction
        .getAnchorById(
          capture
            .selectionAnchor
            .meta.id,
        ),
    ).resolves.toBeNull();
  }
}

describe("POC-3 SQLite ResumeCheckpoint capture", () => {
  it("atomically writes exact optional Work, Anchor, and checkpoint payloads", async () => {
    const context =
      await createRuntimeContext();
    try {
      const capture =
        createCaptureInput({
          context,
        });
      const work =
        expectedWork(
          context.primary.work,
          capture.checkpoint,
        );

      await expect(
        context.command.execute(
          capture,
        ),
      ).resolves.toEqual({
        checkpoint:
          capture.checkpoint,
        work,
      });
      await expect(
        context.transaction
          .getWork(
            work.meta.id,
          ),
      ).resolves.toEqual(work);
      await expect(
        context.transaction
          .getCheckpointById(
            capture.checkpoint
              .meta.id,
          ),
      ).resolves.toEqual(
        capture.checkpoint,
      );
      await expect(
        context.transaction
          .getAnchorById(
            capture.cursorAnchor
              .meta.id,
          ),
      ).resolves.toEqual(
        capture.cursorAnchor,
      );
      await expect(
        context.transaction
          .getAnchorById(
            capture
              .selectionAnchor!
              .meta.id,
          ),
      ).resolves.toEqual(
        capture.selectionAnchor,
      );
      expect(
        (
          await context.transaction
            .getAnchorById(
              capture
                .selectionAnchor!
                .meta.id,
            )
        )?.startOffset,
      ).toBe(
        capture.selectionAnchor
          ?.startOffset,
      );
      expect(
        (
          await context.transaction
            .getAnchorById(
              capture
                .selectionAnchor!
                .meta.id,
            )
        )?.endOffset,
      ).toBe(
        capture.selectionAnchor
          ?.endOffset,
      );
      await expect(
        context.transaction
          .getCheckpointById(
            entityId<"ResumeCheckpoint">(
              randomUUID(),
            ),
          ),
      ).resolves.toBeNull();
      await expect(
        context.transaction
          .getAnchorById(
            entityId<"Anchor">(
              randomUUID(),
            ),
          ),
      ).resolves.toBeNull();
    } finally {
      await context.close();
    }
  });

  it("round-trips omitted optional fields and a cursor-only checkpoint", async () => {
    const context =
      await createRuntimeContext({
        includeOptionals:
          false,
      });
    try {
      const capture =
        createCaptureInput({
          context,
          includeSelection:
            false,
          includeOptionals:
            false,
        });
      const work =
        expectedWork(
          context.primary.work,
          capture.checkpoint,
        );

      await expect(
        context.command.execute(
          capture,
        ),
      ).resolves.toEqual({
        checkpoint:
          capture.checkpoint,
        work,
      });
      await expect(
        context.transaction
          .getWork(
            work.meta.id,
          ),
      ).resolves.toEqual(work);
      await expect(
        context.transaction
          .getCheckpointById(
            capture.checkpoint
              .meta.id,
          ),
      ).resolves.toEqual(
        capture.checkpoint,
      );
      await expect(
        context.transaction
          .getAnchorById(
            capture.cursorAnchor
              .meta.id,
          ),
      ).resolves.toEqual(
        capture.cursorAnchor,
      );
      expect(
        capture.selectionAnchor,
      ).toBeUndefined();
      expect(
        capture.checkpoint
          .selectionAnchorId,
      ).toBeUndefined();
      expect(
        capture.checkpoint
          .contextRefs,
      ).toBeUndefined();
      expect(
        capture.cursorAnchor
          .lineageRef,
      ).toBeUndefined();
      expect(
        capture.cursorAnchor
          .resolutionEvidence
          .commandRef,
      ).toBeUndefined();
      expect(
        capture.cursorAnchor
          .resolutionEvidence
          .actorRef,
      ).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it("stores one exact Anchor when cursor and selection reference the same supplied identity", async () => {
    const context =
      await createRuntimeContext();
    try {
      const original =
        createCaptureInput({
          context,
        });
      const capture:
        CaptureResumeCheckpointWithAnchorsInput =
        {
          ...original,
          checkpoint: {
            ...original
              .checkpoint,
            selectionAnchorId:
              original
                .cursorAnchor
                .meta.id,
          },
          selectionAnchor:
            original.cursorAnchor,
        };

      await expect(
        context.command.execute(
          capture,
        ),
      ).resolves.toEqual({
        checkpoint:
          capture.checkpoint,
        work: expectedWork(
          context.primary.work,
          capture.checkpoint,
        ),
      });
      await expect(
        context.transaction
          .getAnchorById(
            capture.cursorAnchor
              .meta.id,
          ),
      ).resolves.toEqual(
        capture.cursorAnchor,
      );
    } finally {
      await context.close();
    }
  });

  it("rejects wrong ownership, revision, Anchor identity, and offset payloads without writes", async () => {
    const invalidCases: readonly {
      readonly label: string;
      mutate(
        capture:
          CaptureResumeCheckpointWithAnchorsInput,
        context:
          RuntimeContext,
      ):
        CaptureResumeCheckpointWithAnchorsInput;
    }[] = [
      {
        label:
          "cursor reference",
        mutate: (capture) => ({
          ...capture,
          checkpoint: {
            ...capture.checkpoint,
            cursorAnchorId:
              entityId<"Anchor">(
                randomUUID(),
              ),
          },
        }),
      },
      {
        label:
          "selection reference",
        mutate: (capture) => ({
          ...capture,
          checkpoint: {
            ...capture.checkpoint,
            selectionAnchorId:
              entityId<"Anchor">(
                randomUUID(),
              ),
          },
        }),
      },
      {
        label:
          "cross-Work document",
        mutate: (
          capture,
          context,
        ) => ({
          ...capture,
          checkpoint: {
            ...capture.checkpoint,
            workId:
              context.secondary
                .work.meta.id,
          },
        }),
      },
      {
        label:
          "checkpoint revision",
        mutate: (capture) => ({
          ...capture,
          checkpoint: {
            ...capture.checkpoint,
            documentRevisionId:
              entityId<"DocumentRevision">(
                randomUUID(),
              ),
          },
        }),
      },
      {
        label:
          "Anchor origin revision",
        mutate: (capture) => ({
          ...capture,
          cursorAnchor: {
            ...capture.cursorAnchor,
            originRevisionId:
              entityId<"DocumentRevision">(
                randomUUID(),
              ),
          },
        }),
      },
      {
        label:
          "Anchor resolved revision",
        mutate: (capture) => ({
          ...capture,
          cursorAnchor: {
            ...capture.cursorAnchor,
            resolvedRevisionId:
              entityId<"DocumentRevision">(
                randomUUID(),
              ),
          },
        }),
      },
      {
        label:
          "nonzero cursor",
        mutate: (
          capture,
          context,
        ) => ({
          ...capture,
          cursorAnchor:
            createAnchor({
              context,
              bundle:
                context.primary,
              anchorId:
                capture
                  .cursorAnchor
                  .meta.id,
              startOffset: 0,
              endOffset:
                context.fixture
                  .counts
                  .selectionWidth,
              includeOptionals:
                true,
            }),
        }),
      },
      {
        label:
          "negative offset",
        mutate: (capture) => ({
          ...capture,
          selectionAnchor: {
            ...capture
              .selectionAnchor!,
            startOffset: -1,
          },
        }),
      },
      {
        label:
          "reversed range",
        mutate: (capture) => ({
          ...capture,
          selectionAnchor: {
            ...capture
              .selectionAnchor!,
            startOffset:
              capture
                .selectionAnchor!
                .endOffset +
              1,
          },
        }),
      },
      {
        label:
          "out-of-range end",
        mutate: (
          capture,
          context,
        ) => ({
          ...capture,
          selectionAnchor: {
            ...capture
              .selectionAnchor!,
            endOffset:
              context.primary
                .revision
                .length +
              context.fixture
                .counts
                .selectionWidth,
          },
        }),
      },
      {
        label:
          "unsafe offset",
        mutate: (capture) => ({
          ...capture,
          selectionAnchor: {
            ...capture
              .selectionAnchor!,
            endOffset:
              Number
                .MAX_SAFE_INTEGER +
              1,
          },
        }),
      },
      {
        label:
          "fractional offset",
        mutate: (
          capture,
          context,
        ) => ({
          ...capture,
          selectionAnchor: {
            ...capture
              .selectionAnchor!,
            startOffset:
              context.fixture
                .counts
                .selectionWidth /
              (
                context.fixture
                  .counts
                  .selectionWidth +
                context
                  .storageOpenProfile
                  .targetSchemaVersion
              ),
          },
        }),
      },
    ];

    for (
      const invalidCase
      of invalidCases
    ) {
      const context =
        await createRuntimeContext();
      try {
        const validCapture =
          createCaptureInput({
            context,
          });
        const capture =
          invalidCase.mutate(
            validCapture,
            context,
          );

        await expect(
          context.command.execute(
            capture,
          ),
          invalidCase.label,
        ).rejects.toBeInstanceOf(
          Error,
        );
        await expectNoCapture(
          context,
          capture,
        );
        if (
          capture.cursorAnchor
            .meta.id !==
          validCapture
            .cursorAnchor.meta.id
        ) {
          await expect(
            context.transaction
              .getAnchorById(
                validCapture
                  .cursorAnchor
                  .meta.id,
              ),
          ).resolves.toBeNull();
        }
      } finally {
        await context.close();
      }
    }
  });

  it("rejects stale Work revision and pointer expectations without writes", async () => {
    const context =
      await createRuntimeContext();
    try {
      const capture =
        createCaptureInput({
          context,
        });
      await expect(
        context.command.execute({
          ...capture,
          expectedWorkRevision:
            capture
              .expectedWorkRevision +
            1,
        }),
      ).rejects.toBeInstanceOf(
        ResumeCheckpointConflictError,
      );
      await expectNoCapture(
        context,
        capture,
      );

      await expect(
        context.command.execute({
          ...capture,
          expectedResumeCheckpointId:
            entityId<"ResumeCheckpoint">(
              randomUUID(),
            ),
        }),
      ).rejects.toBeInstanceOf(
        ResumeCheckpointConflictError,
      );
      await expectNoCapture(
        context,
        capture,
      );
    } finally {
      await context.close();
    }
  });

  it("rechecks both manuscript revision pointers before writing", async () => {
    const context =
      await createRuntimeContext({
        divergentDurable:
          true,
      });
    try {
      const capture =
        createCaptureInput({
          context,
        });

      await expect(
        context.command.execute(
          capture,
        ),
      ).rejects.toBeInstanceOf(
        Error,
      );
      await expectNoCapture(
        context,
        capture,
      );
    } finally {
      await context.close();
    }
  });

  it("rejects duplicate Anchor and checkpoint identities without partial writes", async () => {
    const anchorContext =
      await createRuntimeContext();
    try {
      const capture =
        createCaptureInput({
          context:
            anchorContext,
        });
      await anchorContext
        .ledger.transaction(
          async (tx) => {
            tx.write(
              anchorRecord(
                anchorContext
                  .primary.work
                  .meta.id,
                capture
                  .cursorAnchor,
              ),
            );
          },
        );

      await expect(
        anchorContext
          .command.execute(
            capture,
          ),
      ).rejects.toBeInstanceOf(
        Error,
      );
      await expect(
        anchorContext
          .transaction
          .getWork(
            anchorContext
              .primary.work
              .meta.id,
          ),
      ).resolves.toEqual(
        anchorContext
          .primary.work,
      );
      await expect(
        anchorContext
          .transaction
          .getAnchorById(
            capture.cursorAnchor
              .meta.id,
          ),
      ).resolves.toEqual(
        capture.cursorAnchor,
      );
      await expect(
        anchorContext
          .transaction
          .getAnchorById(
            capture
              .selectionAnchor!
              .meta.id,
          ),
      ).resolves.toBeNull();
      await expect(
        anchorContext
          .transaction
          .getCheckpointById(
            capture.checkpoint
              .meta.id,
          ),
      ).resolves.toBeNull();
    } finally {
      await anchorContext.close();
    }

    const checkpointContext =
      await createRuntimeContext();
    try {
      const first =
        createCaptureInput({
          context:
            checkpointContext,
        });
      const firstWork =
        expectedWork(
          checkpointContext
            .primary.work,
          first.checkpoint,
        );
      await checkpointContext
        .command.execute(first);
      const duplicate =
        createCaptureInput({
          context:
            checkpointContext,
          work: firstWork,
          checkpointId:
            first.checkpoint
              .meta.id,
        });

      await expect(
        checkpointContext
          .command.execute(
            duplicate,
          ),
      ).rejects.toBeInstanceOf(
        Error,
      );
      await expect(
        checkpointContext
          .transaction
          .getWork(
            firstWork.meta.id,
          ),
      ).resolves.toEqual(
        firstWork,
      );
      await expect(
        checkpointContext
          .transaction
          .getCheckpointById(
            first.checkpoint
              .meta.id,
          ),
      ).resolves.toEqual(
        first.checkpoint,
      );
      await expect(
        checkpointContext
          .transaction
          .getAnchorById(
            duplicate
              .cursorAnchor.meta.id,
          ),
      ).resolves.toBeNull();
      await expect(
        checkpointContext
          .transaction
          .getAnchorById(
            duplicate
              .selectionAnchor!
              .meta.id,
          ),
      ).resolves.toBeNull();
    } finally {
      await checkpointContext
        .close();
    }
  });

  it("rolls back every row and the Work pointer when the caller hook fails before commit", async () => {
    const failure =
      new Error(randomUUID());
    const context =
      await createRuntimeContext({
        beforeDatabaseCommit:
          async () => {
            throw failure;
          },
      });
    try {
      const capture =
        createCaptureInput({
          context,
        });

      await expect(
        context.command.execute(
          capture,
        ),
      ).rejects.toBe(failure);
      await expectNoCapture(
        context,
        capture,
      );
    } finally {
      await context.close();
    }
  });

  it("rechecks stale Work state inside BEGIN IMMEDIATE", async () => {
    const context =
      await createRuntimeContext();
    try {
      const stale =
        createCaptureInput({
          context,
        });
      const staleCommit = {
        ...commitInput(
          stale,
          context.primary.work,
        ),
        expectedDocumentRevisionLength:
          context.primary
            .revision.length,
      };
      const winner =
        createCaptureInput({
          context,
        });
      const winnerWork =
        expectedWork(
          context.primary.work,
          winner.checkpoint,
        );
      await context.command.execute(
        winner,
      );

      await expect(
        context.transaction.commit(
          staleCommit,
        ),
      ).rejects.toBeInstanceOf(
        ResumeCheckpointConflictError,
      );
      await expect(
        context.transaction.getWork(
          winnerWork.meta.id,
        ),
      ).resolves.toEqual(
        winnerWork,
      );
      await expect(
        context.transaction
          .getCheckpointById(
            stale.checkpoint
              .meta.id,
          ),
      ).resolves.toBeNull();
      await expect(
        context.transaction
          .getAnchorById(
            stale.cursorAnchor
              .meta.id,
          ),
      ).resolves.toBeNull();
      await expect(
        context.transaction
          .getAnchorById(
            stale
              .selectionAnchor!
              .meta.id,
          ),
      ).resolves.toBeNull();
    } finally {
      await context.close();
    }
  });

  it("rejects a direct cross-Work platform commit without fallback", async () => {
    const context =
      await createRuntimeContext();
    try {
      const capture =
        createCaptureInput({
          context,
        });
      const crossWorkCheckpoint = {
        ...capture.checkpoint,
        workId:
          context.secondary
            .work.meta.id,
      };

      await expect(
        context.transaction.commit({
          ...commitInput(
            capture,
            context.secondary.work,
          ),
          checkpoint:
            crossWorkCheckpoint,
          expectedWorkRevision:
            context.secondary
              .work.meta.revision,
          expectedResumeCheckpointId:
            null,
          expectedDocumentRevisionLength:
            context.primary
              .revision.length,
          nextWork:
            expectedWork(
              context.secondary
                .work,
              crossWorkCheckpoint,
            ),
        }),
      ).rejects.toBeInstanceOf(
        Error,
      );
      await expectNoCapture(
        context,
        capture,
      );
    } finally {
      await context.close();
    }
  });

  it("allows one same-expectation connection to commit and reports the competing lock", async () => {
    const context =
      await createRuntimeContext();
    const reached =
      createDeferred();
    const release =
      createDeferred();
    const firstTransaction =
      context.ledger
        .createResumeCheckpointCaptureTransaction(
          {
            beforeDatabaseCommit:
              async () => {
                reached.resolve();
                await release.promise;
              },
          },
        );
    const firstCommand =
      new CaptureResumeCheckpointWithAnchors(
        {
          catalog:
            createWritingCatalog({
              works: [
                context.primary
                  .work,
                context.secondary
                  .work,
              ],
              documents: [
                context.primary
                  .document,
                context.secondary
                  .document,
              ],
            }),
          revisionStore:
            context.revisionStore,
          transaction:
            firstTransaction,
        },
      );
    const peerLedgers:
      Awaited<
        ReturnType<
          typeof openNodeSqliteLedger
        >
      >[] = [];
    try {
      for (
        let index = 1;
        index <
        context.fixture
          .counts
          .concurrentConnectionCount;
        index++
      ) {
        peerLedgers.push(
          await openNodeSqliteLedger(
            context
              .storageOpenProfile,
          ),
        );
      }
      expect(
        peerLedgers,
      ).toHaveLength(
        context.fixture
          .counts
          .concurrentConnectionCount -
          1,
      );
      const peerTransaction =
        peerLedgers[0]!
          .createResumeCheckpointCaptureTransaction(
            {},
          );
      const peerCommand =
        new CaptureResumeCheckpointWithAnchors(
          {
            catalog:
              createWritingCatalog({
                works: [
                  context.primary
                    .work,
                  context.secondary
                    .work,
                ],
                documents: [
                  context.primary
                    .document,
                  context.secondary
                    .document,
                ],
              }),
            revisionStore:
              context.revisionStore,
            transaction:
              peerTransaction,
          },
        );
      const winner =
        createCaptureInput({
          context,
        });
      const loser =
        createCaptureInput({
          context,
        });
      const winnerPromise =
        firstCommand.execute(
          winner,
        );
      await reached.promise;

      const lockError =
        await peerCommand
          .execute(loser)
          .then(
            () => null,
            (error: unknown) =>
              error,
          );
      expect(
        lockError,
      ).toBeInstanceOf(Error);
      expect(
        (
          lockError as Error
        ).message,
      ).toMatch(
        /busy|conflict|locked/i,
      );
      release.resolve();
      await expect(
        winnerPromise,
      ).resolves.toEqual({
        checkpoint:
          winner.checkpoint,
        work: expectedWork(
          context.primary.work,
          winner.checkpoint,
        ),
      });
      await expect(
        peerTransaction
          .getCheckpointById(
            loser.checkpoint
              .meta.id,
          ),
      ).resolves.toBeNull();
      await expect(
        peerTransaction
          .getAnchorById(
            loser.cursorAnchor
              .meta.id,
          ),
      ).resolves.toBeNull();
      await expect(
        peerTransaction
          .getAnchorById(
            loser
              .selectionAnchor!
              .meta.id,
          ),
      ).resolves.toBeNull();
      await expect(
        peerTransaction.getWork(
          context.primary.work
            .meta.id,
        ),
      ).resolves.toEqual(
        expectedWork(
          context.primary.work,
          winner.checkpoint,
        ),
      );
    } finally {
      release.resolve();
      for (
        const ledger
        of peerLedgers
      ) {
        ledger.close();
      }
      await context.close();
    }
  });
});
