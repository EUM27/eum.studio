import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import {
  CreateAnchor,
  type AnchorPolicy,
} from "../application/anchors/create-anchor";
import {
  CaptureResumeCheckpointWithAnchors,
} from "../application/checkpoints/capture-resume-checkpoint-with-anchors";
import {
  type LegacyLoreDryRunManuscriptProof,
  type LegacyLoreDryRunPlan,
  type LegacyLoreSharedLoreFinalization,
  type MigrationDisposition,
  type MigrationItemReceipt,
} from "../application/migration/legacy-lore-dry-run";
import type { LegacyLoreInventoryReport } from "../application/migration/legacy-lore-inventory";
import type { LegacyBrowserSourceExportReceipt } from "../application/migration/browser-source-export";
import type { MigrationSourceInspection } from "../application/migration/source-branch-inventory";
import type { StorageTransaction } from "../application/storage/storage-service";
import type { Poc3LedgerRecord } from "../domain/poc-3-storage-ledger";
import { createWritingCatalog, entityId } from "../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../platform/anchors/node-crypto-anchor-evidence";
import { createNodeImmutableBlobStore } from "../platform/storage/node-immutable-blob-store";
import { openNodeSqliteLedger } from "../platform/storage/node-sqlite-ledger";
import {
  createLocalWorkspaceRevisionBlobProfile,
  createLocalWorkspaceStorageProfiles,
  LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
} from "./local-workspace-runtime";

type ErrorWithCode = {
  readonly code?: unknown;
};

export type LegacyLoreDryRunTargetReceipt = {
  readonly sourceDocumentId: string;
  readonly workId: string;
  readonly documentId: string;
  readonly revisionId: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly lengthUtf16: number;
};

export type LegacyLoreDryRunCheckpointTargetReceipt = {
  readonly sourceWorkId: string;
  readonly workId: string;
  readonly documentId: string;
  readonly checkpointId: string;
  readonly cursorAnchorId: string;
  readonly cursorOffset: number;
  readonly capturedAt: string;
};

export type LegacyLoreDryRunSessionTargetReceipt = {
  readonly sourceSessionId: string;
  readonly workId: string;
  readonly documentId: string;
  readonly sessionId: string;
  readonly startedAt: string;
  readonly endedAt: string;
};

export type LegacyLoreDryRunRawItemTargetReceipt = {
  readonly rawItemId: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly sourceOccurrence: number;
  readonly ownershipRef: string | null;
  readonly serializationIdentity: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
};

export type LegacyLoreDryRunReport = {
  readonly schemaVersion: 1;
  readonly mapperVersion: string;
  readonly batchId: string;
  readonly sourceSnapshotId: string;
  readonly sourceSnapshotChecksumValue: string;
  readonly createdAt: string;
  readonly sourceInspection: MigrationSourceInspection | null;
  readonly browserSourceReceipt: LegacyBrowserSourceExportReceipt | null;
  readonly sourceInventory: LegacyLoreInventoryReport;
  readonly dispositionCounts: Readonly<Record<MigrationDisposition, number>>;
  readonly issueCounts: readonly {
    readonly issueKind: string;
    readonly count: number;
  }[];
  readonly manuscriptProofs: readonly LegacyLoreDryRunManuscriptProof[];
  readonly sharedLoreFinalization: LegacyLoreSharedLoreFinalization;
  readonly counts: {
    readonly workCount: number;
    readonly folderCount: number;
    readonly documentCount: number;
    readonly revisionCount: number;
    readonly resumeCheckpointCount: number;
    readonly writingSessionCount: number;
    readonly rawItemCount: number;
    readonly receiptCount: number;
    readonly sourceItemCount: number;
    readonly uncoveredItemCount: number;
    readonly orphanManuscriptCount: number;
  };
  readonly manuscripts: readonly LegacyLoreDryRunTargetReceipt[];
  readonly resumeCheckpoints:
    readonly LegacyLoreDryRunCheckpointTargetReceipt[];
  readonly writingSessions:
    readonly LegacyLoreDryRunSessionTargetReceipt[];
  readonly rawItems: readonly LegacyLoreDryRunRawItemTargetReceipt[];
  readonly receipts: readonly MigrationItemReceipt[];
};

export type WriteLegacyLoreDryRunInput = {
  readonly targetRootDirectoryPath: string;
  readonly studioDisplayName: string;
  readonly locale: string;
  readonly timezone: string;
  readonly reportFileName: string;
  readonly anchorPolicy: AnchorPolicy;
  readonly anchorEvidenceChecksumAlgorithm: string;
  readonly plan: LegacyLoreDryRunPlan;
  readonly sourceInspection?: MigrationSourceInspection;
  readonly browserSourceReceipt?: LegacyBrowserSourceExportReceipt;
};

export type WriteLegacyLoreDryRunResult = {
  readonly targetRootDirectoryPath: string;
  readonly report: LegacyLoreDryRunReport;
  readonly publication: "published" | "reused";
};

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ErrorWithCode).code === code
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return false;
    }
    if (hasErrorCode(error, "EISDIR")) {
      return true;
    }
    throw error;
  }
}

async function writeExactNoReplace(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const handle = await open(path, "wx");
  try {
    let offset = 0;
    while (offset < bytes.byteLength) {
      const result = await handle.write(
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      );
      if (result.bytesWritten <= 0) {
        throw new Error("Migration report write made no progress");
      }
      offset += result.bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function recordMeta(createdAt: string, updatedAt = createdAt) {
  return Object.freeze({
    schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
    revision: 1,
    createdAt,
    updatedAt,
  });
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  );
}

function createWorkRecords(
  input: WriteLegacyLoreDryRunInput,
): readonly Poc3LedgerRecord[] {
  const records: Poc3LedgerRecord[] = [
    {
      kind: "studio",
      id: input.plan.studioId,
      displayName: input.studioDisplayName,
      locale: input.locale,
      timezone: input.timezone,
      settingsRevision: 1,
      createdAt: input.plan.createdAt,
    },
  ];
  for (const work of input.plan.works) {
    records.push(
      {
        kind: "work",
        ...recordMeta(work.createdAt, work.updatedAt),
        id: work.workId,
        studioId: input.plan.studioId,
        title: work.title,
        ...(work.description === null ? {} : { subtitle: work.description }),
        orderKey: work.orderKey,
        settingsId: work.settingsId,
        customFieldsJson: JSON.stringify({
          migration: {
            batchId: input.plan.batchId,
            sourceSnapshotId: input.plan.sourceSnapshotId,
            sourceWorkId: work.sourceWorkId,
          },
        }),
      },
      {
        kind: "activityPolicy",
        ...recordMeta(input.plan.createdAt),
        id: work.activityPolicyId,
        workId: work.workId,
        idleTimeout: 0,
        navigationGrace: 0,
        hiddenWindowPolicy: "disabled",
        activityClassRulesJson: "[]",
        autoStartEnabled: false,
        autoResumeFromIdle: false,
        recoveryPolicy: "manual",
      },
      {
        kind: "focusPolicy",
        ...recordMeta(input.plan.createdAt),
        id: work.focusPolicyId,
        workId: work.workId,
        phaseDefinitionsJson: "[]",
        backgroundPolicy: "disabled",
        musicStartPolicy: "manual",
        completionPolicy: "manual",
        visibility: "hidden",
      },
      {
        kind: "workSettings",
        id: work.settingsId,
        workId: work.workId,
        sceneRuleSetId: work.sceneRuleSetId,
        activityPolicyId: work.activityPolicyId,
        focusPolicyId: work.focusPolicyId,
        railPreferencesJson: "{}",
        revision: 1,
      },
    );
  }
  for (const folder of input.plan.folders) {
    records.push({
      kind: "documentFolder",
      ...recordMeta(folder.createdAt, folder.updatedAt),
      id: folder.folderId,
      workId: folder.workId,
      ...(folder.parentFolderId === null
        ? {}
        : { parentFolderId: folder.parentFolderId }),
      title: folder.title,
      orderKey: folder.orderKey,
    });
  }
  return Object.freeze(records);
}

function createCatalogForPlan(plan: LegacyLoreDryRunPlan) {
  return createWritingCatalog({
    works: plan.works.map((work) => ({
      meta: {
        id: entityId<"Work">(work.workId),
        ...recordMeta(work.createdAt, work.updatedAt),
      },
      studioId: entityId<"Studio">(plan.studioId),
      title: work.title,
      ...(work.description === null ? {} : { subtitle: work.description }),
      orderKey: work.orderKey,
      settingsId: entityId<"WorkSettings">(work.settingsId),
    })),
    documents: plan.documents.map((document) => ({
      meta: {
        id: entityId<"Document">(document.documentId),
        ...recordMeta(document.createdAt, document.updatedAt),
      },
      workId: entityId<"Work">(document.workId),
      ...(document.folderId === null
        ? {}
        : { folderId: entityId<"DocumentFolder">(document.folderId) }),
      title: document.title,
      orderKey: document.orderKey,
      manuscriptId: entityId<"Manuscript">(document.manuscriptId),
    })),
  });
}

function manuscriptReceiptsForPlan(
  plan: LegacyLoreDryRunPlan,
): readonly LegacyLoreDryRunTargetReceipt[] {
  return Object.freeze(
    plan.documents.map((document) => Object.freeze({
      sourceDocumentId: document.sourceDocumentId,
      workId: document.workId,
      documentId: document.documentId,
      revisionId: document.revisionId,
      checksumIdentity: document.manuscriptChecksumIdentity,
      checksumValue: document.manuscriptChecksumValue,
      byteLength: document.manuscriptByteLength,
      lengthUtf16: document.manuscriptLengthUtf16,
    })),
  );
}

function checkpointReceiptsForPlan(
  plan: LegacyLoreDryRunPlan,
): readonly LegacyLoreDryRunCheckpointTargetReceipt[] {
  return Object.freeze(
    plan.resumeCheckpoints.map((checkpoint) => Object.freeze({
      sourceWorkId: checkpoint.sourceWorkId,
      workId: checkpoint.workId,
      documentId: checkpoint.documentId,
      checkpointId: checkpoint.checkpointId,
      cursorAnchorId: checkpoint.cursorAnchorId,
      cursorOffset: checkpoint.cursorOffset,
      capturedAt: checkpoint.capturedAt,
    })),
  );
}

function createDryRunReport(
  input: WriteLegacyLoreDryRunInput,
  manuscriptReceipts: readonly LegacyLoreDryRunTargetReceipt[],
  checkpointReceipts: readonly LegacyLoreDryRunCheckpointTargetReceipt[],
): LegacyLoreDryRunReport {
  const dispositionCounts: Record<MigrationDisposition, number> = {
    exact: 0,
    adapted: 0,
    review: 0,
    "raw-only": 0,
    "derived-skip": 0,
  };
  const issueCounts = new Map<string, number>();
  for (const receipt of input.plan.receipts) {
    dispositionCounts[receipt.disposition] += 1;
    for (const issueKind of receipt.issueKinds) {
      issueCounts.set(issueKind, (issueCounts.get(issueKind) ?? 0) + 1);
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    mapperVersion: input.plan.mapperVersion,
    batchId: input.plan.batchId,
    sourceSnapshotId: input.plan.sourceSnapshotId,
    sourceSnapshotChecksumValue: input.plan.sourceSnapshotChecksumValue,
    createdAt: input.plan.createdAt,
    sourceInspection: input.sourceInspection ?? null,
    browserSourceReceipt: input.browserSourceReceipt ?? null,
    sourceInventory: input.plan.inventory,
    dispositionCounts: Object.freeze({ ...dispositionCounts }),
    issueCounts: Object.freeze(
      [...issueCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([issueKind, count]) => Object.freeze({ issueKind, count })),
    ),
    manuscriptProofs: input.plan.manuscriptProofs,
    sharedLoreFinalization: input.plan.sharedLoreFinalization,
    counts: Object.freeze({
      workCount: input.plan.works.length,
      folderCount: input.plan.folders.length,
      documentCount: input.plan.documents.length,
      revisionCount: input.plan.documents.length,
      resumeCheckpointCount: input.plan.resumeCheckpoints.length,
      writingSessionCount: input.plan.writingSessions.length,
      rawItemCount: input.plan.rawItems.length,
      receiptCount: input.plan.receipts.length +
        (input.browserSourceReceipt?.entryReceipts.length ?? 0),
      sourceItemCount: input.plan.receiptCoverage.sourceItemCount +
        (input.browserSourceReceipt?.coverage.sourceEntryCount ?? 0),
      uncoveredItemCount: input.plan.receiptCoverage.uncoveredItemCount +
        (input.browserSourceReceipt?.coverage.uncoveredEntryCount ?? 0),
      orphanManuscriptCount:
        input.plan.inventory.counts.orphanManuscriptCount,
    }),
    manuscripts: Object.freeze([...manuscriptReceipts]),
    resumeCheckpoints: Object.freeze([...checkpointReceipts]),
    writingSessions: Object.freeze(
      input.plan.writingSessions.map((session) => Object.freeze({
        sourceSessionId: session.sourceSessionId,
        workId: session.workId,
        documentId: session.documentId,
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      })),
    ),
    rawItems: Object.freeze(
      input.plan.rawItems.map((item) => Object.freeze({
        rawItemId: item.rawItemId,
        sourceCollection: item.sourceCollection,
        sourceIdentity: item.sourceIdentity,
        sourceOccurrence: item.sourceOccurrence,
        ownershipRef: item.ownershipRef,
        serializationIdentity: item.serializationIdentity,
        checksumIdentity: item.checksumIdentity,
        checksumValue: item.checksumValue,
        byteLength: item.byteLength,
      })),
    ),
    receipts: input.plan.receipts,
  });
}

async function verifyDryRunStorage(
  input: WriteLegacyLoreDryRunInput,
  targetRoot: string,
): Promise<void> {
  const profiles = createLocalWorkspaceStorageProfiles(targetRoot);
  const ledger = await openNodeSqliteLedger(profiles.ledgerProfile);
  try {
    const blobStore = await createNodeImmutableBlobStore(
      profiles.blobStoreProfile,
    );
    const revisionStore = ledger.createRevisionStore({
      blobStore,
      blobProfile: createLocalWorkspaceRevisionBlobProfile(),
    });
    for (const document of input.plan.documents) {
      const materialized = await revisionStore.materialize(
        entityId<"DocumentRevision">(document.revisionId),
      );
      if (materialized !== document.manuscript) {
        throw new Error("Existing dry-run manuscript differs from source plan");
      }
    }
    for (const item of input.plan.rawItems) {
      const stored = await ledger.getRawPreservedItemById(item.rawItemId);
      if (
        stored === null ||
        stored.batchId !== input.plan.batchId ||
        stored.sourceSnapshotId !== input.plan.sourceSnapshotId ||
        stored.sourceCollection !== item.sourceCollection ||
        stored.sourceIdentity !== item.sourceIdentity ||
        stored.sourceOccurrence !== item.sourceOccurrence ||
        stored.serializationIdentity !== item.serializationIdentity ||
        stored.checksumIdentity !== item.checksumIdentity ||
        stored.checksumValue !== item.checksumValue ||
        stored.byteLength !== item.byteLength ||
        stored.mapperVersion !== input.plan.mapperVersion ||
        !sameBytes(stored.rawBytes, item.bytes)
      ) {
        throw new Error("Existing RawPreservedItem differs from source plan");
      }
    }
    const checkpointReader = ledger.createResumeCheckpointCaptureTransaction({});
    for (const planned of input.plan.resumeCheckpoints) {
      const work = await checkpointReader.getWork(
        entityId<"Work">(planned.workId),
      );
      const checkpoint = await checkpointReader.getCheckpointById(
        entityId<"ResumeCheckpoint">(planned.checkpointId),
      );
      const anchor = await checkpointReader.getAnchorById(
        entityId<"Anchor">(planned.cursorAnchorId),
      );
      if (
        work?.resumeCheckpointId !== planned.checkpointId ||
        checkpoint?.documentId !== planned.documentId ||
        checkpoint.documentRevisionId !== planned.documentRevisionId ||
        checkpoint.cursorAnchorId !== planned.cursorAnchorId ||
        anchor?.documentId !== planned.documentId ||
        anchor.originRevisionId !== planned.documentRevisionId ||
        anchor.resolvedRevisionId !== planned.documentRevisionId ||
        anchor.startOffset !== planned.cursorOffset ||
        anchor.endOffset !== planned.cursorOffset
      ) {
        throw new Error("Existing dry-run checkpoint differs from source plan");
      }
    }
  } finally {
    ledger.close();
  }
}

async function verifyExistingDryRun(
  input: WriteLegacyLoreDryRunInput,
  targetRoot: string,
): Promise<WriteLegacyLoreDryRunResult> {
  const reportPath = resolve(targetRoot, input.reportFileName);
  const parsed: unknown = JSON.parse(await readFile(reportPath, "utf8"));
  const expected = createDryRunReport(
    input,
    manuscriptReceiptsForPlan(input.plan),
    checkpointReceiptsForPlan(input.plan),
  );
  if (JSON.stringify(parsed) !== JSON.stringify(expected)) {
    throw new Error("Existing dry-run target belongs to a different import plan");
  }
  await verifyDryRunStorage(input, targetRoot);
  return Object.freeze({
    targetRootDirectoryPath: targetRoot,
    report: expected,
    publication: "reused",
  });
}

export async function regenerateLegacyLoreDryRunReport(
  input: WriteLegacyLoreDryRunInput,
): Promise<LegacyLoreDryRunReport> {
  if (
    input.reportFileName.length === 0 ||
    dirname(input.reportFileName) !== "."
  ) {
    throw new Error("Dry-run report file name is invalid");
  }
  const targetRoot = resolve(input.targetRootDirectoryPath);
  if (!await pathExists(targetRoot)) {
    throw new Error("Restored dry-run target does not exist");
  }
  const reportPath = resolve(targetRoot, input.reportFileName);
  if (await pathExists(reportPath)) {
    throw new Error("Dry-run report already exists");
  }
  await verifyDryRunStorage(input, targetRoot);
  const report = createDryRunReport(
    input,
    manuscriptReceiptsForPlan(input.plan),
    checkpointReceiptsForPlan(input.plan),
  );
  await writeExactNoReplace(
    reportPath,
    new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`),
  );
  return report;
}

export async function writeLegacyLoreDryRun(
  input: WriteLegacyLoreDryRunInput,
): Promise<WriteLegacyLoreDryRunResult> {
  if (!isAbsolute(input.targetRootDirectoryPath)) {
    throw new Error("Dry-run target root must be absolute");
  }
  if (
    input.studioDisplayName.length === 0 ||
    input.locale.length === 0 ||
    input.timezone.length === 0 ||
    input.reportFileName.length === 0 ||
    dirname(input.reportFileName) !== "."
  ) {
    throw new Error("Dry-run target profile is invalid");
  }
  const targetRoot = resolve(input.targetRootDirectoryPath);
  if (targetRoot === resolve(dirname(targetRoot))) {
    throw new Error("Dry-run target root must not be a filesystem root");
  }
  if (await pathExists(targetRoot)) {
    return verifyExistingDryRun(input, targetRoot);
  }
  await mkdir(targetRoot, { recursive: false });

  const profiles = createLocalWorkspaceStorageProfiles(targetRoot);
  let ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>> | null = null;
  let complete = false;
  try {
    ledger = await openNodeSqliteLedger(profiles.ledgerProfile);
    const blobStore = await createNodeImmutableBlobStore(
      profiles.blobStoreProfile,
    );
    const blobProfile = createLocalWorkspaceRevisionBlobProfile();
    const records = [...createWorkRecords(input)];
    const manuscriptReceipts: LegacyLoreDryRunTargetReceipt[] = [];
    const recordedBlobRefs = new Set<string>();

    for (const document of input.plan.documents) {
      const revisionInput = Object.freeze({
        revisionId: entityId<"DocumentRevision">(document.revisionId),
        workId: entityId<"Work">(document.workId),
        documentId: entityId<"Document">(document.documentId),
        expectedCurrentRevisionId: null,
        content: document.manuscript,
        cause: JSON.stringify({
          kind: "legacy-import",
          batchId: input.plan.batchId,
          sourceSnapshotId: input.plan.sourceSnapshotId,
          sourceDocumentId: document.sourceDocumentId,
        }),
        createdAt: input.plan.createdAt,
        durableAt: input.plan.createdAt,
      });
      const published = await blobStore.append({
        bytes: blobProfile.codec.encode(document.manuscript),
        metadata: blobProfile.metadataForAppend(revisionInput),
        temporaryEntryIdentity:
          blobProfile.temporaryEntryIdentityForAppend(revisionInput),
      });
      if (
        published.address.checksumIdentity !==
          document.manuscriptChecksumIdentity ||
        published.address.checksumValue !==
          document.manuscriptChecksumValue ||
        published.byteLength !== document.manuscriptByteLength
      ) {
        throw new Error("Published manuscript checksum differs from source receipt");
      }
      const blobRef = blobProfile.blobRefForAddress(published.address);
      records.push({
        kind: "document",
        ...recordMeta(document.createdAt, document.updatedAt),
        id: document.documentId,
        workId: document.workId,
        ...(document.folderId === null ? {} : { folderId: document.folderId }),
        title: document.title,
        orderKey: document.orderKey,
        manuscriptId: document.manuscriptId,
      });
      if (!recordedBlobRefs.has(blobRef)) {
        records.push({
          kind: "blobManifest",
          blobRef,
          checksumIdentity: published.address.checksumIdentity,
          checksumValue: published.address.checksumValue,
          byteLength: published.byteLength,
          createdAt: input.plan.createdAt,
          mediaType: "text/plain; charset=utf-16le",
        });
        recordedBlobRefs.add(blobRef);
      }
      records.push(
        {
          kind: "documentRevision",
          id: document.revisionId,
          workId: document.workId,
          documentId: document.documentId,
          contentRef: blobRef,
          contentHash: document.manuscriptChecksumValue,
          length: document.manuscriptLengthUtf16,
          cause: revisionInput.cause,
          createdAt: input.plan.createdAt,
          durableAt: input.plan.createdAt,
        },
        {
          kind: "manuscript",
          id: document.manuscriptId,
          workId: document.workId,
          documentId: document.documentId,
          currentRevisionId: document.revisionId,
          durableRevisionId: document.revisionId,
          updatedAt: document.updatedAt,
        },
      );
      manuscriptReceipts.push(Object.freeze({
        sourceDocumentId: document.sourceDocumentId,
        workId: document.workId,
        documentId: document.documentId,
        revisionId: document.revisionId,
        checksumIdentity: published.address.checksumIdentity,
        checksumValue: published.address.checksumValue,
        byteLength: published.byteLength,
        lengthUtf16: document.manuscriptLengthUtf16,
      }));
    }

    for (const item of input.plan.rawItems) {
      records.push({
        kind: "rawPreservedItem",
        id: item.rawItemId,
        batchId: input.plan.batchId,
        sourceSnapshotId: input.plan.sourceSnapshotId,
        sourceCollection: item.sourceCollection,
        sourceIdentity: item.sourceIdentity,
        sourceOccurrence: item.sourceOccurrence,
        serializationIdentity: item.serializationIdentity,
        rawBytes: item.bytes,
        checksumIdentity: item.checksumIdentity,
        checksumValue: item.checksumValue,
        byteLength: item.byteLength,
        mapperVersion: input.plan.mapperVersion,
        createdAt: input.plan.createdAt,
      });
    }

    for (const session of input.plan.writingSessions) {
      records.push({
        kind: "writingSession",
        ...recordMeta(session.createdAt, session.endedAt),
        id: session.sessionId,
        workId: session.workId,
        documentId: session.documentId,
        policyId: session.activityPolicyId,
        state: session.state,
        modeRef: session.modeRef,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        lastDurableHeartbeatAt: session.lastDurableHeartbeatAt,
        recoveryEvidenceJson: session.recoveryEvidenceJson,
      });
    }

    await ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of records) {
        transaction.write(record);
      }
    });

    const revisionStore = ledger.createRevisionStore({
      blobStore,
      blobProfile,
    });
    for (const document of input.plan.documents) {
      const materialized = await revisionStore.materialize(
        entityId<"DocumentRevision">(document.revisionId),
      );
      if (materialized !== document.manuscript) {
        throw new Error("Dry-run materialized manuscript differs from source");
      }
    }
    for (const item of input.plan.rawItems) {
      const stored = await ledger.getRawPreservedItemById(item.rawItemId);
      if (stored === null || !sameBytes(stored.rawBytes, item.bytes)) {
        throw new Error("Dry-run RawPreservedItem differs from source");
      }
    }

    const checkpointReceipts: LegacyLoreDryRunCheckpointTargetReceipt[] = [];
    if (input.plan.resumeCheckpoints.length > 0) {
      const catalog = createCatalogForPlan(input.plan);
      const createAnchor = new CreateAnchor({
        catalog,
        revisionStore,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          input.anchorEvidenceChecksumAlgorithm,
        ),
      });
      const captureCheckpoint = new CaptureResumeCheckpointWithAnchors({
        catalog,
        revisionStore,
        transaction: ledger.createResumeCheckpointCaptureTransaction({}),
      });
      for (const checkpoint of input.plan.resumeCheckpoints) {
        const cursorAnchor = await createAnchor.execute({
          meta: {
            id: entityId<"Anchor">(checkpoint.cursorAnchorId),
            ...recordMeta(checkpoint.capturedAt),
          },
          workId: entityId<"Work">(checkpoint.workId),
          documentId: entityId<"Document">(checkpoint.documentId),
          documentRevisionId: entityId<"DocumentRevision">(
            checkpoint.documentRevisionId,
          ),
          startOffset: checkpoint.cursorOffset,
          endOffset: checkpoint.cursorOffset,
          policy: input.anchorPolicy,
          commandRef: input.plan.batchId,
          actorRef: input.plan.sourceSnapshotId,
        });
        const captured = await captureCheckpoint.execute({
          checkpoint: {
            meta: {
              id: entityId<"ResumeCheckpoint">(checkpoint.checkpointId),
              ...recordMeta(checkpoint.capturedAt),
            },
            workId: entityId<"Work">(checkpoint.workId),
            documentId: entityId<"Document">(checkpoint.documentId),
            documentRevisionId: entityId<"DocumentRevision">(
              checkpoint.documentRevisionId,
            ),
            cursorAnchorId: cursorAnchor.meta.id,
            workspaceMode: checkpoint.workspaceMode,
            capturedAt: checkpoint.capturedAt,
          },
          cursorAnchor,
          expectedWorkRevision: 1,
          expectedResumeCheckpointId: null,
          expectedDocumentRevisionId: entityId<"DocumentRevision">(
            checkpoint.documentRevisionId,
          ),
        });
        if (
          captured.checkpoint.meta.id !== checkpoint.checkpointId ||
          captured.work.resumeCheckpointId !== checkpoint.checkpointId
        ) {
          throw new Error("Dry-run checkpoint pointer differs from source plan");
        }
        checkpointReceipts.push(Object.freeze({
          sourceWorkId: checkpoint.sourceWorkId,
          workId: checkpoint.workId,
          documentId: checkpoint.documentId,
          checkpointId: checkpoint.checkpointId,
          cursorAnchorId: checkpoint.cursorAnchorId,
          cursorOffset: checkpoint.cursorOffset,
          capturedAt: checkpoint.capturedAt,
        }));
      }
    }

    const report = createDryRunReport(
      input,
      manuscriptReceipts,
      checkpointReceipts,
    );
    await writeExactNoReplace(
      resolve(targetRoot, input.reportFileName),
      new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`),
    );
    complete = true;
    return Object.freeze({
      targetRootDirectoryPath: targetRoot,
      report,
      publication: "published",
    });
  } finally {
    ledger?.close();
    if (!complete) {
      await rm(targetRoot, { recursive: true, force: true });
    }
  }
}
