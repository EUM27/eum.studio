import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { entityId } from "../../../domain/writing";
import { useStudioSettingsController } from "./useStudioSettingsController";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock("react", () => ({
  useCallback: <T>(callback: T, deps: readonly unknown[]) => {
    const slot = hooks.cursor++;
    const old = hooks.slots[slot] as { deps: readonly unknown[]; callback: T } | undefined;
    if (!old || deps.length !== old.deps.length || deps.some((value, index) => !Object.is(value, old.deps[index]))) hooks.slots[slot] = { deps, callback };
    return (hooks.slots[slot] as { callback: T }).callback;
  },
  useState: <T>(initial: T | (() => T)) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [hooks.slots[slot], (value: T | ((old: T) => T)) => { hooks.slots[slot] = typeof value === "function" ? (value as (old: T) => T)(hooks.slots[slot] as T) : value; }];
  },
  useEffect: (run: () => void | (() => void), deps: readonly unknown[]) => {
    const slot = hooks.cursor++;
    const old = hooks.slots[slot] as { deps: readonly unknown[]; cleanup?: () => void } | undefined;
    if (!old || deps.some((value, index) => !Object.is(value, old.deps[index]))) hooks.effects.push(() => { old?.cleanup?.(); hooks.slots[slot] = { deps, cleanup: run() }; });
  },
}));
beforeEach(() => { hooks.slots = []; hooks.cursor = 0; hooks.effects = []; });
type Input = Parameters<typeof useStudioSettingsController>[0];
function render(input: Input) {
  hooks.cursor = 0;
  const Controller = () => useStudioSettingsController(input);
  const result = Controller(); hooks.effects.splice(0).forEach((effect) => effect()); return result;
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
  const workId = entityId<"Work">(randomUUID());
  let appRevision = 0;
  let musicRevision = 0;
  const settings = {
    getYouTubeMusicConnectionStatus: vi.fn(async () => ({ revision: 0 })),
    getProfile: vi.fn(async () => ({})), getMusicProfile: vi.fn(async () => ({})),
    get: vi.fn(async () => ({ revision: appRevision, settings: { defaultEpisodeCharacters: 100 } })),
    getWorkMusic: vi.fn(async () => ({ workId, revision: musicRevision, settings: {} })),
    getWorkSceneAnalysis: vi.fn(async () => ({ workId, revision: 1, settings: { enabled: false } })),
    save: vi.fn(async (command: { expectedRevision: number; settings: unknown }) => {
      if (command.expectedRevision !== appRevision) throw new Error("App settings revision conflict");
      return { revision: ++appRevision, settings: command.settings };
    }),
    saveWorkMusic: vi.fn(async (command: { expectedRevision: number; settings: unknown }) => {
      if (command.expectedRevision !== musicRevision) throw new Error("Music revision conflict");
      return { workId, revision: ++musicRevision, settings: command.settings };
    }),
  };
  const input: Input = { activeWorkId: workId, assistantClient: { getChatGptOAuthStatus: vi.fn(async () => ({ connected: false })) } as unknown as Input["assistantClient"], onOpening: vi.fn(), settingsClient: settings as unknown as Input["settingsClient"], shellActionState: "idle" };
  return { input, settings };
}

it("does not pass a previous Work's music or automatic analysis settings to the next Work", async () => {
  const { input } = fixture();
  render(input).openAppSettings(); await settle();
  expect(render(input).workSceneAnalysisSettingsProjection?.workId).toBe(input.activeWorkId);
  const next = render({ ...input, activeWorkId: entityId<"Work">(randomUUID()) });
  expect(next.workSceneAnalysisSettingsProjection).toBeNull();
  expect(next.workMusicSettingsProjection).toBeNull();
});

it("keeps successful revisions after a partial save failure so the corrected request can be retried", async () => {
  const { input, settings } = fixture();
  render(input).openAppSettings(); await settle();
  settings.saveWorkMusic.mockRejectedValueOnce(new Error("Music write failed"));
  const draft = { defaultEpisodeCharacters: 120, workMusicSettings: {}, youtubeApiKey: null, workSceneAnalysisEnabled: false } as Parameters<ReturnType<typeof useStudioSettingsController>["saveAppSettings"]>[0];
  render(input).saveAppSettings(draft); await settle();
  expect(render(input).appSettingsError).toBe("Music write failed");
  expect(render(input).appSettingsProjection?.revision).toBe(1);
  render(input).saveAppSettings(draft); await settle();
  expect(settings.save.mock.calls.map(([command]) => command.expectedRevision)).toEqual([0, 1]);
  expect(render(input)).toMatchObject({ appSettingsError: null, showAppSettings: false });
});
