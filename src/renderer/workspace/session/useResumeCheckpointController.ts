import { useCallback } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { ManuscriptResumeCheckpointProjection } from "../../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { ManuscriptDocumentStateSummary } from "../../editor/ManuscriptEditor";

export function useResumeCheckpointController(input: Readonly<{
  client: Pick<StudioBridge["workspace"], "captureResume" | "getCatalog">;
  readDocumentState: (
    document: ManuscriptDocumentSource,
  ) => ManuscriptDocumentStateSummary | null | undefined;
  resumeCheckpoint: ManuscriptResumeCheckpointProjection | null;
}>) {
  const captureResume = useCallback(async (
    document: ManuscriptDocumentSource,
    summary?: ManuscriptDocumentStateSummary,
  ) => {
    if (input.resumeCheckpoint?.status === "unavailable") {
      return input.resumeCheckpoint;
    }
    const documentState = summary ?? input.readDocumentState(document);
    if (documentState === null || documentState === undefined) {
      throw new Error(
        `The active editor state is unavailable for ${document.documentId}`,
      );
    }
    const selection =
      documentState.selection.ranges[documentState.selection.mainIndex];
    if (selection === undefined) {
      throw new Error(
        `The active editor selection is unavailable for ${document.documentId}`,
      );
    }
    if (
      input.resumeCheckpoint?.status === "resolved" &&
      input.resumeCheckpoint.workId === document.workId &&
      input.resumeCheckpoint.documentId === document.documentId &&
      input.resumeCheckpoint.targetRevisionId === document.documentRevisionId &&
      input.resumeCheckpoint.selection.anchor === selection.anchor &&
      input.resumeCheckpoint.selection.head === selection.head
    ) {
      return input.resumeCheckpoint;
    }
    return input.client.captureResume({
      schemaVersion: 1,
      workId: document.workId,
      documentId: document.documentId,
      selection: { anchor: selection.anchor, head: selection.head },
      workspaceMode: "writing",
    });
  }, [input]);
  const captureResumeAndLoadCatalog = useCallback(async (
    document: ManuscriptDocumentSource,
    summary?: ManuscriptDocumentStateSummary,
  ) => {
    await captureResume(document, summary);
    return input.client.getCatalog();
  }, [captureResume, input.client]);

  return { captureResume, captureResumeAndLoadCatalog };
}
