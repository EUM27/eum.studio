import type { ResumeCheckpointWithAnchorsCaptureTransaction } from "../../application/checkpoints/capture-resume-checkpoint-with-anchors";
import type { ManuscriptResumeCheckpointProjection } from "../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { ResumeCheckpointResolution } from "../../application/checkpoints/resolve-resume-checkpoint-for-work";
import { ResolveResumeCheckpointForWork,ResumeAnchorIntegrityError } from "../../application/checkpoints/resolve-resume-checkpoint-for-work";
import type { ManuscriptDocumentProfile } from "../../application/editor/manuscript-document-profile";
import { parseManuscriptDocumentProfile } from "../../application/editor/manuscript-document-profile";
import type { RevisionStore } from "../../application/revisions/revision-store";
import type { DocumentCompletionProjection } from "../../application/workspace/document-completion";
import { parseDocumentCompletionProjection } from "../../application/workspace/document-completion";
import type { ActivateWorkspaceLocationCommand,WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import { parseWorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../platform/anchors/node-crypto-anchor-evidence";
import { readRevisionEditorStateJson } from "./repositories/revisions";
import { createCatalogFromStoredRows,readStoredDocumentFolderRows,readStoredDocumentRows,readStoredWorkRows } from "./repositories/workspace";
import type { MutableDocumentSaveTarget } from "./state-contracts";
import type { NodeSqliteDatabase } from "./storage-contracts";

export function projectResumeResolution(
  resolution: ResumeCheckpointResolution,
): ManuscriptResumeCheckpointProjection {
  if (resolution.status === "missing") {
    return Object.freeze({
      schemaVersion: 1,
      status: "missing",
      workId: resolution.workId,
    });
  }
  if (
    resolution.status === "needsReview" ||
    resolution.status === "broken"
  ) {
    return Object.freeze({
      schemaVersion: 1,
      status: resolution.status,
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      move: null,
    });
  }
  const selection = resolution.selection;
  if (selection === undefined) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: resolution.cursorOffset,
        head: resolution.cursorOffset,
      }),
    });
  }
  if (resolution.cursorOffset === selection.startOffset) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: selection.endOffset,
        head: selection.startOffset,
      }),
    });
  }
  if (resolution.cursorOffset === selection.endOffset) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: selection.startOffset,
        head: selection.endOffset,
      }),
    });
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "invalid",
    workId: resolution.workId,
    reason: "selection-shape-conflict",
    move: null,
  });
}

export async function loadWorkspaceState(
  database: NodeSqliteDatabase,
  revisionStore: RevisionStore,
  emptyDocumentProfile: ManuscriptDocumentProfile,
  resumeReader: ResumeCheckpointWithAnchorsCaptureTransaction,
  anchorEvidenceChecksumAlgorithm: string,
  preferredLocation?: ActivateWorkspaceLocationCommand,
): Promise<{
  readonly catalog: WorkspaceCatalogProjection;
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly resumeProjection: ManuscriptResumeCheckpointProjection;
  readonly documentTargets:
    readonly MutableDocumentSaveTarget[];
}> {
  const workRows = readStoredWorkRows(database);
  const folderRows = readStoredDocumentFolderRows(database);
  const rows = readStoredDocumentRows(database);
  if (workRows.length === 0) {
    return Object.freeze({
      catalog: parseWorkspaceCatalogProjection({
        schemaVersion: 1,
        works: [],
        activeWorkId: null,
        activeDocumentId: null,
        canCreateFirstWork: true,
      }),
      documentProfile: emptyDocumentProfile,
      resumeProjection: Object.freeze({
        schemaVersion: 1,
        status: "unavailable",
      }),
      documentTargets: Object.freeze([]),
    });
  }
  const materialized = await Promise.all(
    rows.map(async (row) => ({
      row,
      text: await revisionStore.materialize(row.currentRevisionId),
      editorStateJson: readRevisionEditorStateJson(database, {
        revisionId: row.currentRevisionId,
        workId: row.workId,
        documentId: row.documentId,
      }),
    })),
  );
  const worksById = new Map<
    EntityId<"Work">,
    {
      readonly workId: EntityId<"Work">;
      readonly title: string;
      readonly updatedAt: string;
      readonly folders: Array<{
        readonly folderId: EntityId<"DocumentFolder">;
        readonly title: string;
        readonly parentFolderId: EntityId<"DocumentFolder"> | null;
      }>;
      readonly documents: Array<{
        readonly documentId: EntityId<"Document">;
        readonly title: string;
        readonly currentRevisionId:
          EntityId<"DocumentRevision">;
        readonly folderId: EntityId<"DocumentFolder"> | null;
        readonly completion: DocumentCompletionProjection;
      }>;
    }
  >();
  for (const row of workRows) {
    worksById.set(row.workId, {
      workId: row.workId,
      title: row.workTitle,
      updatedAt: row.workUpdatedAt,
      folders: [],
      documents: [],
    });
  }
  for (const folder of folderRows) {
    const work = worksById.get(folder.workId);
    if (work === undefined) {
      throw new Error(`Document folder belongs to an unavailable Work: ${folder.workId}`);
    }
    work.folders.push({
      folderId: folder.folderId,
      title: folder.title,
      parentFolderId: folder.parentFolderId,
    });
  }
  for (const { row } of materialized) {
    const work = worksById.get(row.workId);
    if (work === undefined) {
      throw new Error(`Document belongs to an unavailable Work: ${row.workId}`);
    }
    work.documents.push({
      documentId: row.documentId,
      title: row.documentTitle,
      currentRevisionId: row.currentRevisionId,
      folderId: row.folderId,
      completion: parseDocumentCompletionProjection({
        schemaVersion: 1,
        workId: row.workId,
        documentId: row.documentId,
        revision: row.completionRevision ?? 0,
        completedAt: row.completionCompletedAt,
        completedDate: row.completionCompletedDate,
        completedTimeZone: row.completionCompletedTimeZone,
        completedDocumentRevisionId: row.completionDocumentRevisionId,
        state: row.completionDocumentRevisionId === null
          ? "incomplete"
          : row.completionDocumentRevisionId === row.currentRevisionId
            ? "current"
            : "edited-after-completion",
        updatedAt: row.completionUpdatedAt,
      }),
    });
  }
  const works = [...worksById.values()];
  const activeWork =
    preferredLocation === undefined
      ? works[0]
      : works.find((work) => work.workId === preferredLocation.workId);
  if (preferredLocation !== undefined && activeWork === undefined) {
    throw new Error(`Unknown workspace Work: ${preferredLocation.workId}`);
  }
  if (activeWork === undefined) {
    throw new Error("Stored workspace has no active Work");
  }
  const writingCatalog = createCatalogFromStoredRows(rows);
  let resumeProjection: ManuscriptResumeCheckpointProjection;
  if (activeWork.documents.length === 0) {
    resumeProjection = Object.freeze({
      schemaVersion: 1,
      status: "unavailable",
    });
  } else {
    try {
      resumeProjection = projectResumeResolution(
        await new ResolveResumeCheckpointForWork({
          catalog: writingCatalog,
          revisionStore,
          reader: resumeReader,
          describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
            anchorEvidenceChecksumAlgorithm,
          ),
        }).execute(activeWork.workId),
      );
    } catch (error) {
      if (!(error instanceof ResumeAnchorIntegrityError)) {
        throw error;
      }
      resumeProjection = Object.freeze({
        schemaVersion: 1,
        status: "invalid",
        workId: activeWork.workId,
        reason: "anchor-integrity-conflict",
        move: null,
      });
    }
  }
  const explicitDocument =
    preferredLocation?.documentId === null ||
    preferredLocation?.documentId === undefined
      ? undefined
      : activeWork.documents.find(
          (document) =>
            document.documentId === preferredLocation.documentId,
        );
  if (
    preferredLocation?.documentId !== null &&
    preferredLocation?.documentId !== undefined &&
    explicitDocument === undefined
  ) {
    throw new Error(
      `Work/document boundary violation: ${preferredLocation.workId}/${preferredLocation.documentId}`,
    );
  }
  const resumeDocument =
    resumeProjection.status === "resolved" ||
    resumeProjection.status === "needsReview" ||
    resumeProjection.status === "broken"
      ? activeWork.documents.find(
          (document) =>
            document.documentId === resumeProjection.documentId,
        )
      : undefined;
  const activeDocument =
    explicitDocument ??
    resumeDocument ??
    activeWork.documents[0];
  const catalog = parseWorkspaceCatalogProjection({
    schemaVersion: 1,
    works,
    activeWorkId: activeWork.workId,
    activeDocumentId: activeDocument?.documentId ?? null,
    canCreateFirstWork: false,
  });
  const firstMaterializedDocument = materialized[0];
  const documentProfile =
    firstMaterializedDocument === undefined
      ? emptyDocumentProfile
      : parseManuscriptDocumentProfile({
          schemaVersion: 1,
          initialDocumentId:
            activeDocument?.documentId ??
            firstMaterializedDocument.row.documentId,
          documents: materialized.map(({ row, text, editorStateJson }) => ({
            workId: row.workId,
            documentId: row.documentId,
            documentRevisionId: row.currentRevisionId,
            label: row.documentTitle,
            initialText: text,
            ...(editorStateJson === undefined ? {} : { editorStateJson }),
          })),
        });
  return Object.freeze({
    catalog,
    documentProfile,
    resumeProjection,
    documentTargets: Object.freeze(
      materialized.map(({ row, text }) => ({
        workId: row.workId,
        documentId: row.documentId,
        baseRevisionId: row.currentRevisionId,
        currentRevisionId: row.currentRevisionId,
        nextSequence: 0,
        text,
      })),
    ),
  });
}

