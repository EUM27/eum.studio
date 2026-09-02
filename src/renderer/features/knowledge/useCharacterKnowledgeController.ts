import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CharacterKnowledgeBridge } from "../../../application/contracts/studio-bridge";
import type { AssistantContextRange } from "../../../application/assistant/assistant-context-permission";
import type { CanonEntityRef } from "../../../application/canon/canon-entity-ref";
import type {
  CharacterKnowledgeProjection,
  CharacterKnowledgeStance,
  KnowledgeTruthStatus,
  PovKnowledgeContextProjection,
} from "../../../application/continuity/character-knowledge-contract";
import type { EntityId } from "../../../domain/writing";
import { createCharacterKnowledgeClient } from "./character-knowledge-client";

export type CharacterKnowledgeActionState = "idle" | "loading" | "saving";

export type PendingCharacterKnowledgeSelection = Readonly<{
  sourceRange: AssistantContextRange;
  exactText: string;
}>;

export type CharacterKnowledgeStateDraft = Readonly<{
  statement: string;
  stance: CharacterKnowledgeStance;
  truthStatus: KnowledgeTruthStatus;
  aboutRefs: readonly CanonEntityRef[];
}>;

export function useCharacterKnowledgeController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: CharacterKnowledgeBridge;
  workLoadId: EntityId<"Work"> | null;
}>) {
  const client = useMemo(() => createCharacterKnowledgeClient(input.client), [input.client]);
  const [entries, setEntries] = useState<readonly CharacterKnowledgeProjection[]>([]);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] =
    useState<PendingCharacterKnowledgeSelection | null>(null);
  const [pov, setPov] = useState<PovKnowledgeContextProjection | null>(null);
  const [actionState, setActionState] = useState<CharacterKnowledgeActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const activeWorkIdRef = useRef(input.activeWorkId);

  useEffect(() => {
    activeWorkIdRef.current = input.activeWorkId;
  }, [input.activeWorkId]);

  const applyEntries = useCallback((next: readonly CharacterKnowledgeProjection[]) => {
    setEntries(next);
    setSelectedKnowledgeId((current) =>
      next.some((entry) => entry.knowledgeId === current)
        ? current
        : next[0]?.knowledgeId ?? null
    );
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const workId = input.activeWorkId;
    if (workId === null) return false;
    setActionState("loading");
    setError(null);
    try {
      const loaded = await client.list({
        schemaVersion: 1,
        workId,
        characterId: null,
        status: "all",
      });
      if (activeWorkIdRef.current !== workId) return false;
      applyEntries(loaded.entries);
      return true;
    } catch (reason) {
      if (activeWorkIdRef.current === workId) {
        setError(reason instanceof Error ? reason.message : "인물 지식을 불러오지 못했습니다.");
      }
      return false;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [applyEntries, client, input.activeWorkId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setEntries([]);
      setSelectedKnowledgeId(null);
      setPendingSelection(null);
      setPov(null);
      setError(null);
      setMessage(null);
      if (input.workLoadId !== null) await refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [input.workLoadId, refresh]);

  const save = useCallback(async <T,>(operation: () => Promise<T>, success: string) => {
    setActionState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await operation();
      await refresh();
      setMessage(success);
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "인물 지식을 저장하지 못했습니다.");
      return null;
    } finally {
      setActionState("idle");
    }
  }, [refresh]);

  const create = useCallback(async (
    characterId: EntityId<"Character">,
    draft: CharacterKnowledgeStateDraft,
  ) => {
    const workId = input.activeWorkId;
    if (workId === null) return null;
    const result = await save(() => client.create({
      schemaVersion: 1,
      workId,
      characterId,
      ...draft,
      evidenceRange: pendingSelection?.sourceRange ?? null,
    }), "인물 지식을 저장했습니다.");
    if (result !== null) {
      setPendingSelection(null);
      setSelectedKnowledgeId(result.knowledgeId);
    }
    return result;
  }, [client, input.activeWorkId, pendingSelection, save]);

  const update = useCallback((
    entry: CharacterKnowledgeProjection,
    statement: string,
    aboutRefs: readonly CanonEntityRef[],
  ) => save(() => client.update({
    schemaVersion: 1,
    workId: entry.workId,
    knowledgeId: entry.knowledgeId,
    expectedRevision: entry.revision,
    statement,
    aboutRefs,
  }), "인물 지식 설명을 수정했습니다."), [client, save]);

  const supersede = useCallback(async (
    entry: CharacterKnowledgeProjection,
    draft: CharacterKnowledgeStateDraft,
  ) => {
    const result = await save(() => client.supersede({
      schemaVersion: 1,
      workId: entry.workId,
      knowledgeId: entry.knowledgeId,
      expectedRevision: entry.revision,
      ...draft,
      evidenceRange: pendingSelection?.sourceRange ?? null,
    }), "이전 상태를 보존하고 새 인식 상태를 만들었습니다.");
    if (result !== null) {
      setPendingSelection(null);
      setSelectedKnowledgeId(result.knowledgeId);
    }
    return result;
  }, [client, pendingSelection, save]);

  const retire = useCallback((entry: CharacterKnowledgeProjection, reason: string) =>
    save(() => client.retire({
      schemaVersion: 1,
      workId: entry.workId,
      knowledgeId: entry.knowledgeId,
      expectedRevision: entry.revision,
      reason,
    }), "인물 지식을 보관 처리했습니다."), [client, save]);

  const projectPov = useCallback(async (characterId: EntityId<"Character">) => {
    const workId = input.activeWorkId;
    if (workId === null) return null;
    setActionState("loading");
    setError(null);
    try {
      const projection = await client.projectPov({ schemaVersion: 1, workId, characterId });
      if (activeWorkIdRef.current !== workId) return null;
      setPov(projection);
      return projection;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "POV 지식 문맥을 만들지 못했습니다.");
      return null;
    } finally {
      if (activeWorkIdRef.current === workId) setActionState("idle");
    }
  }, [client, input.activeWorkId]);

  const stageSelection = useCallback((sourceRange: AssistantContextRange, exactText: string) => {
    setPendingSelection(Object.freeze({ sourceRange, exactText }));
    setError(null);
    setMessage("선택 원문을 인물 지식 근거로 준비했습니다.");
  }, []);

  const selectedEntry = entries.find((entry) =>
    entry.knowledgeId === selectedKnowledgeId
  ) ?? null;

  return {
    entries,
    selectedEntry,
    selectedKnowledgeId,
    pendingSelection,
    pov,
    actionState,
    error,
    message,
    refresh,
    create,
    update,
    supersede,
    retire,
    projectPov,
    stageSelection,
    clearPendingSelection: () => setPendingSelection(null),
    selectEntry: setSelectedKnowledgeId,
    clearFeedback: () => { setError(null); setMessage(null); },
    reportError: setError,
  };
}
