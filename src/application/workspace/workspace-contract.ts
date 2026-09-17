import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import {
  parseDocumentCompletionProjection,
  type DocumentCompletionProjection,
} from "./document-completion";

export const UNTITLED_DOCUMENT_TITLE = "제목없음";

export type WorkspaceDocumentSummary = {
  readonly documentId: EntityId<"Document">;
  readonly title: string;
  readonly currentRevisionId: EntityId<"DocumentRevision">;
  readonly folderId: EntityId<"DocumentFolder"> | null;
  readonly completion: DocumentCompletionProjection;
};

export type WorkspaceDocumentFolderSummary = {
  readonly folderId: EntityId<"DocumentFolder">;
  readonly title: string;
  readonly parentFolderId: EntityId<"DocumentFolder"> | null;
};

export type WorkspaceWorkSummary = {
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly updatedAt: string;
  readonly folders: readonly WorkspaceDocumentFolderSummary[];
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

export type RenameWorkCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly title: string;
};

export type RetireWorkCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type RetireDocumentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
};

export type RetireAllDocumentsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type MoveDocumentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly direction: "earlier" | "later";
};

export type CreateDocumentFolderCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly parentFolderId: EntityId<"DocumentFolder"> | null;
};

export type RenameDocumentFolderCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly folderId: EntityId<"DocumentFolder">;
  readonly title: string;
};

export type PlaceDocumentInFolderCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly folderId: EntityId<"DocumentFolder"> | null;
};

export type RetireDocumentFolderCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly folderId: EntityId<"DocumentFolder">;
};

export type RenameDocumentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly title: string;
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

function readDocumentTitle(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value.trim() || UNTITLED_DOCUMENT_TITLE;
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

function readNullableIdentity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> | null {
  return value === null ? null : readIdentity<TEntity>(value, label);
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
    firstDocumentTitle: readDocumentTitle(
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
    title: readDocumentTitle(
      input.title,
      "CreateDocumentCommand.title",
    ),
  });
}

export function parseRenameWorkCommand(
  value: unknown,
): RenameWorkCommand {
  const input = readRecord(value, "RenameWorkCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "title"],
    "RenameWorkCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("RenameWorkCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "RenameWorkCommand.workId",
    ),
    title: readNonEmptyTrimmedText(
      input.title,
      "RenameWorkCommand.title",
    ),
  });
}

export function parseRenameDocumentCommand(
  value: unknown,
): RenameDocumentCommand {
  const input = readRecord(value, "RenameDocumentCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "documentId", "title"],
    "RenameDocumentCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("RenameDocumentCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "RenameDocumentCommand.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "RenameDocumentCommand.documentId",
    ),
    title: readNonEmptyTrimmedText(
      input.title,
      "RenameDocumentCommand.title",
    ),
  });
}

export function parseRetireWorkCommand(
  value: unknown,
): RetireWorkCommand {
  const input = readRecord(value, "RetireWorkCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId"],
    "RetireWorkCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("RetireWorkCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "RetireWorkCommand.workId",
    ),
  });
}

export function parseRetireDocumentCommand(
  value: unknown,
): RetireDocumentCommand {
  const input = readRecord(value, "RetireDocumentCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "documentId"],
    "RetireDocumentCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("RetireDocumentCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "RetireDocumentCommand.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "RetireDocumentCommand.documentId",
    ),
  });
}

export function parseRetireAllDocumentsCommand(
  value: unknown,
): RetireAllDocumentsCommand {
  const input = readRecord(value, "RetireAllDocumentsCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId"],
    "RetireAllDocumentsCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("RetireAllDocumentsCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "RetireAllDocumentsCommand.workId",
    ),
  });
}

export function parseMoveDocumentCommand(
  value: unknown,
): MoveDocumentCommand {
  const input = readRecord(value, "MoveDocumentCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "documentId", "direction"],
    "MoveDocumentCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("MoveDocumentCommand.schemaVersion must be 1");
  }
  if (input.direction !== "earlier" && input.direction !== "later") {
    throw new Error(
      "MoveDocumentCommand.direction must be earlier or later",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "MoveDocumentCommand.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "MoveDocumentCommand.documentId",
    ),
    direction: input.direction,
  });
}

export function parseCreateDocumentFolderCommand(
  value: unknown,
): CreateDocumentFolderCommand {
  const input = readRecord(value, "CreateDocumentFolderCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "title", "parentFolderId"],
    "CreateDocumentFolderCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("CreateDocumentFolderCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "CreateDocumentFolderCommand.workId",
    ),
    title: readNonEmptyTrimmedText(
      input.title,
      "CreateDocumentFolderCommand.title",
    ),
    parentFolderId: readNullableIdentity<"DocumentFolder">(
      input.parentFolderId,
      "CreateDocumentFolderCommand.parentFolderId",
    ),
  });
}

export function parseRenameDocumentFolderCommand(
  value: unknown,
): RenameDocumentFolderCommand {
  const input = readRecord(value, "RenameDocumentFolderCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "folderId", "title"],
    "RenameDocumentFolderCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("RenameDocumentFolderCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "RenameDocumentFolderCommand.workId",
    ),
    folderId: readIdentity<"DocumentFolder">(
      input.folderId,
      "RenameDocumentFolderCommand.folderId",
    ),
    title: readNonEmptyTrimmedText(
      input.title,
      "RenameDocumentFolderCommand.title",
    ),
  });
}

export function parsePlaceDocumentInFolderCommand(
  value: unknown,
): PlaceDocumentInFolderCommand {
  const input = readRecord(value, "PlaceDocumentInFolderCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "documentId", "folderId"],
    "PlaceDocumentInFolderCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("PlaceDocumentInFolderCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "PlaceDocumentInFolderCommand.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "PlaceDocumentInFolderCommand.documentId",
    ),
    folderId: readNullableIdentity<"DocumentFolder">(
      input.folderId,
      "PlaceDocumentInFolderCommand.folderId",
    ),
  });
}

export function parseRetireDocumentFolderCommand(
  value: unknown,
): RetireDocumentFolderCommand {
  const input = readRecord(value, "RetireDocumentFolderCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "folderId"],
    "RetireDocumentFolderCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("RetireDocumentFolderCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "RetireDocumentFolderCommand.workId",
    ),
    folderId: readIdentity<"DocumentFolder">(
      input.folderId,
      "RetireDocumentFolderCommand.folderId",
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
  const folderIds = new Set<EntityId<"DocumentFolder">>();
  const documentIds = new Set<EntityId<"Document">>();
  const works = input.works.map((candidate, workIndex) => {
    const work = readRecord(
      candidate,
      `WorkspaceCatalogProjection.works[${workIndex}]`,
    );
    assertOnlyFields(
      work,
      ["workId", "title", "updatedAt", "folders", "documents"],
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
    if (!Array.isArray(work.folders)) {
      throw new Error(
        `WorkspaceCatalogProjection.works[${workIndex}].folders must be an array`,
      );
    }
    const workFolderIds = new Set<EntityId<"DocumentFolder">>();
    const folders = work.folders.map((candidate, folderIndex) => {
      const folder = readRecord(
        candidate,
        `WorkspaceCatalogProjection.works[${workIndex}].folders[${folderIndex}]`,
      );
      assertOnlyFields(
        folder,
        ["folderId", "title", "parentFolderId"],
        `WorkspaceCatalogProjection.works[${workIndex}].folders[${folderIndex}]`,
      );
      const folderId = readIdentity<"DocumentFolder">(
        folder.folderId,
        `WorkspaceCatalogProjection.works[${workIndex}].folders[${folderIndex}].folderId`,
      );
      if (folderIds.has(folderId)) {
        throw new Error(`Duplicate workspace folder identity: ${folderId}`);
      }
      folderIds.add(folderId);
      workFolderIds.add(folderId);
      return Object.freeze({
        folderId,
        title: readNonEmptyTrimmedText(
          folder.title,
          `WorkspaceCatalogProjection.works[${workIndex}].folders[${folderIndex}].title`,
        ),
        parentFolderId: readNullableIdentity<"DocumentFolder">(
          folder.parentFolderId,
          `WorkspaceCatalogProjection.works[${workIndex}].folders[${folderIndex}].parentFolderId`,
        ),
      });
    });
    const foldersById = new Map(
      folders.map((folder) => [folder.folderId, folder] as const),
    );
    for (const folder of folders) {
      if (
        folder.parentFolderId !== null &&
        !workFolderIds.has(folder.parentFolderId)
      ) {
        throw new Error(
          `Workspace folder parent must belong to the same Work: ${folder.folderId}`,
        );
      }
      const visited = new Set<EntityId<"DocumentFolder">>();
      let current: WorkspaceDocumentFolderSummary | undefined = folder;
      while (current !== undefined && current.parentFolderId !== null) {
        if (visited.has(current.folderId)) {
          throw new Error(`Workspace folder cycle: ${folder.folderId}`);
        }
        visited.add(current.folderId);
        current = foldersById.get(current.parentFolderId);
      }
    }
    if (!Array.isArray(work.documents)) {
      throw new Error(
        `WorkspaceCatalogProjection.works[${workIndex}].documents must be an array`,
      );
    }
    const documents = work.documents.map((candidate, documentIndex) => {
      const document = readRecord(
        candidate,
        `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}]`,
      );
      assertOnlyFields(
        document,
        ["documentId", "title", "currentRevisionId", "folderId", "completion"],
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
      const folderId = readNullableIdentity<"DocumentFolder">(
        document.folderId,
        `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}].folderId`,
      );
      if (folderId !== null && !workFolderIds.has(folderId)) {
        throw new Error(
          `Workspace Document folder must belong to the same Work: ${documentId}`,
        );
      }
      const currentRevisionId = readIdentity<"DocumentRevision">(
        document.currentRevisionId,
        `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}].currentRevisionId`,
      );
      const completion = parseDocumentCompletionProjection(
        document.completion ?? {
          schemaVersion: 1,
          workId,
          documentId,
          revision: 0,
          completedAt: null,
          completedDate: null,
          completedTimeZone: null,
          completedDocumentRevisionId: null,
          state: "incomplete",
          updatedAt: null,
        },
      );
      if (completion.workId !== workId || completion.documentId !== documentId) {
        throw new Error(
          `Workspace completion must belong to its Work and Document: ${documentId}`,
        );
      }
      const expectedState = completion.completedDocumentRevisionId === null
        ? "incomplete"
        : completion.completedDocumentRevisionId === currentRevisionId
          ? "current"
          : "edited-after-completion";
      if (completion.state !== expectedState) {
        throw new Error(
          `Workspace completion state does not match the current revision: ${documentId}`,
        );
      }
      return Object.freeze({
        documentId,
        title: readNonEmptyTrimmedText(
          document.title,
          `WorkspaceCatalogProjection.works[${workIndex}].documents[${documentIndex}].title`,
        ),
        currentRevisionId,
        folderId,
        completion,
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
      folders: Object.freeze(folders),
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
  if (works.length === 0) {
    if (activeWorkId !== null || activeDocumentId !== null) {
      throw new Error("An empty workspace catalog cannot have active identities");
    }
  } else {
    if (activeWorkId === null) {
      throw new Error("A non-empty workspace catalog must have an active Work");
    }
    const activeWork = works.find((work) => work.workId === activeWorkId);
    if (activeWork === undefined) {
      throw new Error("Workspace catalog active Work must be registered");
    }
    if (activeDocumentId === null) {
      if (activeWork.documents.length !== 0) {
        throw new Error(
          "Only an empty active Work can have no active Document",
        );
      }
    } else if (
      !activeWork.documents.some(
        (document) => document.documentId === activeDocumentId,
      )
    ) {
      throw new Error(
        "Workspace catalog active identities must share one registered Work",
      );
    }
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
