import { useEffect, useRef, type Dispatch, type SetStateAction, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { SharedWorkspaceBridge } from "../../../application/workspace/shared-workspace-snapshot";
import type { WorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";
import type { ManuscriptDurableSaveQueue } from "../../persistence/manuscript-durable-save-queue";
import type { ManuscriptEditorHandle } from "../../editor/ManuscriptEditor";
import type { WorkspaceRuntimeState } from "./workspace-session-state";

/** Refresh on returning to a window; never replace an unsaved or composing draft. */
export function useSharedWorkspaceSync(input: Readonly<{
  shared: SharedWorkspaceBridge | undefined;
  runtime: WorkspaceRuntimeState;
  queueRef: RefObject<ManuscriptDurableSaveQueue | null>;
  editorRef: RefObject<Pick<ManuscriptEditorHandle, "isDocumentComposing"> | null>;
  setRuntime: Dispatch<SetStateAction<WorkspaceRuntimeState>>;
  onCatalogChange: ((catalog: WorkspaceCatalogProjection) => void) | undefined;
  onError: (message: string | null) => void;
}>) {
  const latest = useRef(input);
  useEffect(() => { latest.current = input; });
  useEffect(() => {
    const shared = input.shared;
    if (shared === undefined) return;
    let disposed = false;
    let running = false;
    let requested = false;
    let frame: number | null = null;
    const refresh = async () => {
      if (running || disposed) return;
      running = true;
      requested = false;
      let deferred = false;
      try {
        const snapshot = await shared.getSnapshot();
        if (disposed) return;
        const current = latest.current;
        const runtime = current.runtime;
        const queue = current.queueRef.current;
        if (runtime.status !== "ready" || queue === null || snapshot.persistenceProfile === null) return;
        const sequences = new Map(snapshot.persistenceProfile.documentSequences.map((sequence) => [sequence.documentId, sequence]));
        const sources = new Map(runtime.documentProfile.documents.map((source) => [source.documentId, source]));
        for (const source of snapshot.documentProfile.documents) {
          if (current.editorRef.current?.isDocumentComposing(source)) {
            requested = true;
            deferred = true;
            continue;
          }
          const sequence = sequences.get(source.documentId);
          if (source.documentRevisionId === null || sequence === undefined) continue;
          if (queue.adoptConfirmedDocument({
            workId: source.workId,
            documentId: source.documentId,
            baseRevisionId: sequence.baseRevisionId ?? source.documentRevisionId,
            currentRevisionId: source.documentRevisionId,
            nextSequence: sequence.nextSequence,
          })) sources.set(source.documentId, source);
        }
        // Preserve this window's selected document and every local draft.
        const next = {
          ...runtime,
          catalog: snapshot.catalog,
          documentProfile: { ...runtime.documentProfile, documents: [...sources.values()] },
        };
        latest.current = { ...current, runtime: next };
        flushSync(() => {
          current.setRuntime(next);
          current.onCatalogChange?.(snapshot.catalog);
        });
      } catch {
        if (!disposed) latest.current.onError("다른 창의 변경 내용을 불러오지 못했습니다.");
      } finally {
        running = false;
        if (requested && !deferred && !disposed && document.hasFocus()) schedule();
      }
    };
    const schedule = () => {
      if (!requested || frame !== null || running) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        void refresh();
      });
    };
    const unsubscribe = shared.onChanged(() => {
      requested = true;
      if (document.hasFocus()) schedule();
    });
    window.addEventListener("focus", schedule);
    window.addEventListener("compositionend", schedule);
    return () => {
      disposed = true;
      unsubscribe();
      window.removeEventListener("focus", schedule);
      window.removeEventListener("compositionend", schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [input.shared]);
}
