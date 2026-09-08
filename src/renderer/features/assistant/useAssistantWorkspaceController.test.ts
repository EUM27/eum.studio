import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { entityId } from "../../../domain/writing";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import { useAssistantWorkspaceController, type AssistantWorkspaceControllerInput } from "./useAssistantWorkspaceController";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock("react", () => {
  const effect = (run: () => void | (() => void), deps: readonly unknown[]) => {
    const slot = hooks.cursor++;
    const old = hooks.slots[slot] as { deps: readonly unknown[]; cleanup?: () => void } | undefined;
    if (!old || deps.some((value, index) => !Object.is(value, old.deps[index]))) hooks.effects.push(() => { old?.cleanup?.(); hooks.slots[slot] = { deps, cleanup: run() }; });
  };
  return {
    useCallback: <T>(callback: T) => callback, useMemo: <T>(callback: () => T) => callback(),
    useRef: <T>(initial: T) => { const slot = hooks.cursor++; hooks.slots[slot] ??= { current: initial }; return hooks.slots[slot]; },
    useState: <T>(initial: T | (() => T)) => { const slot = hooks.cursor++; if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === "function" ? (initial as () => T)() : initial; return [hooks.slots[slot], (value: T) => { hooks.slots[slot] = value; }]; },
    useEffect: effect, useLayoutEffect: effect,
  };
});
beforeEach(() => { hooks.slots = []; hooks.cursor = 0; hooks.effects = []; });
function render(input: AssistantWorkspaceControllerInput) {
  hooks.cursor = 0;
  const Component = () => useAssistantWorkspaceController(input);
  const value = Component(); hooks.effects.splice(0).forEach((effect) => effect()); return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function fixture() {
  const client = { runVocabularySuggestion: vi.fn(), runExternalSettingReview: vi.fn(), cancelRequest: vi.fn(async () => ({ schemaVersion: 1, status: "cancelled" })), listContextState: vi.fn() };
  const input: AssistantWorkspaceControllerInput = { activeWorkId: entityId<"Work">(randomUUID()), client: client as unknown as StudioBridge["assistant"], document: null };
  return { input, client };
}

it.each(["success", "error"] as const)("Work switch cancels the exact request and ignores its late %s", async (outcome) => {
  const { input, client } = fixture(); const old = deferred<unknown>();
  client.runVocabularySuggestion.mockReturnValue(old.promise);
  const pending = render(input).runAssistantVocabularySuggestion({ connectionId: randomUUID(), query: randomUUID(), includeSelection: false });
  expect(client.runVocabularySuggestion).toHaveBeenCalledTimes(1);
  const next = { ...input, activeWorkId: entityId<"Work">(randomUUID()) };
  render(next);
  expect(client.cancelRequest).toHaveBeenCalledWith({ schemaVersion: 1, workId: input.activeWorkId, requestId: client.runVocabularySuggestion.mock.calls[0]![0].requestId });
  if (outcome === "error") old.reject(new Error("old private response")); else old.resolve({ schemaVersion: 1, status: "candidate", candidate: {} });
  await pending;
  expect(render(next)).toMatchObject({ assistantContextActionState: "idle", assistantContextActionError: null });
  expect(client.listContextState).not.toHaveBeenCalled();
});

it("user cancellation before document persistence prevents dispatch", async () => {
  const { input, client } = fixture(); const save = deferred<void>();
  const documentId = entityId<"Document">(randomUUID());
  const current = { ...input, document: { source: { workId: input.activeWorkId!, documentId, documentRevisionId: entityId<"DocumentRevision">(randomUUID()), label: randomUUID(), initialText: "선택 원고" }, readSelection: () => ({ from: 0, to: 2, empty: false }), materializeText: () => "선택 원고", persist: () => save.promise, getCurrentRevisionId: () => entityId<"DocumentRevision">(randomUUID()) } };
  const pending = render(current).runAssistantVocabularySuggestion({ connectionId: randomUUID(), query: randomUUID(), includeSelection: true });
  await render(current).cancelAssistantRequest();
  save.resolve(); await pending;
  expect(client.runVocabularySuggestion).not.toHaveBeenCalled();
  expect(client.cancelRequest).not.toHaveBeenCalled();
  expect(render(current)).toMatchObject({ assistantContextActionState: "idle", assistantContextActionError: "조수 요청을 취소했습니다." });
});
