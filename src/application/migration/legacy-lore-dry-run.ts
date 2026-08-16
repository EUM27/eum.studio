import {
  inventoryLegacyLorePayload,
  type LegacyLoreInventoryReport,
} from "./legacy-lore-inventory";

export type MigrationDisposition =
  | "exact"
  | "adapted"
  | "review"
  | "raw-only"
  | "derived-skip";

export type MigrationFieldReceipt = {
  readonly sourceField: string;
  readonly targetField: string | null;
  readonly disposition: MigrationDisposition;
};

export type MigrationItemReceipt = {
  readonly batchId: string;
  readonly sourceSnapshotId: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly rawItemId: string;
  readonly targetEntityKind: string | null;
  readonly targetEntityId: string | null;
  readonly disposition: MigrationDisposition;
  readonly fieldReceipts: readonly MigrationFieldReceipt[];
  readonly issueKinds: readonly string[];
};

type UnlinkedMigrationItemReceipt = Omit<
  MigrationItemReceipt,
  "rawItemId"
>;

export type LegacyLoreDryRunWork = {
  readonly sourceWorkId: string;
  readonly workId: string;
  readonly settingsId: string;
  readonly activityPolicyId: string;
  readonly focusPolicyId: string;
  readonly sceneRuleSetId: string;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly orderKey: string;
};

export type LegacyLoreDryRunFolder = {
  readonly sourceFolderId: string;
  readonly folderId: string;
  readonly workId: string;
  readonly parentFolderId: string | null;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly orderKey: string;
};

export type LegacyLoreDryRunDocument = {
  readonly sourceDocumentId: string;
  readonly documentId: string;
  readonly workId: string;
  readonly folderId: string | null;
  readonly manuscriptId: string;
  readonly revisionId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly orderKey: string;
  readonly manuscript: string;
  readonly manuscriptChecksumIdentity: string;
  readonly manuscriptChecksumValue: string;
  readonly manuscriptByteLength: number;
  readonly manuscriptLengthUtf16: number;
};

export type LegacyLoreDryRunResumeCheckpoint = {
  readonly sourceWorkId: string;
  readonly sourceDocumentId: string;
  readonly workId: string;
  readonly documentId: string;
  readonly documentRevisionId: string;
  readonly checkpointId: string;
  readonly cursorAnchorId: string;
  readonly cursorOffset: number;
  readonly capturedAt: string;
  readonly workspaceMode: string;
};

export type LegacyLoreDryRunWritingSession = {
  readonly sourceSessionId: string;
  readonly sessionId: string;
  readonly workId: string;
  readonly documentId: string;
  readonly activityPolicyId: string;
  readonly state: string;
  readonly modeRef: string;
  readonly createdAt: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly lastDurableHeartbeatAt: string;
  readonly recoveryEvidenceJson: string;
};

export type LegacyLoreReceiptCoverage = {
  readonly sourceItemCount: number;
  readonly receiptCount: number;
  readonly uncoveredItemCount: number;
};

export type LegacyLoreRawItemDescriptor = {
  readonly serializationIdentity: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly bytes: Uint8Array;
};

export type LegacyLoreDryRunRawItem = {
  readonly rawItemId: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly sourceOccurrence: number;
  readonly ownershipRef: string | null;
  readonly serializationIdentity: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly bytes: Uint8Array;
};

export type LegacyLoreDryRunManuscriptProof = {
  readonly sourceDocumentId: string;
  readonly sourceOwnershipRef: string | null;
  readonly sourceChecksumIdentity: string;
  readonly sourceChecksumValue: string;
  readonly sourceByteLength: number;
  readonly sourceLengthUtf16: number;
  readonly rawItemId: string;
  readonly rawChecksumIdentity: string;
  readonly rawChecksumValue: string;
  readonly preservation:
    | "target-revision-checksum-match"
    | "quarantine-raw-exact";
  readonly targetDocumentId: string | null;
  readonly targetRevisionId: string | null;
  readonly targetChecksumIdentity: string | null;
  readonly targetChecksumValue: string | null;
};

export type LegacyLoreSharedLoreFinalization = {
  readonly status: "blocked-by-schema-decision";
  readonly globalBookCount: number;
  readonly globalEntryCount: number;
};

export type LegacyLoreDryRunPlan = {
  readonly mapperVersion: string;
  readonly batchId: string;
  readonly sourceSnapshotId: string;
  readonly sourceSnapshotChecksumValue: string;
  readonly createdAt: string;
  readonly studioId: string;
  readonly works: readonly LegacyLoreDryRunWork[];
  readonly folders: readonly LegacyLoreDryRunFolder[];
  readonly documents: readonly LegacyLoreDryRunDocument[];
  readonly resumeCheckpoints: readonly LegacyLoreDryRunResumeCheckpoint[];
  readonly writingSessions: readonly LegacyLoreDryRunWritingSession[];
  readonly rawItems: readonly LegacyLoreDryRunRawItem[];
  readonly manuscriptProofs: readonly LegacyLoreDryRunManuscriptProof[];
  readonly sharedLoreFinalization: LegacyLoreSharedLoreFinalization;
  readonly receipts: readonly MigrationItemReceipt[];
  readonly receiptCoverage: LegacyLoreReceiptCoverage;
  readonly inventory: LegacyLoreInventoryReport;
};

export type LegacyLoreTargetIdentityInput = {
  readonly mapperVersion: string;
  readonly sourceSnapshotChecksumValue: string;
  readonly targetEntityKind: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
};

export type LegacyLoreManuscriptDescriptor = {
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly lengthUtf16: number;
};

export type CreateLegacyLoreDryRunPlanInput = {
  readonly mapperVersion: string;
  readonly sourceSnapshotId: string;
  readonly sourceSnapshotChecksumValue: string;
  readonly createdAt: string;
  readonly resumeWorkspaceMode: string;
  readonly completedWritingSessionState: string;
  readonly secretLikeFieldFragments: readonly string[];
  readonly secretRedactionValue: string;
  readonly payload: unknown;
  deriveTargetId(input: LegacyLoreTargetIdentityInput): string;
  describeManuscript(text: string): LegacyLoreManuscriptDescriptor;
  describeRawItem(input: {
    readonly sourceCollection: string;
    readonly sourceIdentity: string;
    readonly value: unknown;
  }): LegacyLoreRawItemDescriptor;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNonEmptyString(
  value: unknown,
): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readInstant(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readNonNegativeSafeInteger(
  value: unknown,
): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function readSafeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : null;
}

function rawFieldReceipts(value: unknown): readonly MigrationFieldReceipt[] {
  if (isRecord(value)) {
    return fieldReceipts(value, {});
  }
  return Object.freeze([
    Object.freeze({
      sourceField: "$value",
      targetField: null,
      disposition: "raw-only" as const,
    }),
  ]);
}

function redactSecretLikeFields(
  value: unknown,
  fragments: readonly string[],
  redactionValue: string,
): { readonly value: unknown; readonly redactedFieldCount: number } {
  if (Array.isArray(value)) {
    const entries = value.map((entry) =>
      redactSecretLikeFields(entry, fragments, redactionValue),
    );
    return {
      value: entries.map((entry) => entry.value),
      redactedFieldCount: entries.reduce(
        (count, entry) => count + entry.redactedFieldCount,
        0,
      ),
    };
  }
  if (!isRecord(value)) {
    return { value, redactedFieldCount: 0 };
  }
  let redactedFieldCount = 0;
  const redacted: Record<string, unknown> = {};
  for (const [field, entry] of Object.entries(value)) {
    const normalizedField = field.toLocaleLowerCase("en-US");
    if (fragments.some((fragment) => normalizedField.includes(fragment))) {
      redacted[field] = redactionValue;
      redactedFieldCount += 1;
      continue;
    }
    const nested = redactSecretLikeFields(entry, fragments, redactionValue);
    redacted[field] = nested.value;
    redactedFieldCount += nested.redactedFieldCount;
  }
  return { value: redacted, redactedFieldCount };
}

function fieldReceipts(
  value: Record<string, unknown>,
  mappings: Readonly<Record<string, {
    readonly targetField: string | null;
    readonly disposition: MigrationDisposition;
  }>>,
): readonly MigrationFieldReceipt[] {
  return Object.freeze(
    Object.keys(value).sort().map((sourceField) => {
      const mapping = mappings[sourceField];
      return Object.freeze({
        sourceField,
        targetField: mapping?.targetField ?? null,
        disposition: mapping?.disposition ?? "raw-only",
      });
    }),
  );
}

function derive(
  input: CreateLegacyLoreDryRunPlanInput,
  targetEntityKind: string,
  sourceCollection: string,
  sourceIdentity: string,
): string {
  const targetId = input.deriveTargetId({
    mapperVersion: input.mapperVersion,
    sourceSnapshotChecksumValue: input.sourceSnapshotChecksumValue,
    targetEntityKind,
    sourceCollection,
    sourceIdentity,
  });
  if (targetId.length === 0) {
    throw new Error("Derived migration target ID must not be empty");
  }
  return targetId;
}

function createReceipt(input: {
  readonly batchId: string;
  readonly sourceSnapshotId: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly targetEntityKind: string | null;
  readonly targetEntityId: string | null;
  readonly disposition: MigrationDisposition;
  readonly fieldReceipts: readonly MigrationFieldReceipt[];
  readonly issueKinds?: readonly string[];
}): UnlinkedMigrationItemReceipt {
  return Object.freeze({
    batchId: input.batchId,
    sourceSnapshotId: input.sourceSnapshotId,
    sourceCollection: input.sourceCollection,
    sourceIdentity: input.sourceIdentity,
    targetEntityKind: input.targetEntityKind,
    targetEntityId: input.targetEntityId,
    disposition: input.disposition,
    fieldReceipts: input.fieldReceipts,
    issueKinds: Object.freeze([...(input.issueKinds ?? [])].sort()),
  });
}

export function createLegacyLoreDryRunPlan(
  input: CreateLegacyLoreDryRunPlanInput,
): LegacyLoreDryRunPlan {
  if (
    input.mapperVersion.length === 0 ||
    input.sourceSnapshotId.length === 0 ||
    input.sourceSnapshotChecksumValue.length === 0 ||
    input.createdAt.length === 0 ||
    input.resumeWorkspaceMode.length === 0 ||
    input.completedWritingSessionState.length === 0
  ) {
    throw new Error("Legacy dry-run identity fields must not be empty");
  }
  const secretFragments = Object.freeze(
    [...new Set(
      input.secretLikeFieldFragments
        .map((fragment) => fragment.trim().toLocaleLowerCase("en-US"))
        .filter((fragment) => fragment.length > 0),
    )].sort(),
  );
  const rootIsRecord = isRecord(input.payload);
  const root = rootIsRecord ? input.payload : {};
  const library = isRecord(root.library) ? root.library : {};
  const manuscripts = isRecord(root.manuscripts) ? root.manuscripts : {};
  const inventory = inventoryLegacyLorePayload(input.payload);
  const batchId = derive(
    input,
    "ImportBatch",
    "$",
    input.sourceSnapshotId,
  );
  const studioId = derive(
    input,
    "Studio",
    "$",
    "legacy-studio",
  );
  const receipts: UnlinkedMigrationItemReceipt[] = [];
  const works: LegacyLoreDryRunWork[] = [];
  const workIds = new Map<string, LegacyLoreDryRunWork>();
  const seenSourceWorkIds = new Set<string>();

  asArray(library.works).forEach((rawWork, index) => {
    if (!isRecord(rawWork)) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "library.works",
        sourceIdentity: `index:${index}`,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "raw-only",
        fieldReceipts: Object.freeze([]),
        issueKinds: ["invalid-source-item"],
      }));
      return;
    }
    const sourceWorkId = readNonEmptyString(rawWork.id);
    const title = readNonEmptyString(rawWork.title);
    const createdAt = readInstant(rawWork.createdAt);
    const updatedAt = readInstant(rawWork.updatedAt);
    const sourceIdentity = sourceWorkId ?? `index:${index}`;
    if (
      sourceWorkId === null ||
      title === null ||
      createdAt === null ||
      updatedAt === null ||
      seenSourceWorkIds.has(sourceWorkId)
    ) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "library.works",
        sourceIdentity,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "review",
        fieldReceipts: fieldReceipts(rawWork, {}),
        issueKinds: ["invalid-or-duplicate-work"],
      }));
      return;
    }
    seenSourceWorkIds.add(sourceWorkId);
    const workId = derive(
      input,
      "Work",
      "library.works",
      sourceWorkId,
    );
    const mapped: LegacyLoreDryRunWork = Object.freeze({
      sourceWorkId,
      workId,
      settingsId: derive(input, "WorkSettings", "library.works", sourceWorkId),
      activityPolicyId: derive(
        input,
        "ActivityPolicy",
        "library.works",
        sourceWorkId,
      ),
      focusPolicyId: derive(
        input,
        "FocusPolicy",
        "library.works",
        sourceWorkId,
      ),
      sceneRuleSetId: derive(
        input,
        "SceneRuleSet",
        "library.works",
        sourceWorkId,
      ),
      title,
      description: typeof rawWork.description === "string"
        ? rawWork.description
        : null,
      createdAt,
      updatedAt,
      orderKey: JSON.stringify([index, workId]),
    });
    works.push(mapped);
    workIds.set(sourceWorkId, mapped);
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "library.works",
      sourceIdentity: sourceWorkId,
      targetEntityKind: "Work",
      targetEntityId: workId,
      disposition: "adapted",
      fieldReceipts: fieldReceipts(rawWork, {
        id: { targetField: "id", disposition: "adapted" },
        title: { targetField: "title", disposition: "exact" },
        description: { targetField: "subtitle", disposition: "adapted" },
        episodeIds: { targetField: null, disposition: "derived-skip" },
        createdAt: { targetField: "createdAt", disposition: "adapted" },
        updatedAt: { targetField: "updatedAt", disposition: "adapted" },
      }),
    }));
  });

  const folders: LegacyLoreDryRunFolder[] = [];
  const folderIds = new Map<string, LegacyLoreDryRunFolder>();
  const rawFolders = asArray(library.episodeFolders);
  rawFolders.forEach((rawFolder, index) => {
    if (!isRecord(rawFolder)) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "library.episodeFolders",
        sourceIdentity: `index:${index}`,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "raw-only",
        fieldReceipts: Object.freeze([]),
        issueKinds: ["invalid-source-item"],
      }));
      return;
    }
    const sourceFolderId = readNonEmptyString(rawFolder.id);
    const sourceWorkId = readNonEmptyString(rawFolder.workId);
    const title = readNonEmptyString(rawFolder.title);
    const createdAt = readInstant(rawFolder.createdAt);
    const updatedAt = readInstant(rawFolder.updatedAt);
    const sourceIdentity = sourceFolderId ?? `index:${index}`;
    const work = sourceWorkId === null ? undefined : workIds.get(sourceWorkId);
    if (
      sourceFolderId === null ||
      work === undefined ||
      title === null ||
      createdAt === null ||
      updatedAt === null ||
      folderIds.has(sourceFolderId)
    ) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "library.episodeFolders",
        sourceIdentity,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "review",
        fieldReceipts: fieldReceipts(rawFolder, {}),
        issueKinds: ["invalid-folder-ownership"],
      }));
      return;
    }
    const folderId = derive(
      input,
      "DocumentFolder",
      "library.episodeFolders",
      sourceFolderId,
    );
    const mapped: LegacyLoreDryRunFolder = Object.freeze({
      sourceFolderId,
      folderId,
      workId: work.workId,
      parentFolderId: null,
      title,
      createdAt,
      updatedAt,
      orderKey: JSON.stringify([
        typeof rawFolder.order === "number" ? rawFolder.order : index,
        folderId,
      ]),
    });
    folders.push(mapped);
    folderIds.set(sourceFolderId, mapped);
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "library.episodeFolders",
      sourceIdentity: sourceFolderId,
      targetEntityKind: "DocumentFolder",
      targetEntityId: folderId,
      disposition: "adapted",
      fieldReceipts: fieldReceipts(rawFolder, {
        id: { targetField: "id", disposition: "adapted" },
        workId: { targetField: "workId", disposition: "adapted" },
        title: { targetField: "title", disposition: "exact" },
        parentFolderId: { targetField: "parentFolderId", disposition: "review" },
        order: { targetField: "orderKey", disposition: "adapted" },
        createdAt: { targetField: "createdAt", disposition: "adapted" },
        updatedAt: { targetField: "updatedAt", disposition: "adapted" },
      }),
      issueKinds:
        rawFolder.parentFolderId === undefined ||
        rawFolder.parentFolderId === null
          ? []
          : ["parent-folder-review"],
    }));
  });

  const documents: LegacyLoreDryRunDocument[] = [];
  const seenSourceDocumentIds = new Set<string>();
  asArray(library.episodes).forEach((rawDocument, index) => {
    if (!isRecord(rawDocument)) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "library.episodes",
        sourceIdentity: `index:${index}`,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "raw-only",
        fieldReceipts: Object.freeze([]),
        issueKinds: ["invalid-source-item"],
      }));
      return;
    }
    const sourceDocumentId = readNonEmptyString(rawDocument.id);
    const sourceWorkId = readNonEmptyString(rawDocument.workId);
    const title = readNonEmptyString(rawDocument.title);
    const createdAt = readInstant(rawDocument.createdAt);
    const updatedAt = readInstant(rawDocument.updatedAt);
    const sourceIdentity = sourceDocumentId ?? `index:${index}`;
    const work = sourceWorkId === null ? undefined : workIds.get(sourceWorkId);
    const manuscript = sourceDocumentId === null
      ? undefined
      : manuscripts[sourceDocumentId];
    if (
      sourceDocumentId === null ||
      work === undefined ||
      title === null ||
      createdAt === null ||
      updatedAt === null ||
      typeof manuscript !== "string" ||
      manuscript.includes("\r") ||
      seenSourceDocumentIds.has(sourceDocumentId)
    ) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "library.episodes",
        sourceIdentity,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "review",
        fieldReceipts: fieldReceipts(rawDocument, {}),
        issueKinds: ["invalid-document-or-manuscript"],
      }));
      return;
    }
    seenSourceDocumentIds.add(sourceDocumentId);
    const sourceFolderId = readNonEmptyString(rawDocument.parentFolderId);
    const mappedFolder = sourceFolderId === null
      ? undefined
      : folderIds.get(sourceFolderId);
    const folderId = mappedFolder?.workId === work.workId
      ? mappedFolder.folderId
      : null;
    const documentId = derive(
      input,
      "Document",
      "library.episodes",
      sourceDocumentId,
    );
    const descriptor = input.describeManuscript(manuscript);
    if (
      descriptor.checksumIdentity.length === 0 ||
      descriptor.checksumValue.length === 0 ||
      descriptor.byteLength < 0 ||
      descriptor.lengthUtf16 !== manuscript.length
    ) {
      throw new Error("Manuscript descriptor does not match source text");
    }
    const mapped: LegacyLoreDryRunDocument = Object.freeze({
      sourceDocumentId,
      documentId,
      workId: work.workId,
      folderId,
      manuscriptId: derive(
        input,
        "Manuscript",
        "manuscripts",
        sourceDocumentId,
      ),
      revisionId: derive(
        input,
        "DocumentRevision",
        "manuscripts",
        sourceDocumentId,
      ),
      title,
      createdAt,
      updatedAt,
      orderKey: JSON.stringify([
        typeof rawDocument.order === "number"
          ? rawDocument.order
          : typeof rawDocument.index === "number"
            ? rawDocument.index
            : index,
        documentId,
      ]),
      manuscript,
      manuscriptChecksumIdentity: descriptor.checksumIdentity,
      manuscriptChecksumValue: descriptor.checksumValue,
      manuscriptByteLength: descriptor.byteLength,
      manuscriptLengthUtf16: descriptor.lengthUtf16,
    });
    documents.push(mapped);
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "library.episodes",
      sourceIdentity: sourceDocumentId,
      targetEntityKind: "Document",
      targetEntityId: documentId,
      disposition: "adapted",
      fieldReceipts: fieldReceipts(rawDocument, {
        id: { targetField: "id", disposition: "adapted" },
        workId: { targetField: "workId", disposition: "adapted" },
        title: { targetField: "title", disposition: "exact" },
        index: { targetField: "orderKey", disposition: "adapted" },
        order: { targetField: "orderKey", disposition: "adapted" },
        parentFolderId: { targetField: "folderId", disposition: folderId === null ? "review" : "adapted" },
        createdAt: { targetField: "createdAt", disposition: "adapted" },
        updatedAt: { targetField: "updatedAt", disposition: "adapted" },
      }),
      issueKinds:
        sourceFolderId !== null && folderId === null
          ? ["folder-ownership-review"]
          : [],
    }));
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "manuscripts",
      sourceIdentity: sourceDocumentId,
      targetEntityKind: "DocumentRevision",
      targetEntityId: mapped.revisionId,
      disposition: "adapted",
      fieldReceipts: Object.freeze([
        Object.freeze({
          sourceField: "$value",
          targetField: "contentRef",
          disposition: "adapted" as const,
        }),
      ]),
    }));
  });

  for (const sourceDocumentId of Object.keys(manuscripts).sort()) {
    if (!seenSourceDocumentIds.has(sourceDocumentId)) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "manuscripts",
        sourceIdentity: sourceDocumentId,
        targetEntityKind: "RawPreservedItem",
        targetEntityId: null,
        disposition: "raw-only",
        fieldReceipts: Object.freeze([
          Object.freeze({
            sourceField: "$value",
            targetField: "rawSnapshotRef",
            disposition: "raw-only" as const,
          }),
        ]),
        issueKinds: ["orphan-or-unmapped-manuscript"],
      }));
    }
  }

  const documentsBySourceId = new Map(
    documents.map((document) => [document.sourceDocumentId, document]),
  );
  const resumeCheckpoints: LegacyLoreDryRunResumeCheckpoint[] = [];
  const recentWork = isRecord(root.recentWork) ? root.recentWork : {};
  for (const [sourceWorkId, rawResume] of Object.entries(recentWork).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const work = workIds.get(sourceWorkId);
    const rawResumeRecord = isRecord(rawResume) ? rawResume : null;
    const sourceDocumentId = rawResumeRecord === null
      ? null
      : readNonEmptyString(rawResumeRecord.episodeId);
    const cursorOffset = rawResumeRecord === null
      ? null
      : readNonNegativeSafeInteger(rawResumeRecord.cursor);
    const capturedAt = rawResumeRecord === null
      ? null
      : readInstant(rawResumeRecord.updatedAt);
    const document = sourceDocumentId === null
      ? undefined
      : documentsBySourceId.get(sourceDocumentId);
    if (
      rawResumeRecord === null ||
      sourceDocumentId === null ||
      work === undefined ||
      document === undefined ||
      document.workId !== work.workId ||
      cursorOffset === null ||
      cursorOffset > document.manuscriptLengthUtf16 ||
      capturedAt === null
    ) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "recentWork",
        sourceIdentity: sourceWorkId,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "review",
        fieldReceipts: rawFieldReceipts(rawResume),
        issueKinds: ["invalid-resume-checkpoint"],
      }));
      continue;
    }
    const checkpointId = derive(
      input,
      "ResumeCheckpoint",
      "recentWork",
      sourceWorkId,
    );
    const cursorAnchorId = derive(
      input,
      "Anchor",
      "recentWork.cursor",
      sourceWorkId,
    );
    resumeCheckpoints.push(Object.freeze({
      sourceWorkId,
      sourceDocumentId,
      workId: work.workId,
      documentId: document.documentId,
      documentRevisionId: document.revisionId,
      checkpointId,
      cursorAnchorId,
      cursorOffset,
      capturedAt,
      workspaceMode: input.resumeWorkspaceMode,
    }));
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "recentWork",
      sourceIdentity: sourceWorkId,
      targetEntityKind: "ResumeCheckpoint",
      targetEntityId: checkpointId,
      disposition: "adapted",
      fieldReceipts: fieldReceipts(rawResumeRecord, {
        episodeId: { targetField: "documentId", disposition: "adapted" },
        cursor: {
          targetField: "cursorAnchor.startOffset",
          disposition: "adapted",
        },
        updatedAt: { targetField: "capturedAt", disposition: "adapted" },
      }),
    }));
  }

  const writingSessions: LegacyLoreDryRunWritingSession[] = [];
  const seenSourceSessionIds = new Set<string>();
  asArray(root.sessionLogs).forEach((rawSession, index) => {
    if (!isRecord(rawSession)) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "sessionLogs",
        sourceIdentity: `index:${index}`,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "raw-only",
        fieldReceipts: rawFieldReceipts(rawSession),
        issueKinds: ["invalid-source-item"],
      }));
      return;
    }
    const sourceSessionId = readNonEmptyString(rawSession.id);
    const sourceWorkId = readNonEmptyString(rawSession.workId);
    const sourceDocumentId = readNonEmptyString(rawSession.episodeId);
    const modeRef = readNonEmptyString(rawSession.mode);
    const createdAt = readInstant(rawSession.createdAt);
    const startedAt = readInstant(rawSession.startedAt);
    const endedAt = readInstant(rawSession.endedAt);
    const durationMs = readNonNegativeSafeInteger(rawSession.durationMs);
    const charDelta = readSafeInteger(rawSession.charDelta);
    const focusCompletionValid =
      rawSession.focusCompletion === null ||
      rawSession.focusCompletion === undefined ||
      typeof rawSession.focusCompletion === "string";
    const focusTargetMsValid =
      rawSession.focusTargetMs === null ||
      rawSession.focusTargetMs === undefined ||
      readNonNegativeSafeInteger(rawSession.focusTargetMs) !== null;
    const work = sourceWorkId === null ? undefined : workIds.get(sourceWorkId);
    const document = sourceDocumentId === null
      ? undefined
      : documentsBySourceId.get(sourceDocumentId);
    const sourceIdentity = sourceSessionId ?? `index:${index}`;
    if (
      sourceSessionId === null ||
      sourceWorkId === null ||
      sourceDocumentId === null ||
      modeRef === null ||
      createdAt === null ||
      startedAt === null ||
      endedAt === null ||
      new Date(endedAt).getTime() < new Date(startedAt).getTime() ||
      durationMs === null ||
      charDelta === null ||
      !focusCompletionValid ||
      !focusTargetMsValid ||
      work === undefined ||
      document === undefined ||
      document.workId !== work.workId ||
      seenSourceSessionIds.has(sourceSessionId)
    ) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: "sessionLogs",
        sourceIdentity,
        targetEntityKind: null,
        targetEntityId: null,
        disposition: "review",
        fieldReceipts: fieldReceipts(rawSession, {}),
        issueKinds: ["invalid-writing-session-summary"],
      }));
      return;
    }
    seenSourceSessionIds.add(sourceSessionId);
    const sessionId = derive(
      input,
      "WritingSession",
      "sessionLogs",
      sourceSessionId,
    );
    writingSessions.push(Object.freeze({
      sourceSessionId,
      sessionId,
      workId: work.workId,
      documentId: document.documentId,
      activityPolicyId: work.activityPolicyId,
      state: input.completedWritingSessionState,
      modeRef,
      createdAt,
      startedAt,
      endedAt,
      lastDurableHeartbeatAt: endedAt,
      recoveryEvidenceJson: JSON.stringify({
        schemaVersion: 1,
        kind: "legacy-summary",
        source: {
          durationMs,
          charDelta,
          focusCompletion: rawSession.focusCompletion ?? null,
          focusTargetMs: rawSession.focusTargetMs ?? null,
        },
      }),
    }));
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "sessionLogs",
      sourceIdentity: sourceSessionId,
      targetEntityKind: "WritingSession",
      targetEntityId: sessionId,
      disposition: "adapted",
      fieldReceipts: fieldReceipts(rawSession, {
        id: { targetField: "id", disposition: "adapted" },
        workId: { targetField: "workId", disposition: "adapted" },
        episodeId: { targetField: "documentId", disposition: "adapted" },
        mode: { targetField: "modeRef", disposition: "exact" },
        createdAt: { targetField: "createdAt", disposition: "adapted" },
        startedAt: { targetField: "startedAt", disposition: "adapted" },
        endedAt: { targetField: "endedAt", disposition: "adapted" },
        durationMs: {
          targetField: "recoveryEvidenceJson.source.durationMs",
          disposition: "adapted",
        },
        charDelta: {
          targetField: "recoveryEvidenceJson.source.charDelta",
          disposition: "adapted",
        },
        focusCompletion: {
          targetField: "recoveryEvidenceJson.source.focusCompletion",
          disposition: "adapted",
        },
        focusTargetMs: {
          targetField: "recoveryEvidenceJson.source.focusTargetMs",
          disposition: "adapted",
        },
      }),
    }));
  });

  const globalLoreBookIds = new Set(
    asArray(root.books).flatMap((book) =>
      isRecord(book) &&
      book.scope === "global" &&
      readNonEmptyString(book.id) !== null
        ? [readNonEmptyString(book.id) as string]
        : [],
    ),
  );
  const globalLoreEntryIds = new Set(
    asArray(root.entries).flatMap((entry) =>
      isRecord(entry) &&
      globalLoreBookIds.has(readNonEmptyString(entry.bookId) ?? "") &&
      readNonEmptyString(entry.id) !== null
        ? [readNonEmptyString(entry.id) as string]
        : [],
    ),
  );

  const rawArrayCollections = Object.freeze([
    "books",
    "entries",
    "characters",
    "plotThreads",
    "protectedTerms",
    "fragments",
    "templateSchemas",
  ] as const);
  for (const collection of rawArrayCollections) {
    const value = root[collection];
    asArray(value).forEach((item, index) => {
      const sourceIdentity = isRecord(item)
        ? readNonEmptyString(item.id) ?? `index:${index}`
        : `index:${index}`;
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: collection,
        sourceIdentity,
        targetEntityKind: "RawPreservedItem",
        targetEntityId: null,
        disposition: "raw-only",
        fieldReceipts: rawFieldReceipts(item),
        issueKinds: [
          "no-approved-target-contract",
          ...(
            (collection === "books" && globalLoreBookIds.has(sourceIdentity)) ||
            (collection === "entries" && globalLoreEntryIds.has(sourceIdentity))
              ? ["shared-lore-canonical-finalization-blocked"]
              : []
          ),
        ],
      }));
    });
    if (value !== undefined && !Array.isArray(value)) {
      receipts.push(createReceipt({
        batchId,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceCollection: collection,
        sourceIdentity: "$container",
        targetEntityKind: "RawPreservedItem",
        targetEntityId: null,
        disposition: "raw-only",
        fieldReceipts: rawFieldReceipts(value),
        issueKinds: ["invalid-source-container"],
      }));
    }
  }

  const structureSnapshots = isRecord(root.factTemplatesByEpisode)
    ? root.factTemplatesByEpisode
    : {};
  for (const [sourceDocumentId, snapshot] of Object.entries(
    structureSnapshots,
  ).sort(([left], [right]) => left.localeCompare(right))) {
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "factTemplatesByEpisode",
      sourceIdentity: sourceDocumentId,
      targetEntityKind: "RawPreservedItem",
      targetEntityId: null,
      disposition: "raw-only",
      fieldReceipts: rawFieldReceipts(snapshot),
      issueKinds: documentsBySourceId.has(sourceDocumentId)
        ? ["structure-target-contract-pending"]
        : ["orphan-structure"],
    }));
  }

  const singleValueCollections = Object.freeze([
    "schemaVersion",
    "editorTypography",
    "appSettings",
    "inspirationPools",
    "contextSnapshot",
  ] as const);
  for (const collection of singleValueCollections) {
    if (root[collection] === undefined) {
      continue;
    }
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: collection,
      sourceIdentity: "$value",
      targetEntityKind: "RawPreservedItem",
      targetEntityId: null,
      disposition: "raw-only",
      fieldReceipts: rawFieldReceipts(root[collection]),
      issueKinds: ["no-approved-target-contract"],
    }));
  }

  const knownRootFields = new Set<string>([
    "library",
    "manuscripts",
    "recentWork",
    "factTemplatesByEpisode",
    "sessionLogs",
    ...rawArrayCollections,
    ...singleValueCollections,
  ]);
  for (const [field, value] of Object.entries(root)) {
    if (knownRootFields.has(field)) {
      continue;
    }
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "$",
      sourceIdentity: field,
      targetEntityKind: "RawPreservedItem",
      targetEntityId: null,
      disposition: "raw-only",
      fieldReceipts: rawFieldReceipts(value),
      issueKinds: ["unknown-source-collection"],
    }));
  }

  const knownLibraryFields = new Set([
    "works",
    "episodeFolders",
    "episodes",
  ]);
  for (const [field, value] of Object.entries(library)) {
    if (knownLibraryFields.has(field)) {
      continue;
    }
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: "library",
      sourceIdentity: field,
      targetEntityKind: "RawPreservedItem",
      targetEntityId: null,
      disposition: "raw-only",
      fieldReceipts: rawFieldReceipts(value),
      issueKinds: ["unknown-source-collection"],
    }));
  }

  const invalidContainers = [
    ["$", input.payload, rootIsRecord],
    ["library", root.library, isRecord(root.library)],
    ["library.works", library.works, Array.isArray(library.works)],
    [
      "library.episodeFolders",
      library.episodeFolders,
      Array.isArray(library.episodeFolders),
    ],
    ["library.episodes", library.episodes, Array.isArray(library.episodes)],
    ["manuscripts", root.manuscripts, isRecord(root.manuscripts)],
    ["recentWork", root.recentWork, isRecord(root.recentWork)],
    [
      "factTemplatesByEpisode",
      root.factTemplatesByEpisode,
      isRecord(root.factTemplatesByEpisode),
    ],
    ["sessionLogs", root.sessionLogs, Array.isArray(root.sessionLogs)],
  ] as const;
  for (const [collection, value, valid] of invalidContainers) {
    if (value === undefined || valid) {
      continue;
    }
    receipts.push(createReceipt({
      batchId,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceCollection: collection,
      sourceIdentity: "$container",
      targetEntityKind: "RawPreservedItem",
      targetEntityId: null,
      disposition: "raw-only",
      fieldReceipts: rawFieldReceipts(value),
      issueKinds: ["invalid-source-container"],
    }));
  }

  type SourceItem = {
    readonly sourceCollection: string;
    readonly sourceIdentity: string;
    readonly value: unknown;
  };
  const sourceItems: SourceItem[] = [];
  const addArrayItems = (sourceCollection: string, value: unknown): void => {
    if (value === undefined) {
      return;
    }
    if (!Array.isArray(value)) {
      sourceItems.push({
        sourceCollection,
        sourceIdentity: "$container",
        value,
      });
      return;
    }
    value.forEach((item, index) => {
      sourceItems.push({
        sourceCollection,
        sourceIdentity: isRecord(item)
          ? readNonEmptyString(item.id) ?? `index:${index}`
          : `index:${index}`,
        value: item,
      });
    });
  };
  const addObjectItems = (sourceCollection: string, value: unknown): void => {
    if (value === undefined) {
      return;
    }
    if (!isRecord(value)) {
      sourceItems.push({
        sourceCollection,
        sourceIdentity: "$container",
        value,
      });
      return;
    }
    for (const [sourceIdentity, item] of Object.entries(value).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      sourceItems.push({ sourceCollection, sourceIdentity, value: item });
    }
  };
  if (!rootIsRecord && input.payload !== undefined) {
    sourceItems.push({
      sourceCollection: "$",
      sourceIdentity: "$container",
      value: input.payload,
    });
  }
  if (root.library !== undefined && !isRecord(root.library)) {
    sourceItems.push({
      sourceCollection: "library",
      sourceIdentity: "$container",
      value: root.library,
    });
  }
  addArrayItems("library.works", library.works);
  addArrayItems("library.episodeFolders", library.episodeFolders);
  addArrayItems("library.episodes", library.episodes);
  addObjectItems("manuscripts", root.manuscripts);
  addObjectItems("recentWork", root.recentWork);
  addObjectItems("factTemplatesByEpisode", root.factTemplatesByEpisode);
  addArrayItems("sessionLogs", root.sessionLogs);
  for (const collection of rawArrayCollections) {
    addArrayItems(collection, root[collection]);
  }
  for (const collection of singleValueCollections) {
    if (root[collection] !== undefined) {
      sourceItems.push({
        sourceCollection: collection,
        sourceIdentity: "$value",
        value: root[collection],
      });
    }
  }
  for (const [field, value] of Object.entries(root)) {
    if (!knownRootFields.has(field)) {
      sourceItems.push({
        sourceCollection: "$",
        sourceIdentity: field,
        value,
      });
    }
  }
  for (const [field, value] of Object.entries(library)) {
    if (!knownLibraryFields.has(field)) {
      sourceItems.push({
        sourceCollection: "library",
        sourceIdentity: field,
        value,
      });
    }
  }

  if (receipts.length !== sourceItems.length) {
    throw new Error(
      `Migration receipt coverage mismatch: ${receipts.length}/${sourceItems.length}`,
    );
  }
  const sourceWorkByDocument = new Map<string, string>();
  for (const document of asArray(library.episodes)) {
    if (!isRecord(document)) continue;
    const documentId = readNonEmptyString(document.id);
    const workId = readNonEmptyString(document.workId);
    if (documentId !== null && workId !== null) {
      sourceWorkByDocument.set(documentId, workId);
    }
  }
  const sourceWorkByBook = new Map<string, string | null>();
  for (const book of asArray(root.books)) {
    if (!isRecord(book)) continue;
    const bookId = readNonEmptyString(book.id);
    if (bookId === null) continue;
    sourceWorkByBook.set(
      bookId,
      book.scope === "global" ? null : readNonEmptyString(book.workId),
    );
  }
  const ownershipRefForSourceItem = (item: SourceItem): string | null => {
    if (item.sourceCollection === "library.works") {
      return isRecord(item.value)
        ? readNonEmptyString(item.value.id)
        : null;
    }
    if (item.sourceCollection === "recentWork") {
      return item.sourceIdentity;
    }
    if (
      item.sourceCollection === "manuscripts" ||
      item.sourceCollection === "factTemplatesByEpisode"
    ) {
      return sourceWorkByDocument.get(item.sourceIdentity) ?? null;
    }
    if (!isRecord(item.value)) {
      return null;
    }
    const directWorkId = readNonEmptyString(item.value.workId);
    if (directWorkId !== null) {
      return directWorkId;
    }
    if (item.sourceCollection === "entries") {
      const bookId = readNonEmptyString(item.value.bookId);
      return bookId === null ? null : sourceWorkByBook.get(bookId) ?? null;
    }
    return null;
  };
  const sourceItemQueues = new Map<string, SourceItem[]>();
  for (const item of sourceItems) {
    const key = JSON.stringify([item.sourceCollection, item.sourceIdentity]);
    const queue = sourceItemQueues.get(key) ?? [];
    queue.push(item);
    sourceItemQueues.set(key, queue);
  }
  const sourceOccurrences = new Map<string, number>();
  const rawItems: LegacyLoreDryRunRawItem[] = [];
  const linkedReceipts: MigrationItemReceipt[] = receipts.map((receipt) => {
    const key = JSON.stringify([
      receipt.sourceCollection,
      receipt.sourceIdentity,
    ]);
    const sourceItem = sourceItemQueues.get(key)?.shift();
    if (sourceItem === undefined) {
      throw new Error(`Missing raw source item for receipt ${key}`);
    }
    const sourceOccurrence = sourceOccurrences.get(key) ?? 0;
    sourceOccurrences.set(key, sourceOccurrence + 1);
    const rawItemId = derive(
      input,
      "RawPreservedItem",
      receipt.sourceCollection,
      `${receipt.sourceIdentity}:${sourceOccurrence}`,
    );
    const redacted = redactSecretLikeFields(
      sourceItem.value,
      secretFragments,
      input.secretRedactionValue,
    );
    const descriptor = input.describeRawItem({
      sourceCollection: receipt.sourceCollection,
      sourceIdentity: receipt.sourceIdentity,
      value: redacted.value,
    });
    if (
      descriptor.serializationIdentity.length === 0 ||
      descriptor.checksumIdentity.length === 0 ||
      descriptor.checksumValue.length === 0 ||
      descriptor.byteLength < 0 ||
      descriptor.byteLength !== descriptor.bytes.byteLength
    ) {
      throw new Error("Raw item descriptor does not match its bytes");
    }
    rawItems.push(Object.freeze({
      rawItemId,
      sourceCollection: receipt.sourceCollection,
      sourceIdentity: receipt.sourceIdentity,
      sourceOccurrence,
      ownershipRef: ownershipRefForSourceItem(sourceItem),
      serializationIdentity: descriptor.serializationIdentity,
      checksumIdentity: descriptor.checksumIdentity,
      checksumValue: descriptor.checksumValue,
      byteLength: descriptor.byteLength,
      bytes: new Uint8Array(descriptor.bytes),
    }));
    return Object.freeze({
      ...receipt,
      rawItemId,
      issueKinds: redacted.redactedFieldCount === 0
        ? receipt.issueKinds
        : Object.freeze([
            ...new Set([...receipt.issueKinds, "secret-field-redacted"]),
          ].sort()),
    });
  });
  const sourceItemCount = sourceItems.length;
  const receiptCoverage: LegacyLoreReceiptCoverage = Object.freeze({
    sourceItemCount,
    receiptCount: linkedReceipts.length,
    uncoveredItemCount: 0,
  });
  const rawManuscriptsByIdentity = new Map(
    rawItems
      .filter((item) =>
        item.sourceCollection === "manuscripts" &&
        item.sourceOccurrence === 0
      )
      .map((item) => [item.sourceIdentity, item]),
  );
  const manuscriptProofs: LegacyLoreDryRunManuscriptProof[] = [];
  for (const [sourceDocumentId, manuscript] of Object.entries(manuscripts).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (typeof manuscript !== "string") {
      continue;
    }
    const sourceDescriptor = input.describeManuscript(manuscript);
    if (
      sourceDescriptor.checksumIdentity.length === 0 ||
      sourceDescriptor.checksumValue.length === 0 ||
      sourceDescriptor.byteLength < 0 ||
      sourceDescriptor.lengthUtf16 !== manuscript.length
    ) {
      throw new Error("Manuscript proof descriptor does not match source text");
    }
    const rawItem = rawManuscriptsByIdentity.get(sourceDocumentId);
    if (rawItem === undefined) {
      throw new Error("Manuscript proof is missing its raw preservation item");
    }
    const document = documentsBySourceId.get(sourceDocumentId);
    if (
      document !== undefined &&
      (
        document.manuscriptChecksumIdentity !==
          sourceDescriptor.checksumIdentity ||
        document.manuscriptChecksumValue !== sourceDescriptor.checksumValue ||
        document.manuscriptByteLength !== sourceDescriptor.byteLength ||
        document.manuscriptLengthUtf16 !== sourceDescriptor.lengthUtf16
      )
    ) {
      throw new Error("Mapped manuscript checksum differs from source proof");
    }
    manuscriptProofs.push(Object.freeze({
      sourceDocumentId,
      sourceOwnershipRef: sourceWorkByDocument.get(sourceDocumentId) ?? null,
      sourceChecksumIdentity: sourceDescriptor.checksumIdentity,
      sourceChecksumValue: sourceDescriptor.checksumValue,
      sourceByteLength: sourceDescriptor.byteLength,
      sourceLengthUtf16: sourceDescriptor.lengthUtf16,
      rawItemId: rawItem.rawItemId,
      rawChecksumIdentity: rawItem.checksumIdentity,
      rawChecksumValue: rawItem.checksumValue,
      preservation: document === undefined
        ? "quarantine-raw-exact"
        : "target-revision-checksum-match",
      targetDocumentId: document?.documentId ?? null,
      targetRevisionId: document?.revisionId ?? null,
      targetChecksumIdentity:
        document?.manuscriptChecksumIdentity ?? null,
      targetChecksumValue: document?.manuscriptChecksumValue ?? null,
    }));
  }

  return Object.freeze({
    mapperVersion: input.mapperVersion,
    batchId,
    sourceSnapshotId: input.sourceSnapshotId,
    sourceSnapshotChecksumValue: input.sourceSnapshotChecksumValue,
    createdAt: input.createdAt,
    studioId,
    works: Object.freeze(works),
    folders: Object.freeze(folders),
    documents: Object.freeze(documents),
    resumeCheckpoints: Object.freeze(resumeCheckpoints),
    writingSessions: Object.freeze(writingSessions),
    rawItems: Object.freeze(rawItems),
    manuscriptProofs: Object.freeze(manuscriptProofs),
    sharedLoreFinalization: Object.freeze({
      status: "blocked-by-schema-decision",
      globalBookCount: globalLoreBookIds.size,
      globalEntryCount: globalLoreEntryIds.size,
    }),
    receipts: Object.freeze(
      linkedReceipts.sort((left, right) =>
        `${left.sourceCollection}:${left.sourceIdentity}`.localeCompare(
          `${right.sourceCollection}:${right.sourceIdentity}`,
        ),
      ),
    ),
    receiptCoverage,
    inventory,
  });
}
