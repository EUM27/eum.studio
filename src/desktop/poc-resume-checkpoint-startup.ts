import {
  ResolveResumeCheckpointForWork,
  ResumeAnchorIntegrityError,
} from "../application/checkpoints/resolve-resume-checkpoint-for-work";
import type {
  ManuscriptResumeCheckpointProjection,
  ManuscriptResumeInvalidReason,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import type {
  ResumeCheckpointReader,
  ResumeCheckpointResolution,
} from "../application/checkpoints/resolve-resume-checkpoint-for-work";
import type {
  ManuscriptDocumentProfile,
} from "../application/editor/manuscript-document-profile";
import type {
  RevisionReader,
} from "../application/revisions/revision-store";
import {
  createWritingCatalog,
  type DocumentRevision,
  type EntityId,
} from "../domain/writing";
import {
  createNodeCryptoAnchorEvidenceDescriptor,
} from "../platform/anchors/node-crypto-anchor-evidence";
import {
  resolvePocResumeCheckpointPublication,
  type PocResumeCheckpointState,
} from "../platform/checkpoints/poc-resume-checkpoint-publication";
import {
  createJsonPocResumeCheckpointPublicationCodec,
} from "../platform/checkpoints/poc-resume-checkpoint-json-codec";
import {
  createNodeCryptoJournalChecksumAdapter,
} from "../platform/journal/node-crypto-journal-checksum";
import type {
  PocResumeCheckpointRuntimeProfile,
} from "./poc-resume-checkpoint-runtime-profile";

function createRevisionReader(input: {
  readonly profile:
    PocResumeCheckpointRuntimeProfile;
  readonly currentRevisionIds:
    ReadonlyMap<
      EntityId<"Document">,
      EntityId<"DocumentRevision">
    >;
  readonly expectedCurrentContent?:
    ReadonlyMap<
      EntityId<"Document">,
      string
    >;
}): RevisionReader {
  const sourcesByRevision = new Map<
    EntityId<"DocumentRevision">,
    {
      readonly revision: DocumentRevision;
      readonly content: string;
    }
  >(
    input.profile.revisions.map((source) => [
      source.revision.id,
      source,
    ]),
  );
  return {
    async getCurrentRevision(documentId) {
      const revisionId =
        input.currentRevisionIds.get(
          documentId,
        );
      if (revisionId === undefined) {
        return null;
      }
      const source =
        sourcesByRevision.get(revisionId);
      if (
        source === undefined ||
        source.revision.documentId !==
          documentId ||
        (input.expectedCurrentContent !==
          undefined &&
          input.expectedCurrentContent.get(
            documentId,
          ) !== source.content)
      ) {
        return null;
      }
      return source.revision;
    },
    async getRevision(revisionId) {
      return (
        sourcesByRevision.get(revisionId)
          ?.revision ?? null
      );
    },
    async materialize(revisionId) {
      const source =
        sourcesByRevision.get(revisionId);
      if (source === undefined) {
        throw new Error(
          `Missing checkpoint revision source: ${revisionId}`,
        );
      }
      return source.content;
    },
  };
}

function initialWorkId(
  documentProfile:
    ManuscriptDocumentProfile,
): EntityId<"Work"> {
  const initial =
    documentProfile.documents.find(
      (document) =>
        document.documentId ===
        documentProfile.initialDocumentId,
    );
  if (initial === undefined) {
    throw new Error(
      "Initial checkpoint document is not registered",
    );
  }
  return initial.workId;
}

function invalidProjection(
  workId: EntityId<"Work">,
  reason: ManuscriptResumeInvalidReason,
): ManuscriptResumeCheckpointProjection {
  return Object.freeze({
    schemaVersion: 1,
    status: "invalid",
    workId,
    reason,
    move: null,
  });
}

function createStateReader(
  state: PocResumeCheckpointState,
): ResumeCheckpointReader {
  const works = new Map(
    state.works.map((work) => [
      work.meta.id,
      work,
    ]),
  );
  const checkpoints = new Map(
    state.checkpoints.map((checkpoint) => [
      checkpoint.meta.id,
      checkpoint,
    ]),
  );
  const anchors = new Map(
    state.anchors.map((anchor) => [
      anchor.meta.id,
      anchor,
    ]),
  );
  return {
    async getWork(workId) {
      return works.get(workId) ?? null;
    },
    async getCheckpointById(checkpointId) {
      return (
        checkpoints.get(checkpointId) ??
        null
      );
    },
    async getAnchorById(anchorId) {
      return anchors.get(anchorId) ?? null;
    },
  };
}

function projectionFromResolution(
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
      targetRevisionId:
        resolution.targetRevisionId,
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
      targetRevisionId:
        resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: resolution.cursorOffset,
        head: resolution.cursorOffset,
      }),
    });
  }
  if (
    resolution.cursorOffset ===
    selection.startOffset
  ) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId:
        resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: selection.endOffset,
        head: selection.startOffset,
      }),
    });
  }
  if (
    resolution.cursorOffset ===
    selection.endOffset
  ) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId:
        resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: selection.startOffset,
        head: selection.endOffset,
      }),
    });
  }
  return invalidProjection(
    resolution.workId,
    "selection-shape-conflict",
  );
}

export async function resolvePocResumeCheckpointStartup(
  input: {
    readonly documentProfile:
      ManuscriptDocumentProfile;
    readonly runtimeProfile:
      PocResumeCheckpointRuntimeProfile;
  },
): Promise<ManuscriptResumeCheckpointProjection> {
  const workId = initialWorkId(
    input.documentProfile,
  );
  const profileWork =
    input.runtimeProfile.works.find(
      (work) => work.meta.id === workId,
    );
  const profileDocuments = new Map(
    input.runtimeProfile.documents.map(
      (document) => [
        document.meta.id,
        document,
      ],
    ),
  );
  if (
    profileWork === undefined ||
    input.documentProfile.documents.some(
      (document) =>
        profileDocuments.get(
          document.documentId,
        )?.workId !== document.workId,
    )
  ) {
    return invalidProjection(
      workId,
      "ownership-conflict",
    );
  }
  const publicationRevisionIds = new Map(
    input.runtimeProfile
      .publicationRevisionHeads.map(
        (head) => [
          head.documentId,
          head.revisionId,
        ],
      ),
  );
  const publicationReader =
    createRevisionReader({
      profile: input.runtimeProfile,
      currentRevisionIds:
        publicationRevisionIds,
    });
  const publication =
    await resolvePocResumeCheckpointPublication({
      works: input.runtimeProfile.works,
      checkpoints:
        input.runtimeProfile
          .baselineCheckpoints,
      anchors:
        input.runtimeProfile.anchors,
      revisionStore: publicationReader,
      storagePlan:
        input.runtimeProfile.storagePlan,
      codec:
        createJsonPocResumeCheckpointPublicationCodec(
          input.runtimeProfile.codecId,
        ),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          input.runtimeProfile
            .publicationChecksumAlgorithm,
        ),
    });
  if (publication.status === "invalid") {
    return invalidProjection(
      workId,
      publication.reason,
    );
  }

  const currentRevisionIds = new Map<
    EntityId<"Document">,
    EntityId<"DocumentRevision">
  >();
  const currentContent = new Map<
    EntityId<"Document">,
    string
  >();
  for (
    const document of input.documentProfile
      .documents
  ) {
    if (document.documentRevisionId === null) {
      return invalidProjection(
        workId,
        "revision-source-conflict",
      );
    }
    currentRevisionIds.set(
      document.documentId,
      document.documentRevisionId,
    );
    currentContent.set(
      document.documentId,
      document.initialText,
    );
  }
  const targetRevisionReader =
    createRevisionReader({
      profile: input.runtimeProfile,
      currentRevisionIds,
      expectedCurrentContent: currentContent,
    });
  const reader = createStateReader(
    publication.state,
  );
  let catalog;
  try {
    catalog = createWritingCatalog({
      works: publication.state.works,
      documents:
        input.runtimeProfile.documents,
    });
  } catch {
    return invalidProjection(
      workId,
      "ownership-conflict",
    );
  }
  try {
    const resolution =
      await new ResolveResumeCheckpointForWork({
        catalog,
        revisionStore:
          targetRevisionReader,
        reader,
        describeEvidence:
          createNodeCryptoAnchorEvidenceDescriptor(
            input.runtimeProfile
              .anchorEvidenceChecksumAlgorithm,
          ),
      }).execute(workId);
    return projectionFromResolution(
      resolution,
    );
  } catch (error) {
    if (
      error instanceof
      ResumeAnchorIntegrityError
    ) {
      return invalidProjection(
        workId,
        "anchor-integrity-conflict",
      );
    }
    throw error;
  }
}
