import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { ForeshadowLineProjection } from "../../../application/foreshadowing/foreshadow-line-contract";
import type { ForeshadowPointProjection } from "../../../application/foreshadowing/foreshadow-point-contract";
import { entityId } from "../../../domain/writing";
import {
  captureForeshadowPointThroughPort,
  createForeshadowLineRecord,
  retireForeshadowLineWithCompatibility,
  startForeshadowWorkLoad,
  updateForeshadowLineRecord,
  type ForeshadowClient,
  type ForeshadowManuscriptPort,
} from "./foreshadow-client";
import {
  appendForeshadowPoint,
  canCaptureForeshadowPoint,
  canCreateForeshadowLine,
  canMutateForeshadowLine,
  canRunLoreForeshadowLink,
  closeForeshadowDialogState,
  focusForeshadowLineState,
  FORESHADOW_MESSAGES,
  foreshadowSharedLinkFailedState,
  foreshadowSharedLinkFinishedState,
  foreshadowSharedLinkStartedState,
  foreshadowSourceNavigationFailedState,
  foreshadowSourceNavigationOpenedState,
  foreshadowSourceNavigationRejectedState,
  foreshadowSourceNavigationStartedState,
  openForeshadowDialogState,
  prependForeshadowLine,
  reconcileSelectedForeshadowLine,
  removeForeshadowLine,
  removeForeshadowLinePoints,
  replaceForeshadowLine,
} from "./foreshadow-state";

function line(
  suffix: string,
  overrides: Partial<ForeshadowLineProjection> = {},
): ForeshadowLineProjection {
  return Object.freeze({
    schemaVersion: 1,
    lineId: entityId<"ForeshadowLine">(`line-${suffix}`),
    revision: 3,
    workId: entityId<"Work">("work-1"),
    title: `복선 ${suffix}`,
    note: "메모",
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
    ...overrides,
  });
}

function point(
  suffix: string,
  overrides: Partial<ForeshadowPointProjection> = {},
): ForeshadowPointProjection {
  return Object.freeze({
    schemaVersion: 1,
    pointId: entityId<"ForeshadowPoint">(`point-${suffix}`),
    revision: 1,
    workId: entityId<"Work">("work-1"),
    lineId: entityId<"ForeshadowLine">("line-current"),
    sourceDocumentId: entityId<"Document">("document-1"),
    sourceDocumentRevisionId: entityId<"DocumentRevision">("revision-1"),
    sourceAnchorId: entityId<"Anchor">(`anchor-${suffix}`),
    roleId: "plant",
    note: "지점 메모",
    exactText: "선택 원문",
    integrity: "resolved",
    range: Object.freeze({ from: 2, to: 7 }),
    createdAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  });
}

const document: ManuscriptDocumentSource = Object.freeze({
  workId: entityId<"Work">("work-1"),
  documentId: entityId<"Document">("document-1"),
  documentRevisionId: entityId<"DocumentRevision">("revision-1"),
  label: "회차 1",
  initialText: "앞선택 원문뒤",
});

const selection = Object.freeze({
  anchor: 7,
  head: 2,
  from: 2,
  to: 7,
  empty: false,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function foreshadowClient(input: Partial<ForeshadowClient> = {}) {
  const createdLine = line("created");
  const createdPoint = point("created");
  const client = {
    createLine: vi.fn(async () => createdLine),
    listLines: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId: document.workId,
      lines: Object.freeze([createdLine]),
    })),
    updateLine: vi.fn(async () => createdLine),
    retireLine: vi.fn(async () => line("created", {
      revision: 4,
      retiredAt: "2026-08-24T01:00:00.000Z",
    })),
    createPoint: vi.fn(async () => createdPoint),
    listPoints: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId: document.workId,
      points: Object.freeze([createdPoint]),
    })),
    ...input,
  } as ForeshadowClient;
  return { client, createdLine, createdPoint };
}

function manuscriptPort(
  input: Partial<ForeshadowManuscriptPort> = {},
): ForeshadowManuscriptPort {
  return {
    readSelection: vi.fn(() => selection),
    materializeDocumentText: vi.fn(() => document.initialText),
    persistDocument: vi.fn(async () => undefined),
    ...input,
  };
}

describe("foreshadow controller helpers", () => {
  it("delays null-Work reset and disposes an in-flight Work load", async () => {
    let scheduled: (() => void) | null = null;
    const cancel = vi.fn();
    const onReset = vi.fn();
    const disposeReset = startForeshadowWorkLoad({
      activeWorkId: null,
      client: foreshadowClient().client,
      onFailed: vi.fn(),
      onLoaded: vi.fn(),
      onReset,
      timer: {
        schedule: (callback, delayMs) => {
          expect(delayMs).toBe(0);
          scheduled = callback;
          return "reset-handle";
        },
        cancel,
      },
    });
    expect(onReset).not.toHaveBeenCalled();
    (scheduled as unknown as () => void)();
    expect(onReset).toHaveBeenCalledOnce();
    disposeReset();
    expect(cancel).toHaveBeenCalledWith("reset-handle");

    const lines = deferred<
      Awaited<ReturnType<ForeshadowClient["listLines"]>>
    >();
    const points = deferred<
      Awaited<ReturnType<ForeshadowClient["listPoints"]>>
    >();
    const onLoaded = vi.fn();
    const disposeLoad = startForeshadowWorkLoad({
      activeWorkId: document.workId,
      client: foreshadowClient({
        listLines: vi.fn(() => lines.promise),
        listPoints: vi.fn(() => points.promise),
      }).client,
      onFailed: vi.fn(),
      onLoaded,
      onReset: vi.fn(),
    });
    disposeLoad();
    lines.resolve(Object.freeze({
      schemaVersion: 1,
      workId: document.workId,
      lines: Object.freeze([line("late")]),
    }));
    points.resolve(Object.freeze({
      schemaVersion: 1,
      workId: document.workId,
      points: Object.freeze([point("late")]),
    }));
    await Promise.all([lines.promise, points.promise]);
    await Promise.resolve();
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it("loads atomically and retains only a present selected line", async () => {
    const loaded = vi.fn();
    const failed = vi.fn();
    const { client, createdLine, createdPoint } = foreshadowClient();
    startForeshadowWorkLoad({
      activeWorkId: document.workId,
      client,
      onFailed: failed,
      onLoaded: loaded,
      onReset: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(loaded).toHaveBeenCalledWith([createdLine], [createdPoint]);
    expect(failed).not.toHaveBeenCalled();
    expect(reconcileSelectedForeshadowLine(
      createdLine.lineId,
      [createdLine],
    )).toBe(createdLine.lineId);
    expect(reconcileSelectedForeshadowLine("missing", [createdLine])).toBeNull();

    startForeshadowWorkLoad({
      activeWorkId: document.workId,
      client: foreshadowClient({
        listLines: vi.fn(() => Promise.reject(new Error("load failed"))),
      }).client,
      onFailed: failed,
      onLoaded: loaded,
      onReset: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(failed).toHaveBeenCalledOnce();
  });

  it("prepends and updates lines with exact optimistic revisions", async () => {
    const created = line("created");
    const updated = line("current", { revision: 4, note: "변경" });
    const createLine = vi.fn(async () => created);
    const updateLine = vi.fn(async () => updated);
    const client = foreshadowClient({ createLine, updateLine }).client;
    const current = line("current", { revision: 3 });

    await createForeshadowLineRecord({
      activeWorkId: document.workId,
      client,
      note: "메모",
      title: "새 복선",
    });
    await updateForeshadowLineRecord({
      activeWorkId: document.workId,
      changes: { note: "변경" },
      client,
      line: current,
    });
    expect(createLine).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId: document.workId,
      title: "새 복선",
      note: "메모",
    });
    expect(updateLine).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId: document.workId,
      lineId: current.lineId,
      expectedRevision: 3,
      changes: { note: "변경" },
    });
    expect(prependForeshadowLine([current], created)).toEqual([
      created,
      current,
    ]);
    expect(replaceForeshadowLine([current], updated)).toEqual([updated]);
  });

  it("removes a retired line before link refresh and prunes on partial failure", async () => {
    const current = line("current");
    const retired = line("current", {
      revision: 4,
      retiredAt: "2026-08-24T01:00:00.000Z",
    });
    const successOrder: string[] = [];
    const retireLine = vi.fn(async (command) => {
      successOrder.push("retire");
      expect(command.expectedRevision).toBe(3);
      return retired;
    });
    const success = await retireForeshadowLineWithCompatibility({
      activeWorkId: document.workId,
      client: foreshadowClient({ retireLine }).client,
      line: current,
      links: {
        refresh: vi.fn(async () => {
          successOrder.push("refresh");
        }),
        pruneRetiredLine: vi.fn(),
      },
      onRetired: () => {
        successOrder.push("remove");
      },
    });
    expect(success.status).toBe("retired");
    expect(successOrder).toEqual(["retire", "remove", "refresh"]);
    expect(removeForeshadowLine([current], retired)).toEqual([]);
    expect(removeForeshadowLinePoints([
      point("current"),
      point("other", { lineId: entityId<"ForeshadowLine">("line-other") }),
    ], retired.lineId)).toEqual([
      point("other", { lineId: entityId<"ForeshadowLine">("line-other") }),
    ]);

    const failureOrder: string[] = [];
    const partial = await retireForeshadowLineWithCompatibility({
      activeWorkId: document.workId,
      client: foreshadowClient({
        retireLine: vi.fn(async () => {
          failureOrder.push("retire");
          return retired;
        }),
      }).client,
      line: current,
      links: {
        refresh: vi.fn(async () => {
          failureOrder.push("refresh");
          throw new Error("refresh failed");
        }),
        pruneRetiredLine: vi.fn(() => {
          failureOrder.push("prune");
        }),
      },
      onRetired: () => {
        failureOrder.push("remove");
      },
    });
    expect(partial.status).toBe("retired-link-refresh-failed");
    expect(failureOrder).toEqual(["retire", "remove", "refresh", "prune"]);
    expect(FORESHADOW_MESSAGES.retireLinkRefreshFailed).toBe(
      "복선 라인은 치웠지만 별빛 연결 목록을 새로 읽지 못했습니다.",
    );
  });

  it("persists before directional point capture and appends by point identity", async () => {
    const order: string[] = [];
    const created = point("created");
    const createPoint = vi.fn(async (command) => {
      order.push("createPoint");
      expect(command.selection).toEqual({ anchor: 7, head: 2 });
      expect(command.exactText).toBe("선택 원문");
      return created;
    });
    const manuscript = manuscriptPort({
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
    });
    await captureForeshadowPointThroughPort({
      client: foreshadowClient({ createPoint }).client,
      document,
      exactText: "선택 원문",
      line: line("current"),
      manuscript,
      note: "지점 메모",
      roleId: "plant",
      selection,
    });
    expect(order).toEqual(["persist", "createPoint"]);
    expect(appendForeshadowPoint([
      point("created", { revision: 0 }),
      point("old"),
    ], created)).toEqual([point("old"), created]);
  });

  it("preserves busy, Work ownership, dialog, shared-link, and navigation gates", () => {
    const current = line("current");
    expect(canCreateForeshadowLine("idle", document.workId)).toBe(true);
    expect(canCreateForeshadowLine("creating", document.workId)).toBe(false);
    expect(canMutateForeshadowLine("idle", document.workId, current)).toBe(true);
    expect(canMutateForeshadowLine(
      "idle",
      entityId<"Work">("work-2"),
      current,
    )).toBe(false);
    expect(canCaptureForeshadowPoint("idle", document)).toBe(true);
    expect(canCaptureForeshadowPoint("capturing", document)).toBe(false);
    expect(canRunLoreForeshadowLink("idle", "idle")).toBe(true);
    expect(canRunLoreForeshadowLink("creating", "idle")).toBe(false);
    expect(canRunLoreForeshadowLink("idle", "linking-lore")).toBe(false);
    expect(closeForeshadowDialogState("retiring")).toBeNull();
    expect(closeForeshadowDialogState("idle")).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(openForeshadowDialogState()).toEqual({
      dialogOpen: true,
      error: null,
      selectedLineId: null,
    });
    expect(focusForeshadowLineState(current.lineId)).toEqual({
      dialogOpen: false,
      error: null,
      selectedLineId: current.lineId,
    });
    expect(foreshadowSharedLinkStartedState("linking-lore")).toEqual({
      actionState: "linking-lore",
      error: null,
    });
    expect(foreshadowSharedLinkFailedState("실패")).toEqual({ error: "실패" });
    expect(foreshadowSharedLinkFinishedState()).toEqual({ actionState: "idle" });
    expect(foreshadowSourceNavigationRejectedState("실패")).toEqual({
      error: "실패",
    });
    expect(foreshadowSourceNavigationStartedState()).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(foreshadowSourceNavigationOpenedState()).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(foreshadowSourceNavigationFailedState("실패", false)).toEqual({
      error: "실패",
    });
    expect(foreshadowSourceNavigationFailedState("실패", true)).toEqual({
      dialogOpen: true,
      error: "실패",
    });
  });

  it("keeps profile bootstrap, shared links, and Navigator ownership outside the foreshadow controller", () => {
    const controllerSource = readFileSync(
      new URL("./useForeshadowController.ts", import.meta.url),
      "utf8",
    );
    const appSource = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
    const storyKernelSource = readFileSync(
      new URL("../../workspace/useWorkspaceStoryFeatureKernel.ts", import.meta.url),
      "utf8",
    );
    const navigationSource = readFileSync(
      new URL("../../workspace/navigation/useWorkspaceFeatureNavigationController.ts", import.meta.url),
      "utf8",
    );
    const runtimeBootstrapSource = readFileSync(
      new URL("../../workspace/session/RuntimeBootstrapController.ts", import.meta.url),
      "utf8",
    );

    expect(controllerSource).not.toContain("window.");
    expect(controllerSource.match(/\buseState(?:<|\()/gu)).toHaveLength(6);
    expect(storyKernelSource.match(/useForeshadowController\(/gu)).toHaveLength(1);
    expect(controllerSource).not.toContain("getPointProfile(");
    expect(appSource).not.toContain("window.eumStudio.foreshadowing.getPointProfile()");
    expect(runtimeBootstrapSource).toContain(
      "this.client.foreshadowing.getPointProfile()",
    );
    expect(appSource).toContain("const [runtimeBootstrapController] = useState(() =>");
    expect(appSource).toContain("new RuntimeBootstrapController(window.eumStudio)");
    expect(storyKernelSource).toContain("linkLoreForeshadow");
    expect(storyKernelSource).toContain("unlinkLoreForeshadow");
    expect(navigationSource).toContain("const openForeshadowPointSource = useCallback(");
    expect(navigationSource).toContain('if (result.status === "superseded") return;');
    expect(navigationSource).toContain("const result = await documentNavigator.open(");
    expect(appSource).not.toContain("setForeshadow");
  });
});
