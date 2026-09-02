import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  LoreCandidateApprovalResult,
  LoreCandidateProjection,
} from "../../../application/lore/lore-candidate-contract";
import type { LoreEntryProjection } from "../../../application/lore/lore-entry-contract";
import type { LoreForeshadowLinkProjection } from "../../../application/lore/lore-foreshadow-link-contract";
import { entityId } from "../../../domain/writing";
import {
  addLoreEvidenceRecord,
  approveLoreCandidateWithRefresh,
  createLoreCandidateRecord,
  createLoreEntryRecord,
  loadCanonicalLoreEntries,
  readLoreSelection,
  rejectLoreCandidateRecord,
  retireLoreEntryWithCompatibility,
  startLoreWorkLoad,
  updateLoreEntryRecord,
  type LoreCandidatesClient,
  type LoreEntriesClient,
  type LoreLinksCompatibilityPort,
  type LoreManuscriptPort,
} from "./lore-client";
import {
  canAddLoreEvidence,
  canApproveLoreCandidate,
  canCreateLoreCandidate,
  canCreateLoreEntry,
  canMutateLoreEntry,
  canRefreshLoreCandidates,
  canRejectLoreCandidate,
  closeLoreCandidateDialogState,
  closeLoreDialogState,
  enterLoreStructureState,
  LORE_MESSAGES,
  loreNavigationFailedState,
  loreNavigationOpenedState,
  loreNavigationRejectedState,
  loreNavigationStartedState,
  loreSharedLinkFailedState,
  loreSharedLinkFinishedState,
  loreSharedLinkStartedState,
  prependLoreCandidate,
  prependLoreEntry,
  reconcileLoreCandidateApproval,
  reconcileSelectedLoreEntry,
  replaceLoreCandidate,
  replaceLoreEntry,
  resolveLoreRetirement,
} from "./lore-state";

function loreEntry(
  suffix: string,
  overrides: Partial<LoreEntryProjection> = {},
): LoreEntryProjection {
  return Object.freeze({
    schemaVersion: 1,
    loreEntryId: entityId<"LoreEntry">(`lore-${suffix}`),
    revision: 3,
    workId: entityId<"Work">("work-1"),
    title: `별빛 ${suffix}`,
    content: "내용",
    category: "분류",
    aliases: Object.freeze(["별칭"]),
    enabled: true,
    evidences: Object.freeze([]),
    history: Object.freeze([]),
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
    ...overrides,
  });
}

function loreCandidate(
  suffix: string,
  overrides: Partial<LoreCandidateProjection> = {},
): LoreCandidateProjection {
  return Object.freeze({
    schemaVersion: 1,
    candidateId: entityId<"LoreCandidate">(`candidate-${suffix}`),
    revision: 2,
    workId: entityId<"Work">("work-1"),
    source: "user",
    certainty: "explicit",
    proposal: Object.freeze({
      kind: "create",
      title: `후보 ${suffix}`,
      content: "후보 내용",
      category: "후보 분류",
      aliases: Object.freeze([]),
      enabled: true,
    }),
    evidence: Object.freeze({
      anchorId: entityId<"Anchor">(`anchor-${suffix}`),
      sourceDocumentId: entityId<"Document">("document-1"),
      sourceDocumentRevisionId: entityId<"DocumentRevision">("revision-1"),
      exactText: "선택 원문",
      integrity: "resolved",
      range: Object.freeze({ from: 2, to: 7 }),
    }),
    reason: "이유",
    status: "pending",
    approvedLoreEntryId: null,
    approvalBlockReason: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    reviewedAt: null,
    ...overrides,
  });
}

function loreLink(suffix: string): LoreForeshadowLinkProjection {
  return Object.freeze({
    schemaVersion: 1,
    linkId: entityId<"LoreForeshadowLink">(`link-${suffix}`),
    revision: 1,
    workId: entityId<"Work">("work-1"),
    loreEntryId: entityId<"LoreEntry">("lore-current"),
    lineId: entityId<"ForeshadowLine">("line-1"),
    linkedAt: "2026-08-24T00:00:00.000Z",
    unlinkedAt: null,
    unlinkReason: null,
  });
}

const document: ManuscriptDocumentSource = Object.freeze({
  workId: entityId<"Work">("work-1"),
  documentId: entityId<"Document">("document-1"),
  documentRevisionId: entityId<"DocumentRevision">("revision-1"),
  label: "회차 1",
  initialText: "앞선택 원문뒤",
});

const directionalSelection = Object.freeze({
  anchor: 6,
  head: 1,
  from: 1,
  to: 6,
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

function manuscriptPort(
  input: Partial<LoreManuscriptPort> = {},
): LoreManuscriptPort {
  return {
    readSelection: vi.fn(() => directionalSelection),
    materializeDocumentText: vi.fn(() => document.initialText),
    persistDocument: vi.fn(async () => undefined),
    ...input,
  };
}

function entriesClient(input: Partial<LoreEntriesClient> = {}) {
  const created = loreEntry("created");
  return {
    client: {
      create: vi.fn(async () => created),
      list: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        workId: document.workId,
        entries: Object.freeze([created]),
      })),
      update: vi.fn(async () => created),
      addEvidence: vi.fn(async () => created),
      retire: vi.fn(async () => loreEntry("created", {
        revision: 4,
        retiredAt: "2026-08-24T01:00:00.000Z",
      })),
      ...input,
    } as LoreEntriesClient,
    created,
  };
}

function candidatesClient(input: Partial<LoreCandidatesClient> = {}) {
  const created = loreCandidate("created");
  const approvedEntry = loreEntry("approved");
  const approvedCandidate = loreCandidate("created", {
    revision: 3,
    status: "approved",
    approvedLoreEntryId: approvedEntry.loreEntryId,
    reviewedAt: "2026-08-24T01:00:00.000Z",
  });
  return {
    client: {
      create: vi.fn(async () => created),
      list: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        workId: document.workId,
        candidates: Object.freeze([created]),
      })),
      approve: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        candidate: approvedCandidate,
        loreEntry: approvedEntry,
      })),
      reject: vi.fn(async () => loreCandidate("created", {
        revision: 3,
        status: "rejected",
        reviewedAt: "2026-08-24T01:00:00.000Z",
      })),
      ...input,
    } as LoreCandidatesClient,
    approvedCandidate,
    approvedEntry,
    created,
  };
}

function linksPort(input: Partial<LoreLinksCompatibilityPort> = {}) {
  return {
    list: vi.fn(async () => Object.freeze([loreLink("1")])),
    replace: vi.fn(),
    clear: vi.fn(),
    pruneRetiredLoreEntry: vi.fn(),
    ...input,
  } as LoreLinksCompatibilityPort;
}

describe("lore controller helpers", () => {
  it("reloads the authoritative Lore projection without Candidate mutation", async () => {
    const entries = [loreEntry("reload")];
    const client = {
      list: vi.fn(async () => ({
        schemaVersion: 1 as const,
        workId: entries[0]!.workId,
        entries,
      })),
    } as Pick<LoreEntriesClient, "list">;

    await expect(loadCanonicalLoreEntries({
      activeWorkId: entries[0]!.workId,
      client,
    })).resolves.toEqual(entries);
  });

  it("delays reset and atomically loads entries, Candidates, and links", async () => {
    let scheduled: (() => void) | null = null;
    const cancel = vi.fn();
    const onReset = vi.fn();
    const disposeReset = startLoreWorkLoad({
      activeWorkId: null,
      candidatesClient: candidatesClient().client,
      entriesClient: entriesClient().client,
      links: linksPort(),
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

    const entryList = deferred<
      Awaited<ReturnType<LoreEntriesClient["list"]>>
    >();
    const candidateList = deferred<
      Awaited<ReturnType<LoreCandidatesClient["list"]>>
    >();
    const linkList = deferred<readonly LoreForeshadowLinkProjection[]>();
    const onLoaded = vi.fn();
    startLoreWorkLoad({
      activeWorkId: document.workId,
      entriesClient: entriesClient({
        list: vi.fn(() => entryList.promise),
      }).client,
      candidatesClient: candidatesClient({
        list: vi.fn(() => candidateList.promise),
      }).client,
      links: linksPort({ list: vi.fn(() => linkList.promise) }),
      onFailed: vi.fn(),
      onLoaded,
      onReset: vi.fn(),
    });
    entryList.resolve(Object.freeze({
      schemaVersion: 1,
      workId: document.workId,
      entries: Object.freeze([loreEntry("loaded")]),
    }));
    candidateList.resolve(Object.freeze({
      schemaVersion: 1,
      workId: document.workId,
      candidates: Object.freeze([loreCandidate("loaded")]),
    }));
    await Promise.resolve();
    expect(onLoaded).not.toHaveBeenCalled();
    linkList.resolve(Object.freeze([loreLink("loaded")]));
    await Promise.all([entryList.promise, candidateList.promise, linkList.promise]);
    await Promise.resolve();
    expect(onLoaded).toHaveBeenCalledWith(
      [loreEntry("loaded")],
      [loreCandidate("loaded")],
      [loreLink("loaded")],
    );
  });

  it("disposes stale three-way loads and reports one all-or-error failure", async () => {
    const entries = deferred<Awaited<ReturnType<LoreEntriesClient["list"]>>>();
    const candidates = deferred<
      Awaited<ReturnType<LoreCandidatesClient["list"]>>
    >();
    const links = deferred<readonly LoreForeshadowLinkProjection[]>();
    const onLoaded = vi.fn();
    const dispose = startLoreWorkLoad({
      activeWorkId: document.workId,
      entriesClient: entriesClient({ list: vi.fn(() => entries.promise) }).client,
      candidatesClient: candidatesClient({
        list: vi.fn(() => candidates.promise),
      }).client,
      links: linksPort({ list: vi.fn(() => links.promise) }),
      onFailed: vi.fn(),
      onLoaded,
      onReset: vi.fn(),
    });
    dispose();
    entries.resolve(Object.freeze({
      schemaVersion: 1,
      workId: document.workId,
      entries: Object.freeze([]),
    }));
    candidates.resolve(Object.freeze({
      schemaVersion: 1,
      workId: document.workId,
      candidates: Object.freeze([]),
    }));
    links.resolve(Object.freeze([]));
    await Promise.all([entries.promise, candidates.promise, links.promise]);
    await Promise.resolve();
    expect(onLoaded).not.toHaveBeenCalled();

    const onFailed = vi.fn();
    startLoreWorkLoad({
      activeWorkId: document.workId,
      entriesClient: entriesClient({
        list: vi.fn(() => Promise.reject(new Error("load failed"))),
      }).client,
      candidatesClient: candidatesClient().client,
      links: linksPort(),
      onFailed,
      onLoaded: vi.fn(),
      onReset: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(onFailed).toHaveBeenCalledOnce();
  });

  it("reconciles selection and preserves canonical collection boundaries", () => {
    const first = loreEntry("first");
    const second = loreEntry("second");
    expect(reconcileSelectedLoreEntry(second.loreEntryId, [first, second]))
      .toBe(second.loreEntryId);
    expect(reconcileSelectedLoreEntry("missing", [first, second]))
      .toBe(first.loreEntryId);
    expect(prependLoreEntry([first], second)).toEqual([second, first]);
    expect(replaceLoreEntry([first], loreEntry("first", { revision: 4 })))
      .toEqual([loreEntry("first", { revision: 4 })]);
  });

  it("persists directional evidence before canonical create and add commands", async () => {
    const order: string[] = [];
    const manuscript = manuscriptPort({
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
    });
    const read = readLoreSelection(document, manuscript);
    expect(read).toMatchObject({
      status: "ready",
      exactText: "선택 원문",
      selection: { anchor: 6, head: 1 },
    });
    if (read.status !== "ready") throw new Error("Expected exact selection");
    const create = vi.fn(async (command) => {
      order.push("create");
      expect(command.evidence?.selection).toEqual({ anchor: 6, head: 1 });
      return loreEntry("created");
    });
    await createLoreEntryRecord({
      activeWorkId: document.workId,
      client: entriesClient({ create }).client,
      draft: {
        title: "새 별빛",
        content: "내용",
        category: "분류",
        aliases: Object.freeze([]),
        enabled: true,
        includeCurrentSelection: true,
      },
      evidence: {
        documentId: document.documentId,
        selection: { anchor: 6, head: 1 },
        exactText: read.exactText,
      },
      persistence: { document, manuscript },
    });
    expect(order).toEqual(["persist", "create"]);

    order.length = 0;
    const addEvidence = vi.fn(async (command) => {
      order.push("addEvidence");
      expect(command.expectedRevision).toBe(3);
      expect(command.selection).toEqual({ anchor: 6, head: 1 });
      return loreEntry("current", { revision: 4 });
    });
    await addLoreEvidenceRecord({
      client: entriesClient({ addEvidence }).client,
      document,
      entry: loreEntry("current"),
      exactText: read.exactText,
      manuscript,
      selection: read.selection,
    });
    expect(order).toEqual(["persist", "addEvidence"]);
  });

  it("sends exact update/retire revisions and prunes only after refresh failure", async () => {
    const current = loreEntry("current");
    const update = vi.fn(async () => loreEntry("current", { revision: 4 }));
    await updateLoreEntryRecord({
      activeWorkId: document.workId,
      changes: { content: "변경" },
      client: entriesClient({ update }).client,
      entry: current,
    });
    expect(update).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId: document.workId,
      loreEntryId: current.loreEntryId,
      expectedRevision: 3,
      changes: { content: "변경" },
    });

    const order: string[] = [];
    const retired = loreEntry("current", {
      revision: 4,
      retiredAt: "2026-08-24T01:00:00.000Z",
    });
    const partial = await retireLoreEntryWithCompatibility({
      activeWorkId: document.workId,
      client: entriesClient({
        retire: vi.fn(async (command) => {
          order.push("retire");
          expect(command.expectedRevision).toBe(3);
          return retired;
        }),
      }).client,
      entry: current,
      links: linksPort({
        list: vi.fn(async () => {
          order.push("refresh");
          throw new Error("refresh failed");
        }),
        pruneRetiredLoreEntry: vi.fn(() => {
          order.push("prune");
        }),
      }),
      onRetired: () => {
        order.push("remove");
      },
    });
    expect(partial.status).toBe("retired-link-refresh-failed");
    expect(order).toEqual(["retire", "remove", "refresh", "prune"]);
    expect(resolveLoreRetirement(
      [current, loreEntry("other")],
      current.loreEntryId,
      retired,
    )).toEqual({
      entries: [loreEntry("other")],
      selectedEntryId: loreEntry("other").loreEntryId,
    });
    expect(LORE_MESSAGES.retireLinkRefreshFailed).toBe(
      "별빛은 치웠지만 복선 연결 목록을 새로 읽지 못했습니다.",
    );
  });

  it("keeps exact Candidate creation noncanonical until approval", async () => {
    const order: string[] = [];
    const manuscript = manuscriptPort({
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
    });
    const create = vi.fn(async (command) => {
      order.push("createCandidate");
      expect(command.source).toBe("user");
      expect(command.certainty).toBe("explicit");
      expect(command.selection).toEqual({ anchor: 6, head: 1 });
      return loreCandidate("created");
    });
    const canonicalBefore = Object.freeze([loreEntry("existing")]);
    const created = await createLoreCandidateRecord({
      client: candidatesClient({ create }).client,
      document,
      draft: {
        proposal: loreCandidate("draft").proposal,
        reason: "이유",
      },
      exactText: "선택 원문",
      manuscript,
      selection: directionalSelection,
    });
    const candidates = prependLoreCandidate([], created);
    expect(order).toEqual(["persist", "createCandidate"]);
    expect(candidates).toEqual([created]);
    expect(canonicalBefore).toEqual([loreEntry("existing")]);
  });

  it("reconciles approval twice, preserves its error through refresh failure, and rejects only Candidate", async () => {
    const currentCandidate = loreCandidate("created");
    const { approvedCandidate, approvedEntry } = candidatesClient();
    const result: LoreCandidateApprovalResult = Object.freeze({
      schemaVersion: 1,
      candidate: approvedCandidate,
      loreEntry: approvedEntry,
    });
    expect(reconcileLoreCandidateApproval(
      [loreEntry("existing")],
      [currentCandidate],
      result,
    )).toEqual({
      candidates: [approvedCandidate],
      entries: [approvedEntry, loreEntry("existing")],
      selectedEntryId: approvedEntry.loreEntryId,
    });

    const approve = vi.fn(async () => result);
    await expect(approveLoreCandidateWithRefresh({
      activeWorkId: document.workId,
      candidate: currentCandidate,
      client: candidatesClient({ approve }).client,
    })).resolves.toMatchObject({ status: "approved", result });
    expect(approve).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId: document.workId,
      candidateId: currentCandidate.candidateId,
      expectedRevision: 2,
    });

    const failed = await approveLoreCandidateWithRefresh({
      activeWorkId: document.workId,
      candidate: currentCandidate,
      client: candidatesClient({
        approve: vi.fn(() => Promise.reject(new Error("approval failed"))),
        list: vi.fn(() => Promise.reject(new Error("refresh failed"))),
      }).client,
    });
    expect(failed).toEqual({ status: "failed", refreshedCandidates: null });

    const reject = vi.fn(async () => Object.freeze({
      ...currentCandidate,
      revision: 3,
      status: "rejected",
    }));
    const rejected = await rejectLoreCandidateRecord({
      activeWorkId: document.workId,
      candidate: currentCandidate,
      client: candidatesClient({ reject }).client,
    });
    expect(replaceLoreCandidate([currentCandidate], rejected)).toEqual([rejected]);
    expect(reject).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId: document.workId,
      candidateId: currentCandidate.candidateId,
      expectedRevision: 2,
    });
  });

  it("preserves independent gates, shared-link state, and both navigation surfaces", () => {
    const entry = loreEntry("current");
    const candidate = loreCandidate("current");
    expect(canCreateLoreEntry("idle", document.workId)).toBe(true);
    expect(canMutateLoreEntry("idle", document.workId, entry)).toBe(true);
    expect(canAddLoreEvidence("idle", document, entry)).toBe(true);
    expect(canRefreshLoreCandidates("idle", document.workId)).toBe(true);
    expect(canCreateLoreCandidate("idle", document.workId, document)).toBe(true);
    expect(canApproveLoreCandidate("idle", document.workId, candidate)).toBe(true);
    expect(canRejectLoreCandidate("idle", document.workId, candidate)).toBe(true);
    expect(canCreateLoreEntry("creating", document.workId)).toBe(false);
    expect(canRefreshLoreCandidates("creating", document.workId)).toBe(false);
    expect(closeLoreDialogState("updating")).toBeNull();
    expect(closeLoreDialogState("idle")).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(closeLoreCandidateDialogState("approving")).toBeNull();
    expect(enterLoreStructureState()).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(loreSharedLinkStartedState("linking-foreshadow")).toEqual({
      actionState: "linking-foreshadow",
      error: null,
    });
    expect(loreSharedLinkFailedState("실패")).toEqual({ error: "실패" });
    expect(loreSharedLinkFinishedState()).toEqual({ actionState: "idle" });
    expect(loreNavigationRejectedState("실패")).toEqual({ error: "실패" });
    expect(loreNavigationStartedState()).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(loreNavigationOpenedState()).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(loreNavigationFailedState("실패", false)).toEqual({ error: "실패" });
    expect(loreNavigationFailedState("실패", true)).toEqual({
      dialogOpen: true,
      error: "실패",
    });
  });

  it("keeps lore state in its controller and shared links, cues, and navigation in their slices", () => {
    const controllerSource = readFileSync(
      new URL("./useLoreController.ts", import.meta.url),
      "utf8",
    );
    const appSource = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
    const coreSource = readFileSync(
      new URL("../../workspace/useWorkspaceCoreFeatureKernel.ts", import.meta.url),
      "utf8",
    );
    const cueSource = readFileSync(
      new URL("./useLoreCueController.ts", import.meta.url),
      "utf8",
    );
    const navigationSource = readFileSync(
      new URL("../../workspace/navigation/useWorkspaceFeatureNavigationController.ts", import.meta.url),
      "utf8",
    );

    expect(controllerSource).not.toContain("window.");
    expect(controllerSource.match(/\buseState(?:<|\()/gu)).toHaveLength(9);
    expect(coreSource.match(/useLoreController\(/gu)).toHaveLength(1);
    expect(coreSource).toContain("links: loreLinksCompatibility");
    expect(coreSource).toContain("useLoreCueController(");
    expect(cueSource).toContain("const [hoveredLoreCue, setHoveredLoreCue]");
    expect(navigationSource).toContain("const openLoreEntryEvidence = useCallback(");
    expect(navigationSource).toContain("const openLoreCandidateEvidence = useCallback(");
    expect(navigationSource).toContain('if (result.status === "superseded") return;');
    expect(appSource).not.toContain("setLoreEntries");
    expect(appSource).not.toContain("setLoreCandidates");
    expect(appSource).not.toContain("setLoreActionState");
    expect(appSource).not.toContain("setLoreCandidateActionState");
  });
});
