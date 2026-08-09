import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type WorkspaceDocumentSummary = {
  readonly documentId: EntityId<"Document">;
  readonly title: string;
  readonly currentRevisionId: EntityId<"DocumentRevision">;
};

export type WorkspaceWorkSummary = {
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly updatedAt: string;
  readonly documents: readonly WorkspaceDocumentSummary[];
};

export type WorkspaceCatalogProjection = {
  readonly schemaVersion: 1;
  readonly works: readonly WorkspaceWorkSummary[];
  readonly activeWorkId: EntityId<"Work"> | null;
  readonly activeDocumentId: EntityId<"Document"> | null;
  readonly canCreateFirstWork: boolean;
};

export type CreateFirstWorkCommand = {
  readonly schemaVersion: 1;
  readonly title: string;
  readonly firstDocumentTitle: string;
};

export type CreateWorkCommand = CreateFirstWorkCommand;

export type CreateFirstWorkResult = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly revisionId: EntityId<"DocumentRevision">;
};

export type CreateWorkResult = CreateFirstWorkResult;

export type CreateDocumentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly title: string;
};

export type CreateDocumentResult = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly revisionId: EntityId<"DocumentRevision">;
};

export type ActivateWorkspaceLocationCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document"> | null;
};

export type CaptureWorkspaceResumeCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly workspaceMode: "writing" | "structure" | "records" | "versions";
};

function readRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
}

function readNonEmptyTrimmedText(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const text = value.trim();
  if (text.length === 0) {
    throw new Error(`${label} must not be blank`);
  }
  return text;
}

function readIdentity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function readInstant(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} must be an absolute instant`);
  }
  return new Date(value).toISOString();
}

function readOffset(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

export function parseCreateWorkCommand(
  value: unknown,
): CreateWorkCommand {
  const input = readRecord(value, "CreateWorkCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "title", "firstDocumentTitle"],
    "CreateWorkCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("CreateWorkCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    title: readNonEmptyTrimmedText(input.title, "CreateWorkCommand.title"),
    firstDocumentTitle: readNonEmptyTrimmedText(
      input.firstDocumentTitle,
      "CreateWorkCommand.firstDocumentTitle",
    ),
  });
}

export function parseCreateFirstWorkCommand(
  value: unknown,
): CreateFirstWorkCommand {
  return parseCreateWorkCommand(value);
}

export function parseCreateDocumentCommand(
  value: unknown,
): CreateDocumentCommand {
  const input = readRecord(value, "CreateDocumentCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "title"],
    "CreateDocumentCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("CreateDocumentCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "CreateDocumentCommand.workId",
    ),
    title: readNonEmptyTrimmedText(
      input.title,
      "CreateDocumentCommand.title",
    ),
  });
}

export function parseActivateWorkspaceLocationCommand(
  value: unknown,
): ActivateWorkspaceLocationCommand {
  const input = readRecord(value, "ActivateWorkspaceLocationCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "documentId"],
    "ActivateWorkspaceLocationCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "ActivateWorkspaceLocationCommand.schemaVersion must be 1",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "ActivateWorkspaceLocationCommand.workId",
    ),
    documentId:
      input.documentId === null
        ? null
        : readIdentity<"Document">(
            input.documentId,
            "ActivateWorkspaceLocationCommand.documentId",
          ),
  });
}

export function parseCaptureWorkspaceResumeCommand(
  value: unknown,
): CaptureWorkspaceResumeCommand {
  const input = readRecord(value, "CaptureWorkspaceResumeCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "documentId", "selection", "workspaceMode"],
    "CaptureWorkspaceResumeCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("CaptureWorkspaceResumeCommand.schemaVersion must be 1");
  }
  if (
    input.workspaceMode !== "writing" &&
    input.workspaceMode !== "structure" &&
    input.workspaceMode !== "records" &&
    input.workspaceMode !== "versions"
  ) {
    throw new Error("CaptureWorkspaceResumeCommand.workspaceMode is invalid");
  }
  const selection = readRecord(
    input.selection,
    "CaptureWorkspaceResumeCommand.selection",
  );
  assertOnlyFields(
    selection,
    ["anchor", "head"],
    "CaptureWorkspaceResumeCommand.selection",
  );
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "CaptureWorkspaceResumeCommand.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "CaptureWorkspaceResumeCommand.documentId",
    ),
    selection: Object.freeze({
      anchor: readOffset(
        selection.anchor,
        "CaptureWorkspaceResumeCommand.selection.anchor",
      ),
      head: readOffset(
        selection.head,
        "CaptureWorkspaceResumeCommand.selection.head",
      ),
    }),
    workspaceMode: input.workspaceMode,
  });
}

export function parseCreateFirstWorkResult(
  value: unknown,
): CreateFirstWorkResult {
  const input = readRecord(value, "CreateFirstWorkResult");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "documentId", "revisionId"],
    "CreateFirstWorkResult",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("CreateFirstWorkResult.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "CreateFirstWorkResult.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "CreateFirstWorkResult.documentId",
    ),
    revisionId: readIdentity<"DocumentRevision">(
      input.revisionId,
      "CreateFirstWorkResult.revisionId",
    ),
  });
}

export function parseCreateWorkResult(
  value: unknown,
): CreateWorkResult {
  return parseCreateFirstWorkResult(value);
}

export function parseCreateDocumentResult(
  value: unknown,
): CreateDocumentResult {
  const input = readRecord(value, "CreateDocumentResult");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "documentId", "revisionId"],
    "CreateDocumentResult",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("CreateDocumentResult.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "CreateDocumentResult.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "CreateDocumentResult.documentId",
    ),
    revisionId: readIdentity<"DocumentRevision">(
      input.revisionId,
      "CreateDocumentResult.revisionId",
    ),
  });
}

export function parseWorkspaceCatalogProjection(
  value: unknown,
): WorkspaceCatalogProjection {
  const input = readRecord(value, "WorkspaceCatalogProjection");
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "works",
      "activeWorkId",
      "activeDocumentId",
      "canCreateFirstWork",
    ],
    "WorkspaceCatalogProjection",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("WorkspaceCatalogProjection.schemaVersion must be 1");
  }
  if (!Array.isArray(input.works)) {
    throw new Error("WorkspaceCatalogProjection.works must be an array");
  }
  const workIds = new Set<EntityId<"Work">>();
  const documentIds = new Set<EntityId<"Document">>();
  const works = input.works.map((candidate, workIndex) => {
    const work = readRecord(
      candidate,
      `WorkspaceCatalogProjection.works[${workIndex}]`,
    );
    assertOnlyFields(
      work,
      ["workId", "title", "updatedAt", "documents"],
      `WorkspaceCatalogProjection.works[${workIndex}]`,
    );
    const workId = readIdentity<"Work">(
      work.workId,
      `WorkspaceCatalogProjection.works[${workIndex}].workId`,
    );
    if (workIds.has(workId)) {
      throw new Error(`Duplicate workspace work identity: ${workId}`);
    }
    workIds.add(workId);
    if (!Array.isArray(work.documents) || work.documents.length === 0) {
      throw new Error(
        `WorkspaceCatalogProjection.works[${workIndex}].documents must be non-empty`,
      );
    }
    const documents = work.documents.map((candidate, documentIndex) => {
      const document = readRecord(
        candidate,
        `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}]`,
      );
      assertOnlyFields(
        document,
        ["documentId", "title", "currentRevisionId"],
        `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}]`,
      );
      const documentId = readIdentity<"Document">(
        document.documentId,
        `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}].documentId`,
      );
      if (documentIds.has(documentId)) {
        throw new Error(`Duplicate workspace document identity: ${documentId}`);
      }
      documentIds.add(documentId);
      return Object.freeze({
        documentId,
        title: readNonEmptyTrimmedText(
          document.title,
          `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}].title`,
        ),
        currentRevisionId: readIdentity<"DocumentRevision">(
          document.currentRevisionId,
          `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}].currentRevisionId`,
        ),
      });
    });
    return Object.freeze({
      workId,
      title: readNonEmptyTrimmedText(
        work.title,
        `WorkspaceCatalogProjection.works[${workIndex}].title`,
      ),
      updatedAt: readInstant(
        work.updatedAt,
        `WorkspaceCatalogProjection.works[${workIndex}].updatedAt`,
      ),
      documents: Object.freeze(documents),
    });
  });
  const activeWorkId =
    input.activeWorkId === null
      ? null
      : readIdentity<"Work">(
          input.activeWorkId,
          "WorkspaceCatalogProjection.activeWorkId",
        );
  const activeDocumentId =
    input.activeDocumentId === null
      ? null
      : readIdentity<"Document">(
          input.activeDocumentId,
          "WorkspaceCatalogProjection.activeDocumentId",
        );
  if ((activeWorkId === null) !== (activeDocumentId === null)) {
    throw new Error("Workspace catalog active identities must both be null or present");
  }
  if (
    activeWorkId !== null &&
    (
      !workIds.has(activeWorkId) ||
      !works.some(
        (work) =>
          work.workId === activeWorkId &&
          work.documents.some(
            (document) => document.documentId === activeDocumentId,
          ),
      )
    )
  ) {
    throw new Error("Workspace catalog active identities must share one registered Work");
  }
  if (typeof input.canCreateFirstWork !== "boolean") {
    throw new Error("WorkspaceCatalogProjection.canCreateFirstWork must be boolean");
  }
  if (input.canCreateFirstWork !== (works.length === 0)) {
    throw new Error("canCreateFirstWork must identify an empty catalog");
  }
  return Object.freeze({
    schemaVersion: 1,
    works: Object.freeze(works),
    activeWorkId,
    activeDocumentId,
    canCreateFirstWork: input.canCreateFirstWork,
  });
}
