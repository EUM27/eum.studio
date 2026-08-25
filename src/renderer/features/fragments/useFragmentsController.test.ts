import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { FragmentProjection } from "../../../application/fragments/fragment-contract";
import { entityId } from "../../../domain/writing";
import {
  insertFragmentAtCursor,
  moveSelectionToFragment,
  persistAndCaptureFragment,
  retireFragmentRecord,
  startFragmentsWorkLoad,
  updateFragmentRecord,
  type FragmentSelection,
  type FragmentsClient,
  type FragmentsManuscriptPort,
} from "./fragments-client";
import {
  canInsertFragment,
  canMutateFragment,
  canRunFragmentDocumentAction,
  closeFragmentShelfState,
  fragmentSourceNavigationCompletedState,
  fragmentSourceNavigationFailedState,
  fragmentSourceNavigationReopenedState,
  fragmentSourceNavigationStartedState,
  FRAGMENT_MESSAGES,
  openFragmentShelfState,
  resolveFragmentMoveState,
} from "./fragments-state";

function fragment(
  suffix: string,
  overrides: Partial<FragmentProjection> = {},
): FragmentProjection {
  return Object.freeze({
    schemaVersion: 1,
    fragmentId: entityId<"Fragment">(`fragment-${suffix}`),
    revision: 3,
    workId: entityId<"Work">("work-1"),
    sourceDocumentId: entityId<"Document">("document-1"),
    sourceDocumentRevisionId: entityId<"DocumentRevision">("revision-1"),
    sourceAnchorId: entityId<"Anchor">(`anchor-${suffix}`),
    kindId: "quote",
    title: "",
    pinned: false,
    useCount: 0,
    exactText: "선택 원문",
    integrity: "resolved",
    range: Object.freeze({ from: 2, to: 7 }),
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
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

const selection: FragmentSelection = Object.freeze({
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

function manuscriptPort(input: Partial<FragmentsManuscriptPort> = {}) {
  const port: FragmentsManuscriptPort = {
    readSelection: vi.fn(() => selection),
    materializeDocumentText: vi.fn(() => document.initialText),
    persistDocument: vi.fn(async () => undefined),
    deleteExactDocumentRange: vi.fn(() => true),
    insertFragmentAtCursor: vi.fn(() => true),
    ...input,
  };
  return port;
}

function fragmentsClient(input: Partial<FragmentsClient> = {}) {
  const created = fragment("created");
  const client = {
    capture: vi.fn(async () => created),
    list: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId: document.workId,
      fragments: Object.freeze([created]),
    })),
    update: vi.fn(async () => created),
    recordUse: vi.fn(async () => fragment("created", { revision: 4, useCount: 1 })),
    retire: vi.fn(async () => fragment("created", {
      revision: 4,
      retiredAt: "2026-08-24T01:00:00.000Z",
    })),
    ...input,
  } as FragmentsClient;
  return { client, created };
}

describe("fragments controller helpers", () => {
  it("delays the null-Work reset and disposes an in-flight Work list", async () => {
    let scheduled: (() => void) | null = null;
    const cancel = vi.fn();
    const onReset = vi.fn();
    const { client } = fragmentsClient();
    const disposeReset = startFragmentsWorkLoad({
      activeWorkId: null,
      client,
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
    expect(scheduled).not.toBeNull();
    (scheduled as unknown as () => void)();
    expect(onReset).toHaveBeenCalledOnce();
    disposeReset();
    expect(cancel).toHaveBeenCalledWith("reset-handle");

    const list = deferred<Awaited<ReturnType<FragmentsClient["list"]>>>();
    const onLoaded = vi.fn();
    const disposeList = startFragmentsWorkLoad({
      activeWorkId: document.workId,
      client: fragmentsClient({ list: vi.fn(() => list.promise) }).client,
      onFailed: vi.fn(),
      onLoaded,
      onReset: vi.fn(),
    });
    disposeList();
    list.resolve(Object.freeze({
      schemaVersion: 1,
      workId: document.workId,
      fragments: Object.freeze([fragment("late")]),
    }));
    await list.promise;
    await Promise.resolve();
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it("loads success/failure without a visible loading state or stale install", async () => {
    const loaded = vi.fn();
    const failed = vi.fn();
    const success = fragmentsClient();
    startFragmentsWorkLoad({
      activeWorkId: document.workId,
      client: success.client,
      onFailed: failed,
      onLoaded: loaded,
      onReset: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(loaded).toHaveBeenCalledWith([success.created]);
    expect(failed).not.toHaveBeenCalled();

    const error = new Error("list failed");
    startFragmentsWorkLoad({
      activeWorkId: document.workId,
      client: fragmentsClient({ list: vi.fn(() => Promise.reject(error)) }).client,
      onFailed: failed,
      onLoaded: loaded,
      onReset: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(failed).toHaveBeenCalledOnce();
  });

  it("persists before capture and preserves directional selection", async () => {
    const order: string[] = [];
    const port = manuscriptPort({
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
    });
    const capture = vi.fn(async (command) => {
      order.push("capture");
      expect(command.selection).toEqual({ anchor: 7, head: 2 });
      expect(command.exactText).toBe("선택 원문");
      return fragment("capture");
    });

    await persistAndCaptureFragment({
      client: fragmentsClient({ capture }).client,
      document,
      exactText: "선택 원문",
      kindId: "quote",
      manuscript: port,
      selection,
    });
    expect(order).toEqual(["persist", "capture"]);
  });

  it("keeps capture-first move ordering and every partial-success boundary", async () => {
    const order: string[] = [];
    const { client, created } = fragmentsClient({
      capture: vi.fn(async () => {
        order.push("capture");
        return fragment("created");
      }),
      list: vi.fn(async () => {
        order.push("list");
        return Object.freeze({
          schemaVersion: 1 as const,
          workId: document.workId,
          fragments: Object.freeze([fragment("created")]),
        });
      }),
    });
    const port = manuscriptPort({
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
      deleteExactDocumentRange: vi.fn(() => {
        order.push("delete");
        return true;
      }),
    });
    await expect(moveSelectionToFragment({
      client,
      document,
      exactText: "선택 원문",
      kindId: "quote",
      manuscript: port,
      selection,
    })).resolves.toMatchObject({ status: "moved" });
    expect(order).toEqual(["persist", "capture", "delete", "persist", "list"]);

    const deleteFailed = await moveSelectionToFragment({
      client,
      document,
      exactText: "선택 원문",
      kindId: "quote",
      manuscript: manuscriptPort({ deleteExactDocumentRange: vi.fn(() => false) }),
      selection,
    });
    expect(deleteFailed).toMatchObject({
      status: "captured-delete-failed",
      captured: created,
    });

    const secondPersist = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("second persist failed"));
    const persistFailed = await moveSelectionToFragment({
      client,
      document,
      exactText: "선택 원문",
      kindId: "quote",
      manuscript: manuscriptPort({ persistDocument: secondPersist }),
      selection,
    });
    expect(persistFailed.status).toBe("captured-persist-or-refresh-failed");

    const refreshFailed = await moveSelectionToFragment({
      client: fragmentsClient({
        list: vi.fn(() => Promise.reject(new Error("refresh failed"))),
      }).client,
      document,
      exactText: "선택 원문",
      kindId: "quote",
      manuscript: manuscriptPort(),
      selection,
    });
    expect(refreshFailed.status).toBe("captured-persist-or-refresh-failed");

    const captureFailed = await moveSelectionToFragment({
      client: fragmentsClient({
        capture: vi.fn(() => Promise.reject(new Error("capture failed"))),
      }).client,
      document,
      exactText: "선택 원문",
      kindId: "quote",
      manuscript: manuscriptPort(),
      selection,
    });
    expect(captureFailed).toEqual({ status: "failed" });
  });

  it("maps every move outcome to the exact retained fragment and message", () => {
    const current = Object.freeze([fragment("old")]);
    const captured = fragment("captured");
    expect(resolveFragmentMoveState(current, {
      status: "captured-delete-failed",
      captured,
    })).toEqual({
      fragments: [captured, ...current],
      error: FRAGMENT_MESSAGES.moveDeleteFailed,
    });
    expect(resolveFragmentMoveState(current, {
      status: "captured-persist-or-refresh-failed",
      captured,
    })).toEqual({
      fragments: [captured, ...current],
      error: FRAGMENT_MESSAGES.movePersistOrRefreshFailed,
    });
    expect(resolveFragmentMoveState(current, { status: "failed" })).toEqual({
      fragments: current,
      error: FRAGMENT_MESSAGES.moveFailed,
    });
  });

  it("inserts before persist and records use only with the current revision", async () => {
    const order: string[] = [];
    const recordUse = vi.fn(async (command) => {
      order.push("recordUse");
      expect(command.expectedRevision).toBe(3);
      return fragment("insert", { revision: 4, useCount: 1 });
    });
    const port = manuscriptPort({
      insertFragmentAtCursor: vi.fn(() => {
        order.push("insert");
        return true;
      }),
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
    });
    await expect(insertFragmentAtCursor({
      client: fragmentsClient({ recordUse }).client,
      document,
      fragment: fragment("insert"),
      manuscript: port,
      selection: Object.freeze({ ...selection, anchor: 2, head: 2, empty: true }),
    })).resolves.toMatchObject({ status: "inserted" });
    expect(order).toEqual(["insert", "persist", "recordUse"]);

    const cursorChangedRecordUse = vi.fn();
    await expect(insertFragmentAtCursor({
      client: fragmentsClient({ recordUse: cursorChangedRecordUse }).client,
      document,
      fragment: fragment("cursor"),
      manuscript: manuscriptPort({ insertFragmentAtCursor: vi.fn(() => false) }),
      selection: Object.freeze({ ...selection, empty: true }),
    })).resolves.toEqual({ status: "cursor-changed" });
    expect(cursorChangedRecordUse).not.toHaveBeenCalled();

    const failedRecordUse = vi.fn();
    await expect(insertFragmentAtCursor({
      client: fragmentsClient({ recordUse: failedRecordUse }).client,
      document,
      fragment: fragment("persist"),
      manuscript: manuscriptPort({
        persistDocument: vi.fn(() => Promise.reject(new Error("persist failed"))),
      }),
      selection: Object.freeze({ ...selection, empty: true }),
    })).resolves.toEqual({ status: "persist-or-record-use-failed" });
    expect(failedRecordUse).not.toHaveBeenCalled();
  });

  it("sends optimistic revisions for update and retire", async () => {
    const update = vi.fn(async () => fragment("record", { revision: 4 }));
    const retire = vi.fn(async () => fragment("record", {
      revision: 4,
      retiredAt: "2026-08-24T01:00:00.000Z",
    }));
    const current = fragment("record", { revision: 3 });
    const client = fragmentsClient({ update, retire }).client;

    await updateFragmentRecord({
      activeWorkId: document.workId,
      changes: { pinned: true },
      client,
      fragment: current,
    });
    await retireFragmentRecord({
      activeWorkId: document.workId,
      client,
      fragment: current,
    });
    expect(update).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId: document.workId,
      fragmentId: current.fragmentId,
      expectedRevision: 3,
      changes: { pinned: true },
    });
    expect(retire).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId: document.workId,
      fragmentId: current.fragmentId,
      expectedRevision: 3,
    });
  });

  it("preserves busy, Work ownership, close gate, and navigation state", () => {
    const current = fragment("gate");
    expect(canRunFragmentDocumentAction("idle", document)).toBe(true);
    expect(canRunFragmentDocumentAction("moving", document)).toBe(false);
    expect(canInsertFragment("idle", document, current)).toBe(true);
    expect(canInsertFragment("idle", document, fragment("retired", {
      retiredAt: "2026-08-24T01:00:00.000Z",
    }))).toBe(false);
    expect(canMutateFragment("idle", document.workId, current)).toBe(true);
    expect(canMutateFragment(
      "idle",
      entityId<"Work">("work-2"),
      current,
    )).toBe(false);
    expect(closeFragmentShelfState("updating")).toBeNull();
    expect(closeFragmentShelfState("idle")).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(openFragmentShelfState()).toEqual({ dialogOpen: true, error: null });
    expect(fragmentSourceNavigationStartedState()).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(fragmentSourceNavigationCompletedState()).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(fragmentSourceNavigationFailedState("실패", false)).toEqual({
      error: "실패",
    });
    expect(fragmentSourceNavigationReopenedState()).toEqual({ dialogOpen: true });
  });

  it("keeps profile bootstrap and DocumentNavigator ownership outside the fragment controller", () => {
    const controllerSource = readFileSync(
      new URL("./useFragmentsController.ts", import.meta.url),
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
    expect(controllerSource.match(/\buseState(?:<|\()/gu)).toHaveLength(4);
    expect(storyKernelSource.match(/useFragmentsController\(/gu)).toHaveLength(1);
    expect(controllerSource).not.toContain("getProfile(");
    expect(appSource).not.toContain("window.eumStudio.fragments.getProfile()");
    expect(runtimeBootstrapSource).toContain("this.client.fragments.getProfile()");
    expect(appSource).toContain("const [runtimeBootstrapController] = useState(() =>");
    expect(appSource).toContain("new RuntimeBootstrapController(window.eumStudio)");
    expect(navigationSource).toContain("const openFragmentSource = useCallback(");
    expect(navigationSource).toContain("const result = await documentNavigator.open(");
    expect(navigationSource).toContain('kind: "exact-selection"');
    expect(appSource).not.toContain("setFragmentActionState");
    expect(appSource).not.toContain("setFragmentDialogOpen");
  });
});
