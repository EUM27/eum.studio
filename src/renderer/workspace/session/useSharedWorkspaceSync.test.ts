import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { entityId } from "../../../domain/writing";
import { ManuscriptDurableSaveQueue } from "../../persistence/manuscript-durable-save-queue";
import type { WorkspaceRuntimeState } from "./workspace-session-state";
import { useSharedWorkspaceSync } from "./useSharedWorkspaceSync";

const hooks = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)> }));
vi.mock("react", () => ({
  useRef: <T>(current: T) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));
vi.mock("react-dom", () => ({ flushSync: (callback: () => void) => callback() }));
afterEach(() => { hooks.effects = []; vi.unstubAllGlobals(); });

it("does not read manuscripts on ordinary focus or composition, and defers remote replacement until composition ends", async () => {
  const events = new EventTarget();
  const frames: Array<() => void> = [];
  const hasFocus = vi.fn(() => true);
  vi.stubGlobal("document", { hasFocus });
  vi.stubGlobal("window", {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    requestAnimationFrame: (callback: () => void) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame: vi.fn(),
  });
  const source = { workId: entityId<"Work">(randomUUID()), documentId: entityId<"Document">(randomUUID()), documentRevisionId: entityId<"DocumentRevision">(randomUUID()), label: randomUUID(), initialText: "로컬 원고" };
  const remote = { ...source, documentRevisionId: entityId<"DocumentRevision">(randomUUID()), initialText: "다른 창의 원고" };
  const queue = new ManuscriptDurableSaveQueue({
    documents: [{ ...source, baseRevisionId: source.documentRevisionId, nextSequence: 0 }],
    policy: { maxTransactionsPerBatch: 1, maxDelayMs: 0 },
    saveChangeBatch: async () => { throw new Error("No local save is expected"); },
    createBatchId: () => entityId<"ChangeBatch">(randomUUID()), now: () => new Date().toISOString(),
    scheduler: { schedule: vi.fn(), cancel: vi.fn() }, onStateChange: vi.fn(),
  });
  const snapshot = {
    catalog: { schemaVersion: 1 as const, works: [], activeWorkId: source.workId, activeDocumentId: source.documentId, canCreateFirstWork: false },
    documentProfile: { schemaVersion: 1 as const, initialDocumentId: source.documentId, documents: [remote] },
    persistenceProfile: { schemaVersion: 1 as const, batching: { schemaVersion: 1 as const, maxTransactionsPerBatch: 1, maxDelayMs: 0 }, documentSequences: [{ documentId: source.documentId, nextSequence: 1, baseRevisionId: source.documentRevisionId }] },
    resumeCheckpoint: { schemaVersion: 1 as const, status: "unavailable" as const },
  };
  const getSnapshot = vi.fn(async () => snapshot);
  let onChanged = () => {};
  const isDocumentComposing = vi.fn(() => true);
  const setRuntime = vi.fn();
  const Harness = () => useSharedWorkspaceSync({
    shared: { getSnapshot, onChanged: (callback) => { onChanged = callback; return vi.fn(); } },
    runtime: { ...snapshot, status: "ready", activeDocumentId: source.documentId, documentProfile: { ...snapshot.documentProfile, documents: [source] } } as unknown as WorkspaceRuntimeState,
    queueRef: { current: queue }, editorRef: { current: { isDocumentComposing } },
    setRuntime, onCatalogChange: vi.fn(), onError: vi.fn(),
  });
  Harness();
  const cleanups = hooks.effects.map((effect) => effect());
  events.dispatchEvent(new Event("focus"));
  events.dispatchEvent(new Event("compositionend"));
  expect(frames).toHaveLength(0);
  expect(getSnapshot).not.toHaveBeenCalled();
  onChanged();
  frames.shift()!();
  await vi.waitFor(() => expect(setRuntime).toHaveBeenCalledTimes(1));
  expect(queue.getCurrentRevisionId(source.documentId)).toBe(source.documentRevisionId);
  expect(setRuntime.mock.calls[0]?.[0].documentProfile.documents[0]).toBe(source);
  expect(frames).toHaveLength(0);
  isDocumentComposing.mockReturnValue(false);
  events.dispatchEvent(new Event("compositionend"));
  frames.shift()!();
  await vi.waitFor(() => expect(setRuntime).toHaveBeenCalledTimes(2));
  expect(queue.getCurrentRevisionId(source.documentId)).toBe(remote.documentRevisionId);
  expect(setRuntime.mock.calls[1]?.[0].documentProfile.documents[0]).toBe(remote);
  cleanups.forEach((cleanup) => cleanup?.());
});
