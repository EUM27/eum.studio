import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { ChatGptOAuthConnectionStatus } from "../../../application/assistant/chatgpt-oauth";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { CharacterProjection } from "../../../application/characters/character-contract";
import type {
  CharacterExtractionCandidate,
  CharacterExtractionDecisionResult,
  CharacterExtractionItem,
} from "../../../application/characters/character-extraction-contract";
import type {
  CharacterGenerationCandidate,
  CharacterGenerationDecisionResult,
  CharacterGenerationItem,
} from "../../../application/characters/character-generation-contract";
import type { CharacterRelationProjection } from "../../../application/characters/character-relation-contract";
import { entityId } from "../../../domain/writing";
import {
  addCharacterEvidenceRecord,
  captureCharacterWorkspaceSelectionThroughPort,
  createCharacterRecord,
  createCharacterRelationRecord,
  decideCharacterExtractionItemRecord,
  decideCharacterGenerationItemRecord,
  grantCharacterExtractionPermissionRecord,
  retireCharacterRecord,
  retireCharacterRelationRecord,
  runCharacterExtractionRecord,
  runCharacterGenerationRecord,
  startCharactersWorkLoad,
  updateCharacterRecord,
  updateCharacterRelationRecord,
  type CharactersAssistantClient,
  type CharactersClient,
  type CharactersManuscriptPort,
} from "./characters-client";
import {
  canAddCharacterEvidence,
  canCreateCharacter,
  canDecideCharacterExtraction,
  canDecideCharacterGeneration,
  canMutateCharacter,
  canMutateCharacterRelation,
  canRunCharacterGeneration,
  characterEvidenceNavigationActivationState,
  characterEvidenceNavigationFailedState,
  characterEvidenceNavigationIdleState,
  characterEvidenceNavigationOpenedState,
  characterEvidenceNavigationRejectedState,
  characterEvidenceNavigationVisibleState,
  CHARACTER_MESSAGES,
  closeCharacterDialogState,
  focusCharacterInStructureState,
  openCharacterDialogState,
  prependCharacter,
  prependCharacterEvidenceUpdate,
  prependCharacterExtractionCandidate,
  prependCharacterGenerationCandidate,
  prependCharacterRelation,
  reconcileCharacterExtractionDecision,
  reconcileCharacterGenerationDecision,
  reconcileSelectedCharacter,
  replaceCharacter,
  replaceCharacterRelation,
  resolveCharacterExtractionRunResult,
  resolveCharacterGenerationRunResult,
  resolveCharacterRetirement,
} from "./characters-state";

const workId = entityId<"Work">("work-characters");
const documentId = entityId<"Document">("document-characters");
const documentRevisionId = entityId<"DocumentRevision">(
  "revision-characters",
);
const conversationId = entityId<"AssistantConversation">(
  "conversation-characters",
);

const document: ManuscriptDocumentSource = Object.freeze({
  workId,
  documentId,
  documentRevisionId,
  label: "인물 회차",
  initialText: "인물 선택 원문",
});

function character(
  suffix: string,
  overrides: Partial<CharacterProjection> = {},
): CharacterProjection {
  return Object.freeze({
    schemaVersion: 1,
    characterId: entityId<"Character">(`character-${suffix}`),
    revision: 3,
    workId,
    name: `인물 ${suffix}`,
    aliases: Object.freeze([]),
    role: "역할",
    summary: "요약",
    appearance: "외형",
    personality: "성격",
    speech: "말투",
    goal: "목표",
    conflict: "갈등",
    note: "메모",
    evidences: Object.freeze([]),
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
    ...overrides,
  });
}

function relation(
  suffix: string,
  overrides: Partial<CharacterRelationProjection> = {},
): CharacterRelationProjection {
  return Object.freeze({
    schemaVersion: 1,
    relationId: entityId<"CharacterRelation">(`relation-${suffix}`),
    revision: 4,
    workId,
    fromCharacterId: entityId<"Character">("character-current"),
    toCharacterId: entityId<"Character">("character-other"),
    kind: "동료",
    description: "관계",
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
    retirementReason: null,
    ...overrides,
  });
}

function extractionItem(
  suffix: string,
  overrides: Partial<CharacterExtractionItem> = {},
): CharacterExtractionItem {
  return Object.freeze({
    itemId: entityId<"CharacterExtractionItem">(`extraction-item-${suffix}`),
    name: `추출 ${suffix}`,
    aliases: Object.freeze([]),
    role: "역할",
    summary: "요약",
    appearance: "외형",
    personality: "성격",
    speech: "말투",
    goal: "목표",
    conflict: "갈등",
    note: "메모",
    evidences: Object.freeze([]),
    matchingCharacterIds: Object.freeze([]),
    status: "pending",
    approvedCharacterId: null,
    ...overrides,
  });
}

function extractionCandidate(
  suffix: string,
  overrides: Partial<CharacterExtractionCandidate> = {},
): CharacterExtractionCandidate {
  return Object.freeze({
    schemaVersion: 1,
    candidateId: entityId<"CharacterExtractionCandidate">(
      `extraction-candidate-${suffix}`,
    ),
    revision: 5,
    workId,
    sourceRange: Object.freeze({
      documentId,
      documentRevisionId,
      from: 2,
      to: 7,
    }),
    providerId: "provider-runtime",
    modelId: "model-runtime",
    promptVersion: "character-extraction-v1",
    status: "ready",
    items: Object.freeze([extractionItem(suffix)]),
    contextReceiptId: entityId<"AssistantContextReceipt">(
      `receipt-${suffix}`,
    ),
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  });
}

function generationItem(
  suffix: string,
  overrides: Partial<CharacterGenerationItem> = {},
): CharacterGenerationItem {
  return Object.freeze({
    itemId: entityId<"CharacterGenerationItem">(`generation-item-${suffix}`),
    name: `생성 ${suffix}`,
    aliases: Object.freeze([]),
    role: "역할",
    summary: "요약",
    appearance: "외형",
    personality: "성격",
    speech: "말투",
    goal: "목표",
    conflict: "갈등",
    note: "메모",
    matchingCharacterIds: Object.freeze([]),
    status: "pending",
    approvedCharacterId: null,
    ...overrides,
  });
}

function generationCandidate(
  suffix: string,
  overrides: Partial<CharacterGenerationCandidate> = {},
): CharacterGenerationCandidate {
  return Object.freeze({
    schemaVersion: 1,
    candidateId: entityId<"CharacterGenerationCandidate">(
      `generation-candidate-${suffix}`,
    ),
    revision: 6,
    workId,
    brief: Object.freeze({
      role: "역할",
      personality: "성격",
      relationships: "관계",
      genre: "장르",
    }),
    providerId: "provider-runtime",
    modelId: "model-runtime",
    promptVersion: "character-generation-v1",
    status: "ready",
    items: Object.freeze([generationItem(suffix)]),
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  });
}

const oauthStatus: ChatGptOAuthConnectionStatus = Object.freeze({
  schemaVersion: 1,
  revision: 2,
  providerId: "provider-runtime",
  displayName: "연결",
  modelId: "model-runtime",
  connected: true,
  email: null,
  planType: null,
  updatedAt: "2026-08-24T00:00:00.000Z",
});

function charactersClient(input: Partial<CharactersClient> = {}) {
  const currentCharacter = character("current");
  const currentRelation = relation("current");
  const currentExtractionCandidate = extractionCandidate("current");
  const currentGenerationCandidate = generationCandidate("current");
  return {
    client: {
      create: vi.fn(async () => currentCharacter),
      list: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        workId,
        characters: Object.freeze([currentCharacter]),
      })),
      update: vi.fn(async () => currentCharacter),
      addEvidence: vi.fn(async () => currentCharacter),
      retire: vi.fn(async () => currentCharacter),
      createRelation: vi.fn(async () => currentRelation),
      listRelations: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        workId,
        relations: Object.freeze([currentRelation]),
      })),
      updateRelation: vi.fn(async () => currentRelation),
      retireRelation: vi.fn(async () => currentRelation),
      runExtraction: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        status: "candidate" as const,
        candidate: currentExtractionCandidate,
      })),
      listExtractionCandidates: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        workId,
        candidates: Object.freeze([currentExtractionCandidate]),
      })),
      decideExtractionItem: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        status: "applied" as const,
        candidate: currentExtractionCandidate,
        characters: Object.freeze([currentCharacter]),
      })),
      runGeneration: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        status: "candidate" as const,
        candidate: currentGenerationCandidate,
      })),
      listGenerationCandidates: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        workId,
        candidates: Object.freeze([currentGenerationCandidate]),
      })),
      decideGenerationItem: vi.fn(async () => Object.freeze({
        schemaVersion: 1 as const,
        status: "applied" as const,
        candidate: currentGenerationCandidate,
        characters: Object.freeze([currentCharacter]),
      })),
      ...input,
    } as CharactersClient,
    currentCharacter,
    currentExtractionCandidate,
    currentGenerationCandidate,
    currentRelation,
  };
}

function assistantClient(input: Partial<CharactersAssistantClient> = {}) {
  return {
    getChatGptOAuthStatus: vi.fn(async () => oauthStatus),
    grantContextPermission: vi.fn(async () => undefined),
    ...input,
  } as unknown as CharactersAssistantClient;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("characters controller helpers", () => {
  it("delays null reset and publishes the five-way load only after every read", async () => {
    let scheduled: (() => void) | null = null;
    const cancel = vi.fn();
    const onReset = vi.fn();
    const disposeReset = startCharactersWorkLoad({
      activeWorkId: null,
      assistantClient: assistantClient(),
      client: charactersClient().client,
      onFailed: vi.fn(),
      onLoaded: vi.fn(),
      onReset,
      timer: {
        schedule: (callback, delayMs) => {
          expect(delayMs).toBe(0);
          scheduled = callback;
          return "character-reset";
        },
        cancel,
      },
    });
    expect(onReset).not.toHaveBeenCalled();
    (scheduled as unknown as () => void)();
    expect(onReset).toHaveBeenCalledOnce();
    disposeReset();
    expect(cancel).toHaveBeenCalledWith("character-reset");

    const oauthDeferred = deferred<ChatGptOAuthConnectionStatus>();
    const fixtures = charactersClient();
    const onLoaded = vi.fn();
    startCharactersWorkLoad({
      activeWorkId: workId,
      assistantClient: assistantClient({
        getChatGptOAuthStatus: vi.fn(() => oauthDeferred.promise),
      }),
      client: fixtures.client,
      onFailed: vi.fn(),
      onLoaded,
      onReset: vi.fn(),
    });
    await Promise.resolve();
    expect(onLoaded).not.toHaveBeenCalled();
    oauthDeferred.resolve(oauthStatus);
    await oauthDeferred.promise;
    await Promise.resolve();
    expect(onLoaded).toHaveBeenCalledWith(
      [fixtures.currentCharacter],
      [fixtures.currentRelation],
      [fixtures.currentExtractionCandidate],
      [fixtures.currentGenerationCandidate],
      oauthStatus,
    );
  });

  it("keeps failed and disposed five-way loads from publishing OAuth", async () => {
    const failed = vi.fn();
    const loaded = vi.fn();
    const rejected = Promise.reject(new Error("relations failed"));
    rejected.catch(() => undefined);
    startCharactersWorkLoad({
      activeWorkId: workId,
      assistantClient: assistantClient(),
      client: charactersClient({
        listRelations: vi.fn(() => rejected),
      }).client,
      onFailed: failed,
      onLoaded: loaded,
      onReset: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(failed).toHaveBeenCalledOnce();
    expect(loaded).not.toHaveBeenCalled();

    const listDeferred = deferred<Awaited<
      ReturnType<CharactersClient["list"]>
    >>();
    const disposedLoaded = vi.fn();
    const fixtures = charactersClient({
      list: vi.fn(() => listDeferred.promise),
    });
    const dispose = startCharactersWorkLoad({
      activeWorkId: workId,
      assistantClient: assistantClient(),
      client: fixtures.client,
      onFailed: vi.fn(),
      onLoaded: disposedLoaded,
      onReset: vi.fn(),
    });
    dispose();
    listDeferred.resolve(Object.freeze({
      schemaVersion: 1,
      workId,
      characters: Object.freeze([fixtures.currentCharacter]),
    }));
    await listDeferred.promise;
    await Promise.resolve();
    expect(disposedLoaded).not.toHaveBeenCalled();
  });

  it("preserves canonical and relation gates, revisions, and retirement pruning", async () => {
    const current = character("current");
    const other = character("other");
    const touching = relation("touching");
    const unrelated = relation("unrelated", {
      relationId: entityId<"CharacterRelation">("relation-unrelated"),
      fromCharacterId: other.characterId,
      toCharacterId: entityId<"Character">("character-third"),
    });
    expect(canCreateCharacter(workId, "idle", "idle")).toBe(true);
    expect(canCreateCharacter(workId, "creating", "idle")).toBe(false);
    expect(canCreateCharacter(workId, "idle", "creating")).toBe(false);
    expect(canMutateCharacter(workId, "idle", "idle", current)).toBe(true);
    expect(canMutateCharacterRelation(workId, "idle", touching)).toBe(true);
    expect(canMutateCharacterRelation(workId, "updating", touching)).toBe(false);

    const create = vi.fn(async () => current);
    const update = vi.fn(async () => current);
    const retire = vi.fn(async () => Object.freeze({
      ...current,
      revision: 4,
      retiredAt: "2026-08-24T01:00:00.000Z",
    }));
    const client = charactersClient({ create, update, retire }).client;
    await createCharacterRecord({
      activeWorkId: workId,
      client,
      draft: {
        name: "인물",
        aliases: Object.freeze(["별칭"]),
        role: "역할",
        summary: "요약",
        appearance: "외형",
        personality: "성격",
        speech: "말투",
        goal: "목표",
        conflict: "갈등",
        note: "메모",
      },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 1,
      workId,
      name: "인물",
    }));
    await updateCharacterRecord({
      activeWorkId: workId,
      changes: { role: "새 역할" },
      character: current,
      client,
    });
    expect(update).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      characterId: current.characterId,
      expectedRevision: 3,
      changes: { role: "새 역할" },
    });
    await retireCharacterRecord({ activeWorkId: workId, character: current, client });
    expect(retire).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      characterId: current.characterId,
      expectedRevision: 3,
    });

    expect(prependCharacter([other], current)).toEqual([current, other]);
    expect(replaceCharacter([current], { ...current, revision: 4 })).toEqual([
      { ...current, revision: 4 },
    ]);
    expect(reconcileSelectedCharacter("missing", [current])).toBe(
      current.characterId,
    );
    expect(resolveCharacterRetirement({
      characters: [current, other],
      relations: [touching, unrelated],
      retired: current,
      selectedCharacterId: current.characterId,
    })).toEqual({
      characters: [other],
      relations: [unrelated],
      selectedCharacterId: other.characterId,
    });
  });

  it("preserves relation command fields and exact expected revisions", async () => {
    const current = character("current");
    const currentRelation = relation("current");
    const createRelation = vi.fn(async () => currentRelation);
    const updateRelation = vi.fn(async () => currentRelation);
    const retireRelation = vi.fn(async () => currentRelation);
    const client = charactersClient({
      createRelation,
      updateRelation,
      retireRelation,
    }).client;
    await createCharacterRelationRecord({
      activeWorkId: workId,
      character: current,
      client,
      draft: {
        toCharacterId: "character-other",
        kind: "동료",
        description: "설명",
      },
    });
    expect(createRelation).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      fromCharacterId: current.characterId,
      toCharacterId: entityId<"Character">("character-other"),
      kind: "동료",
      description: "설명",
    });
    await updateCharacterRelationRecord({
      activeWorkId: workId,
      changes: { description: "변경" },
      client,
      relation: currentRelation,
    });
    expect(updateRelation).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      relationId: currentRelation.relationId,
      expectedRevision: 4,
      changes: { description: "변경" },
    });
    await retireCharacterRelationRecord({
      activeWorkId: workId,
      client,
      relation: currentRelation,
    });
    expect(retireRelation).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      relationId: currentRelation.relationId,
      expectedRevision: 4,
    });
    expect(prependCharacterRelation([], currentRelation)).toEqual([
      currentRelation,
    ]);
    expect(replaceCharacterRelation(
      [currentRelation],
      { ...currentRelation, revision: 5 },
    )).toEqual([{ ...currentRelation, revision: 5 }]);
  });

  it("persists selection before reading the current revision and reuses it for manual evidence", async () => {
    const order: string[] = [];
    const manuscript: CharactersManuscriptPort = {
      readSelection: vi.fn(() => {
        order.push("selection");
        return Object.freeze({ from: 2, to: 7, empty: false });
      }),
      persist: vi.fn(async () => {
        order.push("persist");
      }),
      currentRevisionId: vi.fn(() => {
        order.push("revision");
        return entityId<"DocumentRevision">("revision-after-persist");
      }),
    };
    const captured = await captureCharacterWorkspaceSelectionThroughPort(
      document,
      manuscript,
    );
    expect(order).toEqual(["selection", "persist", "revision"]);
    expect(captured).toEqual({
      status: "captured",
      selection: {
        documentId,
        documentTitle: document.label,
        documentRevisionId: entityId<"DocumentRevision">(
          "revision-after-persist",
        ),
        from: 2,
        to: 7,
      },
    });
    if (captured.status !== "captured") throw new Error("capture expected");
    const addEvidence = vi.fn(async () => character("updated"));
    await addCharacterEvidenceRecord({
      activeWorkId: workId,
      character: character("current"),
      client: charactersClient({ addEvidence }).client,
      selection: captured.selection,
    });
    expect(addEvidence).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      characterId: entityId<"Character">("character-current"),
      expectedRevision: 3,
      documentId,
      documentRevisionId: entityId<"DocumentRevision">(
        "revision-after-persist",
      ),
      selection: { anchor: 2, head: 7 },
    });
    expect(canAddCharacterEvidence(
      workId,
      "idle",
      character("current"),
      true,
    )).toBe(true);
    const outsideWorkCharacter = character("outside", {
      workId: entityId<"Work">("work-outside"),
    });
    expect(prependCharacterEvidenceUpdate(
      [outsideWorkCharacter],
      character("updated"),
    )).toEqual([character("updated"), outsideWorkCharacter]);
    expect(await captureCharacterWorkspaceSelectionThroughPort(document, {
      ...manuscript,
      persist: vi.fn(() => Promise.reject(new Error("save failed"))),
    })).toEqual({ status: "persist-failed" });
  });

  it("keeps extraction result-driven and reconciles stale and applied decisions", async () => {
    const currentCandidate = extractionCandidate("current");
    const currentItem = currentCandidate.items[0]!;
    const runExtraction = vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      status: "candidate" as const,
      candidate: currentCandidate,
    }));
    await runCharacterExtractionRecord({
      activeWorkId: workId,
      client: charactersClient({ runExtraction }).client,
      conversationId,
      requestId: entityId<"CharacterExtractionRequest">("request-runtime"),
      selection: {
        documentId,
        documentTitle: document.label,
        documentRevisionId,
        from: 2,
        to: 7,
      },
    });
    expect(runExtraction).toHaveBeenCalledWith({
      schemaVersion: 1,
      requestId: entityId<"CharacterExtractionRequest">("request-runtime"),
      workId,
      conversationId,
      sourceRange: { documentId, documentRevisionId, from: 2, to: 7 },
    });
    expect(resolveCharacterExtractionRunResult({
      schemaVersion: 1,
      status: "login-required",
    })).toEqual({
      status: "login-required",
      error: CHARACTER_MESSAGES.oauthRequired,
    });
    expect(resolveCharacterExtractionRunResult({
      schemaVersion: 1,
      status: "permission-required",
      missing: Object.freeze([]),
      destinationId: "destination-runtime",
    })).toEqual({
      status: "permission-required",
      destinationId: "destination-runtime",
      permissionRequired: true,
    });
    expect(resolveCharacterExtractionRunResult({
      schemaVersion: 1,
      status: "context-rejected",
      reason: "stale-context",
      documentId,
    })).toEqual({
      status: "context-rejected",
      error: CHARACTER_MESSAGES.extractionStaleContext,
    });
    expect(resolveCharacterExtractionRunResult({
      schemaVersion: 1,
      status: "candidate",
      candidate: currentCandidate,
    })).toEqual({
      status: "candidate",
      candidate: currentCandidate,
      destinationId: null,
      permissionRequired: false,
    });

    const grant = vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      grantId: entityId<"AssistantContextPermissionGrant">(
        "character-grant-runtime",
      ),
      revision: 1,
      workId,
      conversationId,
      capability: "character.extract" as const,
      destinationId: "destination-runtime",
      localScope: "selection" as const,
      externalScope: "selection" as const,
      duration: "once" as const,
      createdAt: "2026-08-24T00:00:00.000Z",
      revokedAt: null,
      consumedAt: null,
    }));
    await grantCharacterExtractionPermissionRecord({
      activeWorkId: workId,
      assistantClient: assistantClient({ grantContextPermission: grant }),
      conversationId,
      destinationId: "destination-runtime",
    });
    expect(grant).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      conversationId,
      capability: "character.extract",
      destinationId: "destination-runtime",
      localScope: "selection",
      externalScope: "selection",
      duration: "once",
    });

    const decision = Object.freeze({
      kind: "merge" as const,
      targetCharacterId: entityId<"Character">("character-current"),
      expectedCharacterRevision: 3,
      fields: Object.freeze(["summary" as const, "goal" as const]),
    });
    const decideExtractionItem = vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      status: "stale" as const,
      candidate: currentCandidate,
    }));
    await decideCharacterExtractionItemRecord({
      activeWorkId: workId,
      candidate: currentCandidate,
      client: charactersClient({ decideExtractionItem }).client,
      decision,
      item: currentItem,
    });
    expect(decideExtractionItem).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      candidateId: currentCandidate.candidateId,
      expectedCandidateRevision: 5,
      itemId: currentItem.itemId,
      decision,
    });
    const existing = character("existing");
    const stale: CharacterExtractionDecisionResult = Object.freeze({
      schemaVersion: 1,
      status: "stale",
      candidate: currentCandidate,
    });
    expect(reconcileCharacterExtractionDecision({
      characters: [existing],
      currentSelectedCharacterId: existing.characterId,
      itemId: currentItem.itemId,
      result: stale,
    })).toEqual({
      characters: [existing],
      selectedCharacterId: existing.characterId,
      error: CHARACTER_MESSAGES.extractionCandidateStale,
    });
    const approved = character("approved");
    const approvedCandidate = extractionCandidate("current", {
      revision: 6,
      items: Object.freeze([extractionItem("current", {
        status: "merged",
        approvedCharacterId: approved.characterId,
      })]),
    });
    const applied: CharacterExtractionDecisionResult = Object.freeze({
      schemaVersion: 1,
      status: "applied",
      candidate: approvedCandidate,
      characters: Object.freeze([approved]),
    });
    expect(reconcileCharacterExtractionDecision({
      characters: [existing],
      currentSelectedCharacterId: existing.characterId,
      itemId: approvedCandidate.items[0]!.itemId,
      result: applied,
    })).toEqual({
      characters: [approved],
      selectedCharacterId: approved.characterId,
      error: null,
    });
    expect(prependCharacterExtractionCandidate([], currentCandidate)).toEqual([
      currentCandidate,
    ]);
    expect(canDecideCharacterExtraction(workId, "idle", currentCandidate)).toBe(
      true,
    );
  });

  it("preserves generation request and exact decision reconciliation", async () => {
    const candidate = generationCandidate("current");
    const item = candidate.items[0]!;
    const runGeneration = vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      status: "candidate" as const,
      candidate,
    }));
    await runCharacterGenerationRecord({
      activeWorkId: workId,
      brief: candidate.brief,
      client: charactersClient({ runGeneration }).client,
      requestId: entityId<"CharacterGenerationRequest">("generation-runtime"),
    });
    expect(runGeneration).toHaveBeenCalledWith({
      schemaVersion: 1,
      requestId: entityId<"CharacterGenerationRequest">("generation-runtime"),
      workId,
      brief: candidate.brief,
    });
    expect(resolveCharacterGenerationRunResult({
      schemaVersion: 1,
      status: "login-required",
    })).toEqual({
      status: "login-required",
      error: CHARACTER_MESSAGES.oauthRequired,
    });
    expect(resolveCharacterGenerationRunResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    })).toEqual({ status: "candidate", candidate });

    const decision = Object.freeze({
      kind: "merge" as const,
      targetCharacterId: entityId<"Character">("character-current"),
      expectedCharacterRevision: 8,
      fields: Object.freeze(["appearance" as const]),
    });
    const decideGenerationItem = vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      status: "applied" as const,
      candidate,
      characters: Object.freeze([character("current")]),
    }));
    await decideCharacterGenerationItemRecord({
      activeWorkId: workId,
      candidate,
      client: charactersClient({ decideGenerationItem }).client,
      decision,
      item,
    });
    expect(decideGenerationItem).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      candidateId: candidate.candidateId,
      expectedCandidateRevision: 6,
      itemId: item.itemId,
      decision,
    });
    const approved = character("approved");
    const approvedCandidate = generationCandidate("current", {
      revision: 7,
      items: Object.freeze([generationItem("current", {
        status: "merged",
        approvedCharacterId: approved.characterId,
      })]),
    });
    const result: CharacterGenerationDecisionResult = Object.freeze({
      schemaVersion: 1,
      status: "applied",
      candidate: approvedCandidate,
      characters: Object.freeze([approved]),
    });
    expect(reconcileCharacterGenerationDecision({
      currentSelectedCharacterId: null,
      itemId: approvedCandidate.items[0]!.itemId,
      result,
    })).toEqual({
      characters: [approved],
      selectedCharacterId: approved.characterId,
    });
    expect(prependCharacterGenerationCandidate([], candidate)).toEqual([
      candidate,
    ]);
    expect(canRunCharacterGeneration(workId, "idle")).toBe(true);
    expect(canDecideCharacterGeneration(workId, "idle", candidate)).toBe(true);
  });

  it("preserves dialog and current-selection navigation state compatibility", () => {
    expect(openCharacterDialogState()).toEqual({
      dialogOpen: true,
      error: null,
    });
    expect(closeCharacterDialogState("updating")).toBeNull();
    expect(closeCharacterDialogState("idle")).toEqual({
      dialogOpen: false,
      error: null,
    });
    expect(focusCharacterInStructureState("character-runtime")).toEqual({
      dialogOpen: false,
      error: null,
      selectedCharacterId: "character-runtime",
    });
    expect(characterEvidenceNavigationRejectedState("실패")).toEqual({
      error: "실패",
    });
    expect(characterEvidenceNavigationVisibleState()).toEqual({ error: null });
    expect(characterEvidenceNavigationActivationState()).toEqual({
      actionState: "adding-evidence",
    });
    expect(characterEvidenceNavigationIdleState()).toEqual({
      actionState: "idle",
    });
    expect(characterEvidenceNavigationOpenedState("same-document")).toBeNull();
    expect(characterEvidenceNavigationOpenedState("visible-transition")).toBeNull();
    expect(characterEvidenceNavigationOpenedState("cross-document")).toEqual({
      actionState: "idle",
      error: null,
    });
    expect(characterEvidenceNavigationFailedState("실패", false)).toEqual({
      error: "실패",
    });
    expect(characterEvidenceNavigationFailedState("실패", true)).toEqual({
      actionState: "idle",
      error: "실패",
    });
  });

  it("keeps character state in its controller and routes shared services through feature kernels", () => {
    const controllerSource = readFileSync(
      new URL("./useCharactersController.ts", import.meta.url),
      "utf8",
    );
    const clientSource = readFileSync(
      new URL("./characters-client.ts", import.meta.url),
      "utf8",
    );
    const appSource = readFileSync(
      new URL("../../App.tsx", import.meta.url),
      "utf8",
    );
    const coreSource = readFileSync(
      new URL("../../workspace/useWorkspaceCoreFeatureKernel.ts", import.meta.url),
      "utf8",
    );
    const assistantSource = readFileSync(
      new URL("../assistant/useAssistantWorkspaceController.ts", import.meta.url),
      "utf8",
    );
    const inspirationSource = readFileSync(
      new URL("../inspiration/useInspirationController.ts", import.meta.url),
      "utf8",
    );
    const navigationSource = readFileSync(
      new URL("../../workspace/navigation/useWorkspaceFeatureNavigationController.ts", import.meta.url),
      "utf8",
    );
    const manuscriptActionsSource = readFileSync(
      new URL("../../workspace/editor/useWorkspaceManuscriptActionsController.ts", import.meta.url),
      "utf8",
    );
    const surfaceHostSource = readFileSync(
      new URL("../../workspace/WorkspaceFeatureSurfaceHost.tsx", import.meta.url),
      "utf8",
    );
    const resetSource = controllerSource.slice(
      controllerSource.indexOf("onReset: () => {"),
      controllerSource.indexOf("onLoaded:", controllerSource.indexOf("onReset: () => {")),
    );

    expect(controllerSource).not.toContain("window.");
    expect(resetSource).toContain('setCharacterRelationActionState("idle")');
    expect(resetSource).toContain('setCharacterGenerationActionState("idle")');
    expect(resetSource).not.toContain('setCharacterActionState("idle")');
    expect(resetSource).not.toContain('setCharacterExtractionActionState("idle")');
    expect(resetSource).toContain("resetWorkspaceSurfaceAfterNullWork");
    expect(clientSource).toContain('capability: "character.extract"');
    expect(clientSource).toContain('duration: "once"');
    expect(controllerSource).toContain("await performCharacterExtraction();");

    expect(coreSource.match(/useCharactersController\(/gu)).toHaveLength(1);
    expect(assistantSource).toContain(
      "const [chatGptOAuthStatus, setChatGptOAuthStatus]",
    );
    expect(inspirationSource).toContain(
      "const [workInspirationSettings, setWorkInspirationSettings]",
    );
    expect(navigationSource).toContain("const openCharacterEvidence = useCallback(");
    expect(navigationSource).toContain('kind: "current-selection"');
    expect(manuscriptActionsSource).toContain("createCurrentCharactersManuscriptPort");
    expect(surfaceHostSource).toContain("const valuesFor = (...categories");
    expect(appSource).not.toContain("setCharacters");
    expect(appSource).not.toContain("setCharacterRelations");
    expect(appSource).not.toContain("setCharacterExtractionCandidates");
    expect(appSource).not.toContain("setCharacterGenerationCandidates");
  });
});
