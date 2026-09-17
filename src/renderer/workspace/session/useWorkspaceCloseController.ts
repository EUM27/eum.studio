import { useEffect } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { WritingSessionProjection } from "../../../application/activity/work-activity-contract";
import type { EntityId } from "../../../domain/writing";
import type { ManuscriptDurableSaveQueue } from "../../persistence/manuscript-durable-save-queue";
import { coordinateWorkspaceCloseRequest } from "../lifecycle/WorkspaceLifecycleCoordinator";

export function useWorkspaceCloseController(input: Readonly<{
  activityClient: Pick<StudioBridge["activity"], "stopSession">;
  activeWritingSessionRef: {
    current: WritingSessionProjection | undefined;
  };
  captureResume: (
    document: ManuscriptDocumentSource,
  ) => Promise<unknown>;
  editorClient: Pick<
    StudioBridge["editor"],
    "onManuscriptCloseRequest" | "completeManuscriptCloseRequest"
  >;
  manuscriptFocusOwnedWritingSessionIdRef: {
    current: EntityId<"WritingSession"> | null;
  };
  manuscriptFocusSessionPendingRef: { current: Promise<void> };
  getQueue: () => ManuscriptDurableSaveQueue | null;
  runtime: Readonly<{
    activeDocumentId: EntityId<"Document"> | null;
    documents: readonly ManuscriptDocumentSource[];
  }> | null;
  waitForContinuousReading: () => Promise<void>;
  waitForWorkLayout: () => Promise<void>;
}>) {
  useEffect(
    () => input.editorClient.onManuscriptCloseRequest((request) => {
      const queue = input.getQueue();
      const documents = input.runtime?.documents ?? [];
      const activeDocument = input.runtime === null
        ? undefined
        : input.runtime.documents.find(
            (document) =>
              document.documentId === input.runtime?.activeDocumentId,
          );
      void coordinateWorkspaceCloseRequest({
        requestId: request.requestId,
        queue,
        documents,
        activeDocument,
        ports: {
          waitForContinuousReading: input.waitForContinuousReading,
          waitForWorkLayout: input.waitForWorkLayout,
          waitForManuscriptFocusSession: () => input.manuscriptFocusSessionPendingRef.current,
          stopOwnedManuscriptFocusSession: async (document) => {
            const manuscriptFocusSession = input.activeWritingSessionRef.current;
            const manuscriptFocusSessionId =
              input.manuscriptFocusOwnedWritingSessionIdRef.current;
            if (
              document !== undefined &&
              manuscriptFocusSession !== undefined &&
              manuscriptFocusSession.sessionId === manuscriptFocusSessionId
            ) {
              const projection = await input.activityClient.stopSession({
                schemaVersion: 1,
                workId: document.workId,
                sessionId: manuscriptFocusSession.sessionId,
              });
              input.activeWritingSessionRef.current = projection.sessions.find(
                (session) => session.sessionId === projection.activeSessionId,
              );
              input.manuscriptFocusOwnedWritingSessionIdRef.current = null;
            }
          },
          captureResume: input.captureResume,
          completeRequest: (requestId, status) =>
            input.editorClient.completeManuscriptCloseRequest({
              schemaVersion: 1,
              requestId,
              status,
            }),
        },
      });
    }),
    [input],
  );
}
