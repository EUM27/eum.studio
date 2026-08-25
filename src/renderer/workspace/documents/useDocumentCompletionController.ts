import { useCallback } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  WorkspaceCatalogProjection,
  WorkspaceDocumentSummary,
} from "../../../application/workspace/workspace-contract";
import type { EntityId } from "../../../domain/writing";

export function useDocumentCompletionController(input: Readonly<{
  action: Readonly<{
    state: string;
    setError: (error: string | null) => void;
    setState: (state: "idle" | "setting-document-completion") => void;
  }>;
  beforeFlush: () => Promise<void>;
  client: Pick<
    StudioBridge["workspace"],
    "completeDocument" | "clearDocumentCompletion" | "getCatalog"
  >;
  document: ManuscriptDocumentSource | null;
  getQueue: () => Readonly<{
    flushForClose: (documentId: EntityId<"Document">) => Promise<unknown>;
    getCurrentRevisionId: (
      documentId: EntityId<"Document">,
    ) => EntityId<"DocumentRevision">;
  }> | null;
  installCatalog: (catalog: WorkspaceCatalogProjection) => void;
  loadRevisionPreview: (
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
    documentTitle: string,
  ) => Promise<unknown>;
  onScheduleChange?: () => void;
  ready: boolean;
  summary: WorkspaceDocumentSummary | null;
}>) {
  const refreshCatalogAfterDocumentCompletion = useCallback(async () => {
    const catalog = await input.client.getCatalog();
    input.installCatalog(catalog);
    input.onScheduleChange?.();
  }, [input]);

  const completeActiveDocument = useCallback(async () => {
    if (
      !input.ready ||
      input.document === null ||
      input.summary === null ||
      input.action.state !== "idle"
    ) return;
    input.action.setState("setting-document-completion");
    input.action.setError(null);
    try {
      await input.beforeFlush();
      const queue = input.getQueue();
      if (queue === null) {
        throw new Error("원고 저장 대기열을 찾지 못했습니다.");
      }
      await queue.flushForClose(input.document.documentId);
      const durableRevisionId = queue.getCurrentRevisionId(
        input.document.documentId,
      );
      await input.client.completeDocument({
        schemaVersion: 1,
        workId: input.document.workId,
        documentId: input.document.documentId,
        expectedCompletionRevision: input.summary.completion.revision,
        expectedDocumentRevisionId: durableRevisionId,
      });
      await refreshCatalogAfterDocumentCompletion();
    } catch {
      input.action.setError(
        "원고를 저장한 뒤 회차 완료를 기록하지 못했습니다.",
      );
    } finally {
      input.action.setState("idle");
    }
  }, [input, refreshCatalogAfterDocumentCompletion]);

  const clearActiveDocumentCompletion = useCallback(async () => {
    if (
      !input.ready ||
      input.document === null ||
      input.summary === null ||
      input.summary.completion.state === "incomplete" ||
      input.action.state !== "idle"
    ) return;
    input.action.setState("setting-document-completion");
    input.action.setError(null);
    try {
      await input.client.clearDocumentCompletion({
        schemaVersion: 1,
        workId: input.document.workId,
        documentId: input.document.documentId,
        expectedCompletionRevision: input.summary.completion.revision,
      });
      await refreshCatalogAfterDocumentCompletion();
    } catch {
      input.action.setError("회차 완료를 취소하지 못했습니다.");
    } finally {
      input.action.setState("idle");
    }
  }, [input, refreshCatalogAfterDocumentCompletion]);

  const openActiveDocumentCompletedRevision = useCallback(() => {
    const revisionId = input.summary?.completion.completedDocumentRevisionId;
    if (
      revisionId === null ||
      revisionId === undefined ||
      input.document === null ||
      input.summary === null
    ) return;
    void input.loadRevisionPreview(
      input.document.workId,
      input.document.documentId,
      revisionId,
      input.summary.title,
    );
  }, [input]);

  return {
    completeActiveDocument,
    clearActiveDocumentCompletion,
    openActiveDocumentCompletedRevision,
  };
}
