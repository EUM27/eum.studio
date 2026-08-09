export type LegacyLoreInventoryIssueKind =
  | "duplicate-document-id"
  | "duplicate-work-id"
  | "invalid-context-snapshot"
  | "invalid-resume-checkpoint"
  | "invalid-source-item"
  | "orphan-document"
  | "orphan-manuscript"
  | "orphan-structure"
  | "work-document-ownership-mismatch"
  | "work-document-reference-missing";

export type LegacyLoreInventoryIssue = {
  readonly kind: LegacyLoreInventoryIssueKind;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly disposition: "quarantine" | "review" | "raw-only";
};

export type LegacyLoreInventoryCounts = {
  readonly workCount: number;
  readonly documentCount: number;
  readonly manuscriptCount: number;
  readonly registeredManuscriptCount: number;
  readonly orphanManuscriptCount: number;
  readonly structureSnapshotCount: number;
  readonly orphanStructureCount: number;
  readonly resumeCandidateCount: number;
  readonly validResumeCheckpointCount: number;
  readonly invalidResumeCheckpointCount: number;
  readonly sessionCount: number;
  readonly loreBookCount: number;
  readonly loreEntryCount: number;
};

export type LegacyLoreInventoryReport = {
  readonly counts: LegacyLoreInventoryCounts;
  readonly issues: readonly LegacyLoreInventoryIssue[];
};

type LegacyWork = {
  readonly id: string;
  readonly episodeIds: readonly string[];
};

type LegacyDocument = {
  readonly id: string;
  readonly workId: string;
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

function readIdentity(
  value: unknown,
): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return typeof value.id === "string" && value.id.length > 0
    ? value.id
    : null;
}

function issue(
  kind: LegacyLoreInventoryIssueKind,
  sourceCollection: string,
  sourceIdentity: string,
  disposition: LegacyLoreInventoryIssue["disposition"],
): LegacyLoreInventoryIssue {
  return Object.freeze({
    kind,
    sourceCollection,
    sourceIdentity,
    disposition,
  });
}

function parseWorks(
  values: readonly unknown[],
  issues: LegacyLoreInventoryIssue[],
): readonly LegacyWork[] {
  const works: LegacyWork[] = [];
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const id = readIdentity(value);
    if (id === null || !isRecord(value)) {
      issues.push(issue(
        "invalid-source-item",
        "library.works",
        `index:${index}`,
        "raw-only",
      ));
      return;
    }
    if (seen.has(id)) {
      issues.push(issue(
        "duplicate-work-id",
        "library.works",
        id,
        "review",
      ));
      return;
    }
    seen.add(id);
    works.push(Object.freeze({
      id,
      episodeIds: Object.freeze(
        asArray(value.episodeIds).filter(
          (episodeId): episodeId is string =>
            typeof episodeId === "string",
        ),
      ),
    }));
  });
  return Object.freeze(works);
}

function parseDocuments(
  values: readonly unknown[],
  issues: LegacyLoreInventoryIssue[],
): readonly LegacyDocument[] {
  const documents: LegacyDocument[] = [];
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const id = readIdentity(value);
    if (
      id === null ||
      !isRecord(value) ||
      typeof value.workId !== "string" ||
      value.workId.length === 0
    ) {
      issues.push(issue(
        "invalid-source-item",
        "library.episodes",
        `index:${index}`,
        "raw-only",
      ));
      return;
    }
    if (seen.has(id)) {
      issues.push(issue(
        "duplicate-document-id",
        "library.episodes",
        id,
        "review",
      ));
      return;
    }
    seen.add(id);
    documents.push(Object.freeze({ id, workId: value.workId }));
  });
  return Object.freeze(documents);
}

function validResume(
  workId: string,
  value: unknown,
  worksById: ReadonlyMap<string, LegacyWork>,
  documentsById: ReadonlyMap<string, LegacyDocument>,
  manuscripts: Readonly<Record<string, unknown>>,
): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const documentId = value.episodeId;
  const cursor = value.cursor;
  const updatedAt = value.updatedAt;
  if (
    typeof documentId !== "string" ||
    !Number.isSafeInteger(cursor) ||
    typeof cursor !== "number" ||
    cursor < 0 ||
    typeof updatedAt !== "number" ||
    !Number.isFinite(updatedAt) ||
    Number.isNaN(new Date(updatedAt).getTime()) ||
    !worksById.has(workId)
  ) {
    return false;
  }
  const document = documentsById.get(documentId);
  const manuscript = manuscripts[documentId];
  return (
    document?.workId === workId &&
    typeof manuscript === "string" &&
    cursor <= manuscript.length
  );
}

export function inventoryLegacyLorePayload(
  value: unknown,
): LegacyLoreInventoryReport {
  const root = isRecord(value) ? value : {};
  const library = isRecord(root.library) ? root.library : {};
  const issues: LegacyLoreInventoryIssue[] = [];
  const works = parseWorks(asArray(library.works), issues);
  const documents = parseDocuments(asArray(library.episodes), issues);
  const worksById = new Map(works.map((work) => [work.id, work]));
  const documentsById = new Map(
    documents.map((document) => [document.id, document]),
  );

  for (const document of documents) {
    if (!worksById.has(document.workId)) {
      issues.push(issue(
        "orphan-document",
        "library.episodes",
        document.id,
        "review",
      ));
    }
  }
  for (const work of works) {
    for (const documentId of work.episodeIds) {
      const document = documentsById.get(documentId);
      if (document === undefined) {
        issues.push(issue(
          "work-document-reference-missing",
          "library.works.episodeIds",
          `${work.id}:${documentId}`,
          "review",
        ));
      } else if (document.workId !== work.id) {
        issues.push(issue(
          "work-document-ownership-mismatch",
          "library.works.episodeIds",
          `${work.id}:${documentId}`,
          "review",
        ));
      }
    }
  }

  const manuscripts = isRecord(root.manuscripts) ? root.manuscripts : {};
  let registeredManuscriptCount = 0;
  let orphanManuscriptCount = 0;
  for (const [documentId, manuscript] of Object.entries(manuscripts)) {
    if (typeof manuscript !== "string") {
      issues.push(issue(
        "invalid-source-item",
        "manuscripts",
        documentId,
        "raw-only",
      ));
    } else if (documentsById.has(documentId)) {
      registeredManuscriptCount += 1;
    } else {
      orphanManuscriptCount += 1;
      issues.push(issue(
        "orphan-manuscript",
        "manuscripts",
        documentId,
        "quarantine",
      ));
    }
  }

  const structures = isRecord(root.factTemplatesByEpisode)
    ? root.factTemplatesByEpisode
    : {};
  let orphanStructureCount = 0;
  for (const documentId of Object.keys(structures)) {
    if (!documentsById.has(documentId)) {
      orphanStructureCount += 1;
      issues.push(issue(
        "orphan-structure",
        "factTemplatesByEpisode",
        documentId,
        "quarantine",
      ));
    }
  }

  const recentWork = isRecord(root.recentWork) ? root.recentWork : {};
  let validResumeCheckpointCount = 0;
  let invalidResumeCheckpointCount = 0;
  for (const [workId, resume] of Object.entries(recentWork)) {
    if (
      validResume(
        workId,
        resume,
        worksById,
        documentsById,
        manuscripts,
      )
    ) {
      validResumeCheckpointCount += 1;
    } else {
      invalidResumeCheckpointCount += 1;
      issues.push(issue(
        "invalid-resume-checkpoint",
        "recentWork",
        workId,
        "review",
      ));
    }
  }

  if (root.contextSnapshot !== undefined) {
    const context = root.contextSnapshot;
    const valid = isRecord(context) &&
      typeof context.workId === "string" &&
      typeof context.episodeId === "string" &&
      Number.isSafeInteger(context.cursorOffset) &&
      typeof context.cursorOffset === "number" &&
      context.cursorOffset >= 0 &&
      documentsById.get(context.episodeId)?.workId === context.workId &&
      typeof manuscripts[context.episodeId] === "string" &&
      context.cursorOffset <= (manuscripts[context.episodeId] as string).length;
    if (!valid) {
      issues.push(issue(
        "invalid-context-snapshot",
        "contextSnapshot",
        "current",
        "review",
      ));
    }
  }

  const counts: LegacyLoreInventoryCounts = Object.freeze({
    workCount: works.length,
    documentCount: documents.length,
    manuscriptCount: Object.keys(manuscripts).length,
    registeredManuscriptCount,
    orphanManuscriptCount,
    structureSnapshotCount: Object.keys(structures).length,
    orphanStructureCount,
    resumeCandidateCount: Object.keys(recentWork).length,
    validResumeCheckpointCount,
    invalidResumeCheckpointCount,
    sessionCount: asArray(root.sessionLogs).length,
    loreBookCount: asArray(root.books).length,
    loreEntryCount: asArray(root.entries).length,
  });
  return Object.freeze({
    counts,
    issues: Object.freeze(
      issues.sort((left, right) =>
        `${left.kind}:${left.sourceIdentity}`.localeCompare(
          `${right.kind}:${right.sourceIdentity}`,
        ),
      ),
    ),
  });
}
