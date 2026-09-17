import { useCallback, useLayoutEffect, useRef } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { ManuscriptResumeCheckpointProjection } from "../../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { EntityId } from "../../../domain/writing";
import type { ManuscriptDocumentStateSummary } from "../../editor/ManuscriptEditor";

export async function captureResumeWithCache(input: Readonly<{
  client: Pick<StudioBridge["workspace"], "captureResume">;
  currentCheckpoint: () => ManuscriptResumeCheckpointProjection | null;
  document: ManuscriptDocumentSource;
  getCurrentRevisionId: (
    documentId: ManuscriptDocumentSource["documentId"],
  ) => EntityId<"DocumentRevision"> | null;
  installCheckpoint: (
    checkpoint: ManuscriptResumeCheckpointProjection,
  ) => void;
  readDocumentState: (
    document: ManuscriptDocumentSource,
  ) => ManuscriptDocumentStateSummary | null | undefined;
  summary?: ManuscriptDocumentStateSummary;
}>): Promise<ManuscriptResumeCheckpointProjection> {
  const currentCheckpoint = input.currentCheckpoint();
  if (currentCheckpoint?.status === "unavailable") {
    return currentCheckpoint;
  }
  const documentState = input.summary ?? input.readDocumentState(input.document);
  if (documentState === null || documentState === undefined) {
    throw new Error(
      `The active editor state is unavailable for ${input.document.documentId}`,
    );
  }
  const selection =
    documentState.selection.ranges[documentState.selection.mainIndex];
  if (selection === undefined) {
    throw new Error(
      `The active editor selection is unavailable for ${input.document.documentId}`,
    );
  }
  const currentRevisionId =
    input.getCurrentRevisionId(input.document.documentId) ??
    input.document.documentRevisionId;
  if (
    currentCheckpoint?.status === "resolved" &&
    currentCheckpoint.workId === input.document.workId &&
    currentCheckpoint.documentId === input.document.documentId &&
    currentCheckpoint.targetRevisionId === currentRevisionId &&
    currentCheckpoint.selection.anchor === selection.anchor &&
    currentCheckpoint.selection.head === selection.head
  ) {
    return currentCheckpoint;
  }
  const checkpoint = await input.client.captureResume({
    schemaVersion: 1,
    workId: input.document.workId,
    documentId: input.document.documentId,
    selection: { anchor: selection.anchor, head: selection.head },
    workspaceMode: "writing",
  });
  input.installCheckpoint(checkpoint);
  return checkpoint;
}

export function useResumeCheckpointController(input: Readonly<{
  client: Pick<StudioBridge["workspace"], "captureResume" | "getCatalog">;
  getCurrentRevisionId: (
    documentId: ManuscriptDocumentSource["documentId"],
  ) => EntityId<"DocumentRevision"> | null;
  readDocumentState: (
    document: ManuscriptDocumentSource,
  ) => ManuscriptDocumentStateSummary | null | undefined;
  resumeCheckpoint: ManuscriptResumeCheckpointProjection | null;
}>) {
  const resumeCheckpointRef = useRef(input.resumeCheckpoint);
  useLayoutEffect(() => {
    resumeCheckpointRef.current = input.resumeCheckpoint;
  }, [input.resumeCheckpoint]);
  const captureResume = useCallback(async (
    document: ManuscriptDocumentSource,
    summary?: ManuscriptDocumentStateSummary,
  ) => captureResumeWithCache({
    client: input.client,
    currentCheckpoint: () => resumeCheckpointRef.current,
    document,
    getCurrentRevisionId: input.getCurrentRevisionId,
    installCheckpoint: (checkpoint) => {
      resumeCheckpointRef.current = checkpoint;
    },
    readDocumentState: input.readDocumentState,
    ...(summary === undefined ? {} : { summary }),
  }), [input.client, input.getCurrentRevisionId, input.readDocumentState]);
  const captureResumeAndLoadCatalog = useCallback(async (
    document: ManuscriptDocumentSource,
    summary?: ManuscriptDocumentStateSummary,
  ) => {
    await captureResume(document, summary);
    return input.client.getCatalog();
  }, [captureResume, input.client]);

  return { captureResume, captureResumeAndLoadCatalog };
}
