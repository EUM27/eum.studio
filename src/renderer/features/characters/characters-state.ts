import type {
  CharacterProjection,
} from "../../../application/characters/character-contract";
import type {
  CharacterExtractionCandidate,
  CharacterExtractionDecisionResult,
  CharacterExtractionResult,
} from "../../../application/characters/character-extraction-contract";
import type {
  CharacterGenerationCandidate,
  CharacterGenerationDecisionResult,
  CharacterGenerationResult,
} from "../../../application/characters/character-generation-contract";
import type {
  CharacterRelationProjection,
} from "../../../application/characters/character-relation-contract";
import type { EntityId } from "../../../domain/writing";
import type { CharacterManagerActionState } from "../../editor/CharacterManagerDialog";
import type {
  CharacterExtractionActionState,
  CharacterGenerationActionState,
  CharacterRelationActionState,
} from "../../editor/CharacterWorkspace";

export const CHARACTER_MESSAGES = Object.freeze({
  loadFailed: "인물 목록을 불러오지 못했습니다.",
  createFailed: "인물을 만들지 못했습니다. 이름과 현재 작품을 확인하세요.",
  updateFailed: "인물 정보가 달라졌습니다. 다시 열어 확인하세요.",
  retireFailed: "인물을 목록에서 치우지 못했습니다.",
  relationCreateFailed:
    "캐릭터 관계를 만들지 못했습니다. 현재 작품과 대상을 확인하세요.",
  relationUpdateFailed:
    "캐릭터 관계가 달라졌습니다. 다시 열어 확인하세요.",
  relationRetireFailed: "캐릭터 관계를 삭제하지 못했습니다.",
  selectionRevisionFailed:
    "현재 선택 범위의 저장 revision을 확정하지 못했습니다.",
  extractionSelectionRequired:
    "원고에서 정확한 범위를 선택한 뒤 캐릭터 추출을 실행하세요.",
  oauthRequired: "GPT 연결이 필요합니다. 앱 설정에서 GPT로 로그인하세요.",
  extractionStaleContext:
    "선택 뒤 원고가 변경되었습니다. 원고에서 범위를 다시 선택하세요.",
  extractionContextRejected:
    "현재 선택 범위를 캐릭터 추출에 사용할 수 없습니다.",
  extractionFailed: "캐릭터 후보를 만들지 못했습니다.",
  extractionPermissionFailed: "캐릭터 추출 권한을 승인하지 못했습니다.",
  extractionCandidateStale:
    "후보 생성 뒤 원고가 변경되어 이 후보를 적용할 수 없습니다.",
  extractionDecisionFailed: "캐릭터 후보 결정을 저장하지 못했습니다.",
  generationFailed: "캐릭터 설정 초안을 만들지 못했습니다.",
  generationDecisionFailed: "캐릭터 설정 후보 결정을 저장하지 못했습니다.",
  evidenceFailed: "현재 선택을 캐릭터 근거로 연결하지 못했습니다.",
});

export function reconcileSelectedCharacter(
  current: string | null,
  characters: readonly CharacterProjection[],
): string | null {
  return current !== null && characters.some(
    (character) => character.characterId === current,
  )
    ? current
    : (characters[0]?.characterId ?? null);
}

export function prependCharacter(
  current: readonly CharacterProjection[],
  created: CharacterProjection,
): readonly CharacterProjection[] {
  return Object.freeze([
    created,
    ...current.filter(
      (character) =>
        character.workId === created.workId &&
        character.characterId !== created.characterId,
    ),
  ]);
}

export function replaceCharacter(
  current: readonly CharacterProjection[],
  updated: CharacterProjection,
): readonly CharacterProjection[] {
  return Object.freeze(
    current
      .filter((character) => character.workId === updated.workId)
      .map((character) =>
        character.characterId === updated.characterId ? updated : character
      ),
  );
}

export function prependCharacterEvidenceUpdate(
  current: readonly CharacterProjection[],
  updated: CharacterProjection,
): readonly CharacterProjection[] {
  return Object.freeze([
    updated,
    ...current.filter(
      (character) => character.characterId !== updated.characterId,
    ),
  ]);
}

export function resolveCharacterRetirement(input: Readonly<{
  characters: readonly CharacterProjection[];
  relations: readonly CharacterRelationProjection[];
  retired: CharacterProjection;
  selectedCharacterId: string | null;
}>) {
  const characters = Object.freeze(input.characters.filter(
    (character) =>
      character.workId === input.retired.workId &&
      character.characterId !== input.retired.characterId,
  ));
  const relations = Object.freeze(input.relations.filter(
    (relation) =>
      relation.workId === input.retired.workId &&
      relation.fromCharacterId !== input.retired.characterId &&
      relation.toCharacterId !== input.retired.characterId,
  ));
  return Object.freeze({
    characters,
    relations,
    selectedCharacterId:
      input.selectedCharacterId === input.retired.characterId
        ? (characters[0]?.characterId ?? null)
        : input.selectedCharacterId,
  });
}

export function prependCharacterRelation(
  current: readonly CharacterRelationProjection[],
  created: CharacterRelationProjection,
): readonly CharacterRelationProjection[] {
  return Object.freeze([
    created,
    ...current.filter(
      (relation) =>
        relation.workId === created.workId &&
        relation.relationId !== created.relationId,
    ),
  ]);
}

export function replaceCharacterRelation(
  current: readonly CharacterRelationProjection[],
  updated: CharacterRelationProjection,
): readonly CharacterRelationProjection[] {
  return Object.freeze(
    current
      .filter((relation) => relation.workId === updated.workId)
      .map((relation) =>
        relation.relationId === updated.relationId ? updated : relation
      ),
  );
}

export function prependCharacterExtractionCandidate(
  current: readonly CharacterExtractionCandidate[],
  candidate: CharacterExtractionCandidate,
): readonly CharacterExtractionCandidate[] {
  return Object.freeze([
    candidate,
    ...current.filter((entry) => entry.candidateId !== candidate.candidateId),
  ]);
}

export function prependCharacterGenerationCandidate(
  current: readonly CharacterGenerationCandidate[],
  candidate: CharacterGenerationCandidate,
): readonly CharacterGenerationCandidate[] {
  return Object.freeze([
    candidate,
    ...current.filter((entry) => entry.candidateId !== candidate.candidateId),
  ]);
}

export function resolveCharacterExtractionRunResult(
  result: CharacterExtractionResult,
) {
  switch (result.status) {
    case "login-required":
      return Object.freeze({
        error: CHARACTER_MESSAGES.oauthRequired,
        status: result.status,
      });
    case "permission-required":
      return Object.freeze({
        destinationId: result.destinationId,
        permissionRequired: true,
        status: result.status,
      });
    case "context-rejected":
      return Object.freeze({
        error: result.reason === "stale-context"
          ? CHARACTER_MESSAGES.extractionStaleContext
          : CHARACTER_MESSAGES.extractionContextRejected,
        status: result.status,
      });
    case "candidate":
      return Object.freeze({
        candidate: result.candidate,
        destinationId: null,
        permissionRequired: false,
        status: result.status,
      });
  }
}

export function resolveCharacterGenerationRunResult(
  result: CharacterGenerationResult,
) {
  return result.status === "login-required"
    ? Object.freeze({
        error: CHARACTER_MESSAGES.oauthRequired,
        status: result.status,
      })
    : Object.freeze({ candidate: result.candidate, status: result.status });
}

export function reconcileCharacterExtractionDecision(input: Readonly<{
  characters: readonly CharacterProjection[];
  currentSelectedCharacterId: string | null;
  itemId: EntityId<"CharacterExtractionItem">;
  result: CharacterExtractionDecisionResult;
}>) {
  if (input.result.status === "stale") {
    return Object.freeze({
      characters: input.characters,
      error: CHARACTER_MESSAGES.extractionCandidateStale,
      selectedCharacterId: input.currentSelectedCharacterId,
    });
  }
  const decidedItem = input.result.candidate.items.find(
    (item) => item.itemId === input.itemId,
  );
  return Object.freeze({
    characters: input.result.characters,
    error: null,
    selectedCharacterId:
      decidedItem?.approvedCharacterId != null
        ? decidedItem.approvedCharacterId
        : input.currentSelectedCharacterId,
  });
}

export function reconcileCharacterGenerationDecision(input: Readonly<{
  currentSelectedCharacterId: string | null;
  itemId: EntityId<"CharacterGenerationItem">;
  result: CharacterGenerationDecisionResult;
}>) {
  const decidedItem = input.result.candidate.items.find(
    (item) => item.itemId === input.itemId,
  );
  return Object.freeze({
    characters: input.result.characters,
    selectedCharacterId:
      decidedItem?.approvedCharacterId != null
        ? decidedItem.approvedCharacterId
        : input.currentSelectedCharacterId,
  });
}

export function canCreateCharacter(
  activeWorkId: EntityId<"Work"> | null,
  actionState: CharacterManagerActionState,
  relationActionState: CharacterRelationActionState,
): activeWorkId is EntityId<"Work"> {
  return (
    activeWorkId !== null &&
    actionState === "idle" &&
    relationActionState === "idle"
  );
}

export function canMutateCharacter(
  activeWorkId: EntityId<"Work"> | null,
  actionState: CharacterManagerActionState,
  relationActionState: CharacterRelationActionState,
  character: CharacterProjection,
): activeWorkId is EntityId<"Work"> {
  return (
    canCreateCharacter(activeWorkId, actionState, relationActionState) &&
    character.workId === activeWorkId
  );
}

export function canMutateCharacterRelation(
  activeWorkId: EntityId<"Work"> | null,
  actionState: CharacterRelationActionState,
  relationOrCharacter: CharacterRelationProjection | CharacterProjection,
): activeWorkId is EntityId<"Work"> {
  return (
    activeWorkId !== null &&
    relationOrCharacter.workId === activeWorkId &&
    actionState === "idle"
  );
}

export function canDecideCharacterExtraction(
  activeWorkId: EntityId<"Work"> | null,
  actionState: CharacterExtractionActionState,
  candidate: CharacterExtractionCandidate,
): activeWorkId is EntityId<"Work"> {
  return (
    activeWorkId !== null &&
    candidate.workId === activeWorkId &&
    actionState === "idle"
  );
}

export function canRunCharacterGeneration(
  activeWorkId: EntityId<"Work"> | null,
  actionState: CharacterGenerationActionState,
): activeWorkId is EntityId<"Work"> {
  return activeWorkId !== null && actionState === "idle";
}

export function canDecideCharacterGeneration(
  activeWorkId: EntityId<"Work"> | null,
  actionState: CharacterGenerationActionState,
  candidate: CharacterGenerationCandidate,
): activeWorkId is EntityId<"Work"> {
  return (
    canRunCharacterGeneration(activeWorkId, actionState) &&
    candidate.workId === activeWorkId
  );
}

export function canAddCharacterEvidence(
  activeWorkId: EntityId<"Work"> | null,
  actionState: CharacterExtractionActionState,
  character: CharacterProjection,
  hasSelection: boolean,
): activeWorkId is EntityId<"Work"> {
  return (
    activeWorkId !== null &&
    character.workId === activeWorkId &&
    hasSelection &&
    actionState === "idle"
  );
}

export function openCharacterDialogState() {
  return Object.freeze({ dialogOpen: true, error: null });
}

export function closeCharacterDialogState(
  actionState: CharacterManagerActionState,
) {
  return actionState === "idle"
    ? Object.freeze({ dialogOpen: false, error: null })
    : null;
}

export function focusCharacterInStructureState(characterId: string) {
  return Object.freeze({
    dialogOpen: false,
    error: null,
    selectedCharacterId: characterId,
  });
}

export function characterEvidenceNavigationRejectedState(error: string) {
  return Object.freeze({ error });
}

export function characterEvidenceNavigationVisibleState() {
  return Object.freeze({ error: null });
}

export function characterEvidenceNavigationActivationState() {
  return Object.freeze({ actionState: "adding-evidence" as const });
}

export function characterEvidenceNavigationIdleState() {
  return Object.freeze({ actionState: "idle" as const });
}

export function characterEvidenceNavigationOpenedState(
  path: "same-document" | "visible-transition" | "cross-document",
) {
  return path === "cross-document"
    ? Object.freeze({ actionState: "idle" as const, error: null })
    : null;
}

export function characterEvidenceNavigationFailedState(
  error: string,
  crossDocumentActivationStarted: boolean,
) {
  return crossDocumentActivationStarted
    ? Object.freeze({ actionState: "idle" as const, error })
    : Object.freeze({ error });
}
