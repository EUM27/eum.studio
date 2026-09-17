import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { entityId } from "../../../domain/writing";
import type { NarrativeDigestResult } from "../../../application/continuity/narrative-digest-contract";
import { useNarrativeDigestController } from "./useNarrativeDigestController";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock("react", () => {
  const effect = (run: () => void | (() => void), deps: readonly unknown[]) => {
    const slot = hooks.cursor++;
    const old = hooks.slots[slot] as { deps: readonly unknown[]; cleanup?: () => void } | undefined;
    if (!old || deps.some((value, index) => !Object.is(value, old.deps[index]))) hooks.effects.push(() => { old?.cleanup?.(); hooks.slots[slot] = { deps, cleanup: run() }; });
  };
  return {
    useCallback: <T>(callback: T, deps: readonly unknown[]) => {
    const slot = hooks.cursor++;
    const old = hooks.slots[slot] as { deps: readonly unknown[]; callback: T } | undefined;
    if (!old || deps.length !== old.deps.length || deps.some((value, index) => !Object.is(value, old.deps[index]))) hooks.slots[slot] = { deps, callback };
    return (hooks.slots[slot] as { callback: T }).callback;
  },
    useRef: <T>(initial: T) => { const slot = hooks.cursor++; hooks.slots[slot] ??= { current: initial }; return hooks.slots[slot]; },
    useState: <T>(initial: T | (() => T)) => {
      const slot = hooks.cursor++;
      if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === "function" ? (initial as () => T)() : initial;
      return [hooks.slots[slot], (value: T) => { hooks.slots[slot] = value; }];
    },
    useEffect: effect, useLayoutEffect: effect,
  };
});
beforeEach(() => { hooks.slots = []; hooks.cursor = 0; hooks.effects = []; });
type Input = Parameters<typeof useNarrativeDigestController>[0];
function render(input: Input) {
  hooks.cursor = 0;
  const Controller = () => useNarrativeDigestController(input);
  const result = Controller(); hooks.effects.splice(0).forEach((effect) => effect()); return result;
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function fixture() {
  const workId = entityId<"Work">(randomUUID());
  const client = { list: vi.fn(async () => ({ digests: [] })), listSceneAnalysisRuns: vi.fn(async () => ({ runs: [] })), generate: vi.fn<(...args: unknown[]) => Promise<NarrativeDigestResult>>(), regenerate: vi.fn<(...args: unknown[]) => Promise<NarrativeDigestResult>>() };
  const assistant = { grantContextPermission: vi.fn(async (): Promise<void> => undefined) };
  const input: Input = { activeWorkId: workId, workLoadId: workId, conversationId: entityId<"AssistantConversation">(randomUUID()), client: client as unknown as Input["client"], assistantClient: assistant as unknown as Input["assistantClient"] };
  return { input, client, assistant };
}

it.each(["permission", "error"] as const)("ignores an old Work's late %s without granting access to the new Work", async (outcome) => {
  const { input, client, assistant } = fixture();
  const old = deferred<NarrativeDigestResult>(); client.generate.mockReturnValueOnce(old.promise);
  render(input); await settle();
  const pending = render(input).generate({ kind: "work" }, [entityId<"Document">(randomUUID())]);
  const nextWorkId = entityId<"Work">(randomUUID());
  const next = { ...input, activeWorkId: nextWorkId, workLoadId: nextWorkId };
  render(next); await settle();
  if (outcome === "error") old.reject(new Error("Obsolete response"));
  else old.resolve({ schemaVersion: 1, status: "permission-required", missing: [], destinationId: randomUUID() });
  await pending;
  expect(render(next)).toMatchObject({ permissionRequired: false, error: null, actionState: "idle" });
  await render(next).grantPermissionAndRetry();
  expect(assistant.grantContextPermission).not.toHaveBeenCalled();
  expect(client.generate).toHaveBeenCalledTimes(1);
});

it("does not run an old permission retry after its grant finishes in another Work", async () => {
  const { input, client, assistant } = fixture();
  client.generate.mockResolvedValue({ schemaVersion: 1, status: "permission-required", missing: [], destinationId: randomUUID() });
  render(input); await settle();
  await render(input).generate({ kind: "work" }, [entityId<"Document">(randomUUID())]);
  const grant = deferred<void>(); assistant.grantContextPermission.mockReturnValueOnce(grant.promise);
  const retry = render(input).grantPermissionAndRetry();
  const nextWorkId = entityId<"Work">(randomUUID());
  const next = { ...input, activeWorkId: nextWorkId, workLoadId: nextWorkId };
  render(next); await settle(); grant.resolve(); await retry;
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(render(next)).toMatchObject({ permissionRequired: false, error: null, actionState: "idle" });
});

it("does not dispatch an old refresh callback after switching Works", async () => {
  const { input, client } = fixture();
  render(input); await settle();
  const oldRefresh = render(input).refresh;
  const workId = entityId<"Work">(randomUUID());
  const next = { ...input, activeWorkId: workId, workLoadId: workId };
  render(next); await settle();
  client.list.mockClear(); client.listSceneAnalysisRuns.mockClear();
  expect(await oldRefresh()).toBe(false);
  expect(client.list).not.toHaveBeenCalled();
  expect(client.listSceneAnalysisRuns).not.toHaveBeenCalled();
  expect(render(next).actionState).toBe("idle");
});
