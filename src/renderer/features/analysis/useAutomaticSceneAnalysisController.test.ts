import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { entityId } from "../../../domain/writing";
import type { SceneProjectionList } from "../../../application/structure/scene-projection";
import { executeAutomaticSceneAnalysis } from "./automatic-scene-analysis";
import { useAutomaticSceneAnalysisController } from "./useAutomaticSceneAnalysisController";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock("react", () => {
  const effect = (run: () => void | (() => void), deps: readonly unknown[]) => {
    const slot = hooks.cursor++;
    const old = hooks.slots[slot] as { deps: readonly unknown[]; cleanup?: () => void } | undefined;
    if (!old || deps.some((entry, index) => !Object.is(entry, old.deps[index]))) {
      hooks.effects.push(() => { old?.cleanup?.(); hooks.slots[slot] = { deps, cleanup: run() }; });
    }
  };
  return {
    useCallback: <T>(callback: T) => callback,
    useRef: <T>(initial: T) => { const slot = hooks.cursor++; hooks.slots[slot] ??= { current: initial }; return hooks.slots[slot]; },
    useState: <T>(initial: T) => {
      const slot = hooks.cursor++;
      if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
      return [hooks.slots[slot], (next: T) => { hooks.slots[slot] = next; }];
    },
    useEffect: effect, useLayoutEffect: effect,
  };
});
vi.mock("./automatic-scene-analysis", async (original) => ({
  ...await original<typeof import("./automatic-scene-analysis")>(),
  executeAutomaticSceneAnalysis: vi.fn(),
}));

beforeEach(() => { hooks.slots = []; hooks.cursor = 0; hooks.effects = []; vi.mocked(executeAutomaticSceneAnalysis).mockReset(); });

function projection(): SceneProjectionList {
  const workId = entityId<"Work">(randomUUID());
  const documentId = entityId<"Document">(randomUUID());
  return {
    schemaVersion: 1, workId, status: "clean", ruleSet: {
      schemaVersion: 1, workId, sceneRuleSetId: entityId<"SceneRuleSet">(randomUUID()), revision: 1,
      displayName: randomUUID(), boundaryRules: [], normalizationPolicy: "preserve", enabled: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    scenes: [{ schemaVersion: 1, workId, documentId,
      documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
      documentTitle: randomUUID(), documentIndex: 0, sceneIndex: 0,
      sceneKey: randomUUID(), startAnchorId: entityId<"Anchor">(randomUUID()), endAnchorId: null,
      range: { start: 0, end: 8 }, integrity: "resolved", source: "override",
      events: [], excludedEvents: [], sceneIdentity: { sceneId: entityId<"Scene">(randomUUID()), segments: [] } }],
    unassignedEvents: [], sceneEventOverrides: [],
  };
}

function inputFor(sceneProjection: SceneProjectionList): Parameters<typeof useAutomaticSceneAnalysisController>[0] {
  return {
    activeWorkId: sceneProjection.workId, sceneProjection, documents: [],
    conversationId: entityId<"AssistantConversation">(randomUUID()),
    assistantClient: { getChatGptOAuthStatus: vi.fn() }, digestClient: { runSceneAnalysis: vi.fn() },
    canonReviewController: { refreshCandidates: vi.fn() }, persistDocument: vi.fn(),
    refreshDigests: vi.fn(), refreshContinuityCandidates: vi.fn(), refreshSceneProjection: vi.fn(),
    settingsClient: { getWorkSceneAnalysis: vi.fn() }, settingsEnabled: true, settingsRevision: 1,
    structureClient: { finalizeSceneCanonCheck: vi.fn() },
  };
}

function renderController(input: Parameters<typeof useAutomaticSceneAnalysisController>[0]) {
  hooks.cursor = 0;
  const Controller = () => useAutomaticSceneAnalysisController(input);
  const result = Controller();
  const pending = hooks.effects.splice(0);
  pending.forEach((run) => run());
  return result;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

it.each(["completed", "permission-required", "failure"] as const)("ignores an old Work's late %s and invalidates queued requests", async (outcome) => {
  const a = projection(); const b = projection();
  const aInput = inputFor(a); const bInput = inputFor(b);
  const old = deferred<Awaited<ReturnType<typeof executeAutomaticSceneAnalysis>>>();
  vi.mocked(executeAutomaticSceneAnalysis).mockImplementationOnce(() => old.promise);
  const controller = renderController(aInput);
  controller.analyzeSplit(a, a.scenes[0]!.documentId, 3);
  controller.analyzeSplit(a, a.scenes[0]!.documentId, 3);
  await vi.waitFor(() => expect(executeAutomaticSceneAnalysis).toHaveBeenCalledTimes(1));
  renderController(bInput);
  expect(renderController(bInput)).toMatchObject({ state: "idle", canRetry: false, error: null });
  if (outcome === "failure") old.reject(new Error(randomUUID()));
  else old.resolve(outcome);
  await old.promise.catch(() => undefined);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(executeAutomaticSceneAnalysis).toHaveBeenCalledTimes(1);
  expect(renderController(bInput)).toMatchObject({ state: "idle", canRetry: false, error: null });
});

it("does not let an old A request overwrite a newer A request after A to B to A", async () => {
  const a = projection(); const b = projection();
  const aInput = inputFor(a); const bInput = inputFor(b);
  const old = deferred<Awaited<ReturnType<typeof executeAutomaticSceneAnalysis>>>();
  vi.mocked(executeAutomaticSceneAnalysis).mockImplementationOnce(() => old.promise).mockResolvedValue("permission-required");
  renderController(aInput).analyzeSplit(a, a.scenes[0]!.documentId, 3);
  await vi.waitFor(() => expect(executeAutomaticSceneAnalysis).toHaveBeenCalledTimes(1));
  renderController(bInput);
  renderController(aInput).analyzeSplit(a, a.scenes[0]!.documentId, 3);
  await vi.waitFor(() => expect(renderController(aInput).state).toBe("permission-required"));
  old.reject(new Error(randomUUID()));
  await old.promise.catch(() => undefined);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(renderController(aInput)).toMatchObject({ state: "permission-required", canRetry: true, error: null });
});

it("keeps B running when A completes late", async () => {
  const a = projection(); const b = projection();
  const aInput = inputFor(a); const bInput = inputFor(b);
  type Result = Awaited<ReturnType<typeof executeAutomaticSceneAnalysis>>;
  const first = deferred<Result>(); const second = deferred<Result>();
  vi.mocked(executeAutomaticSceneAnalysis).mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  renderController(aInput).analyzeSplit(a, a.scenes[0]!.documentId, 3);
  await vi.waitFor(() => expect(executeAutomaticSceneAnalysis).toHaveBeenCalledTimes(1));
  renderController(bInput).analyzeSplit(b, b.scenes[0]!.documentId, 3);
  await vi.waitFor(() => expect(executeAutomaticSceneAnalysis).toHaveBeenCalledTimes(2));
  first.resolve("completed"); await first.promise;
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(renderController(bInput)).toMatchObject({ state: "running", canRetry: false, error: null });
  second.resolve("completed"); await second.promise;
});

it("does not refresh views when a real analysis execution becomes obsolete during its response", async () => {
  const actual = await vi.importActual<typeof import("./automatic-scene-analysis")>("./automatic-scene-analysis");
  const a = projection(); const scene = a.scenes[0]!;
  const sceneId = scene.sceneIdentity?.sceneId;
  if (sceneId === undefined) throw new Error("Expected a stable Scene fixture");
  const base = inputFor(a);
  const response = deferred<Awaited<ReturnType<typeof base.digestClient.runSceneAnalysis>>>();
  const runSceneAnalysis = vi.fn(() => response.promise);
  const refreshCanonCandidates = vi.fn(async () => undefined);
  let current = true;
  const execution = actual.executeAutomaticSceneAnalysis({
    ...base, enabled: true, requestedScene: scene, trigger: "scene-split", isCurrent: () => current,
    assistantClient: { getChatGptOAuthStatus: vi.fn(async () => ({ connected: true }) as never) },
    documents: [{ workId: scene.workId, documentId: scene.documentId, documentRevisionId: scene.documentRevisionId, label: scene.documentTitle, initialText: randomUUID() }],
    refreshSceneProjection: vi.fn(async () => a), refreshCanonCandidates,
    structureClient: { finalizeSceneCanonCheck: vi.fn(async () => ({
      schemaVersion: 1 as const, workId: scene.workId, sceneId, sceneKey: scene.sceneKey,
      sourceRange: { documentId: scene.documentId, documentRevisionId: scene.documentRevisionId, from: scene.range!.start, to: scene.range!.end },
    })) }, digestClient: { runSceneAnalysis },
  });
  await vi.waitFor(() => expect(runSceneAnalysis).toHaveBeenCalledOnce());
  current = false; response.resolve({ schemaVersion: 1, status: "login-required" });
  await expect(execution).resolves.toBe("stale");
  expect(base.refreshDigests).not.toHaveBeenCalled();
  expect(refreshCanonCandidates).not.toHaveBeenCalled();
  expect(base.refreshContinuityCandidates).not.toHaveBeenCalled();
});
