import { useCallback, useEffect, useMemo, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  CharacterProjection,
  UpdateCharacterCommand,
} from "../../../application/characters/character-contract";
import type {
  CharacterExtractionCandidate,
  CharacterExtractionDecision,
  CharacterExtractionItem,
} from "../../../application/characters/character-extraction-contract";
import type {
  CharacterGenerationBrief,
  CharacterGenerationCandidate,
  CharacterGenerationItem,
} from "../../../application/characters/character-generation-contract";
import type {
  CharacterRelationProjection,
  UpdateCharacterRelationCommand,
} from "../../../application/characters/character-relation-contract";
import { entityId, type EntityId } from "../../../domain/writing";
import type { CharacterManagerActionState } from "../../editor/CharacterManagerDialog";
import type {
  CharacterExtractionActionState,
  CharacterGenerationActionState,
  CharacterRelationActionState,
  CharacterWorkspaceSelection,
} from "../../editor/CharacterWorkspace";
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
  type CharacterDraftInput,
  type CharacterRelationDraftInput,
  type CharactersAssistantClient,
  type CharactersClient,
  type CharactersManuscriptPort,
  type CharactersWorkspaceCompatibilityPort,
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
  reconcileSelectedCharacter,
  replaceCharacter,
  replaceCharacterRelation,
  resolveCharacterExtractionRunResult,
  resolveCharacterGenerationRunResult,
  resolveCharacterRetirement,
} from "./characters-state";

export type CharacterEvidenceNavigationStatePort = Readonly<{
  reject: (message: string) => void;
  visibleTransitionStarted: () => void;
  activationStarted: () => void;
  tabPolicyApplied: () => void;
  superseded: (crossDocumentActivationStarted: boolean) => void;
  opened: (
    path: "same-document" | "visible-transition" | "cross-document",
  ) => void;
  failed: (
    message: string,
    crossDocumentActivationStarted: boolean,
  ) => void;
}>;

export function useCharactersController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  assistantClient: CharactersAssistantClient;
  assistantConversationId: EntityId<"AssistantConversation">;
  client: CharactersClient;
  workLoadId: EntityId<"Work"> | null;
  workspace: CharactersWorkspaceCompatibilityPort;
}>) {
  const [characters, setCharacters] = useState<
    readonly CharacterProjection[]
  >([]);
  const [characterRelations, setCharacterRelations] = useState<
    readonly CharacterRelationProjection[]
  >([]);
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<
    string | null
  >(null);
  const [characterActionState, setCharacterActionState] =
    useState<CharacterManagerActionState>("idle");
  const [characterRelationActionState, setCharacterRelationActionState] =
    useState<CharacterRelationActionState>("idle");
  const [characterActionError, setCharacterActionError] = useState<
    string | null
  >(null);
  const [characterWorkspaceSelection, setCharacterWorkspaceSelection] =
    useState<CharacterWorkspaceSelection | null>(null);
  const [characterExtractionCandidates, setCharacterExtractionCandidates] =
    useState<readonly CharacterExtractionCandidate[]>([]);
  const [characterExtractionActionState, setCharacterExtractionActionState] =
    useState<CharacterExtractionActionState>("idle");
  const [characterExtractionActionError, setCharacterExtractionActionError] =
    useState<string | null>(null);
  const [characterExtractionPermissionRequired, setCharacterExtractionPermissionRequired] =
    useState(false);
  const [characterExtractionDestinationId, setCharacterExtractionDestinationId] =
    useState<string | null>(null);
  const [characterGenerationCandidates, setCharacterGenerationCandidates] =
    useState<readonly CharacterGenerationCandidate[]>([]);
  const [characterGenerationActionState, setCharacterGenerationActionState] =
    useState<CharacterGenerationActionState>("idle");
  const [characterGenerationActionError, setCharacterGenerationActionError] =
    useState<string | null>(null);

  useEffect(() => startCharactersWorkLoad({
    activeWorkId: input.workLoadId,
    assistantClient: input.assistantClient,
    client: input.client,
    onReset: () => {
      setCharacters([]);
      setCharacterRelations([]);
      setSelectedCharacterId(null);
      setCharacterActionError(null);
      setCharacterRelationActionState("idle");
      setCharacterDialogOpen(false);
      input.workspace.resetWorkspaceSurfaceAfterNullWork();
      setCharacterWorkspaceSelection(null);
      setCharacterExtractionCandidates([]);
      setCharacterExtractionActionError(null);
      setCharacterExtractionPermissionRequired(false);
      setCharacterExtractionDestinationId(null);
      setCharacterGenerationCandidates([]);
      setCharacterGenerationActionState("idle");
      setCharacterGenerationActionError(null);
    },
    onLoaded: (
      loadedCharacters,
      loadedRelations,
      loadedExtractionCandidates,
      loadedGenerationCandidates,
      oauthStatus,
    ) => {
      setCharacters(loadedCharacters);
      setCharacterRelations(loadedRelations);
      setCharacterExtractionCandidates(loadedExtractionCandidates);
      setCharacterGenerationCandidates(loadedGenerationCandidates);
      input.workspace.publishOAuthStatus(oauthStatus);
      setSelectedCharacterId((current) =>
        reconcileSelectedCharacter(current, loadedCharacters)
      );
      setCharacterActionError(null);
      setCharacterExtractionActionError(null);
      setCharacterGenerationActionError(null);
    },
    onFailed: () => {
      setCharacters([]);
      setCharacterRelations([]);
      setCharacterExtractionCandidates([]);
      setCharacterGenerationCandidates([]);
      setCharacterActionError(CHARACTER_MESSAGES.loadFailed);
    },
  }), [
    input.assistantClient,
    input.client,
    input.workLoadId,
    input.workspace,
  ]);

  const createCharacter = useCallback(
    async (draft: CharacterDraftInput) => {
      if (!canCreateCharacter(
        input.activeWorkId,
        characterActionState,
        characterRelationActionState,
      )) {
        return;
      }
      setCharacterActionState("creating");
      setCharacterActionError(null);
      try {
        const created = await createCharacterRecord({
          activeWorkId: input.activeWorkId,
          client: input.client,
          draft,
        });
        setCharacters((current) => prependCharacter(current, created));
        setSelectedCharacterId(created.characterId);
      } catch {
        setCharacterActionError(CHARACTER_MESSAGES.createFailed);
      } finally {
        setCharacterActionState("idle");
      }
    },
    [
      characterActionState,
      characterRelationActionState,
      input.activeWorkId,
      input.client,
    ],
  );

  const updateCharacter = useCallback(
    async (
      character: CharacterProjection,
      changes: UpdateCharacterCommand["changes"],
    ) => {
      if (!canMutateCharacter(
        input.activeWorkId,
        characterActionState,
        characterRelationActionState,
        character,
      )) {
        return;
      }
      setCharacterActionState("updating");
      setCharacterActionError(null);
      try {
        const updated = await updateCharacterRecord({
          activeWorkId: input.activeWorkId,
          changes,
          character,
          client: input.client,
        });
        setCharacters((current) => replaceCharacter(current, updated));
      } catch {
        setCharacterActionError(CHARACTER_MESSAGES.updateFailed);
      } finally {
        setCharacterActionState("idle");
      }
    },
    [
      characterActionState,
      characterRelationActionState,
      input.activeWorkId,
      input.client,
    ],
  );

  const retireCharacter = useCallback(
    async (character: CharacterProjection) => {
      if (!canMutateCharacter(
        input.activeWorkId,
        characterActionState,
        characterRelationActionState,
        character,
      )) {
        return;
      }
      setCharacterActionState("retiring");
      setCharacterActionError(null);
      try {
        const retired = await retireCharacterRecord({
          activeWorkId: input.activeWorkId,
          character,
          client: input.client,
        });
        const retirement = resolveCharacterRetirement({
          characters,
          relations: [],
          retired,
          selectedCharacterId: null,
        });
        setCharacters(retirement.characters);
        setCharacterRelations((current) =>
          resolveCharacterRetirement({
            characters,
            relations: current,
            retired,
            selectedCharacterId: null,
          }).relations
        );
        setSelectedCharacterId((current) =>
          current === retired.characterId
            ? (retirement.characters[0]?.characterId ?? null)
            : current
        );
      } catch {
        setCharacterActionError(CHARACTER_MESSAGES.retireFailed);
      } finally {
        setCharacterActionState("idle");
      }
    },
    [
      characterActionState,
      characterRelationActionState,
      characters,
      input.activeWorkId,
      input.client,
    ],
  );

  const createCharacterRelation = useCallback(
    async (
      character: CharacterProjection,
      draft: CharacterRelationDraftInput,
    ) => {
      if (!canMutateCharacterRelation(
        input.activeWorkId,
        characterRelationActionState,
        character,
      )) {
        return;
      }
      setCharacterRelationActionState("creating");
      setCharacterActionError(null);
      try {
        const created = await createCharacterRelationRecord({
          activeWorkId: input.activeWorkId,
          character,
          client: input.client,
          draft,
        });
        setCharacterRelations((current) =>
          prependCharacterRelation(current, created)
        );
      } catch {
        setCharacterActionError(CHARACTER_MESSAGES.relationCreateFailed);
      } finally {
        setCharacterRelationActionState("idle");
      }
    },
    [characterRelationActionState, input.activeWorkId, input.client],
  );

  const updateCharacterRelation = useCallback(
    async (
      relation: CharacterRelationProjection,
      changes: UpdateCharacterRelationCommand["changes"],
    ) => {
      if (!canMutateCharacterRelation(
        input.activeWorkId,
        characterRelationActionState,
        relation,
      )) {
        return;
      }
      setCharacterRelationActionState("updating");
      setCharacterActionError(null);
      try {
        const updated = await updateCharacterRelationRecord({
          activeWorkId: input.activeWorkId,
          changes,
          client: input.client,
          relation,
        });
        setCharacterRelations((current) =>
          replaceCharacterRelation(current, updated)
        );
      } catch {
        setCharacterActionError(CHARACTER_MESSAGES.relationUpdateFailed);
      } finally {
        setCharacterRelationActionState("idle");
      }
    },
    [characterRelationActionState, input.activeWorkId, input.client],
  );

  const retireCharacterRelation = useCallback(
    async (relation: CharacterRelationProjection) => {
      if (!canMutateCharacterRelation(
        input.activeWorkId,
        characterRelationActionState,
        relation,
      )) {
        return;
      }
      setCharacterRelationActionState("retiring");
      setCharacterActionError(null);
      try {
        const retired = await retireCharacterRelationRecord({
          activeWorkId: input.activeWorkId,
          client: input.client,
          relation,
        });
        setCharacterRelations((current) =>
          replaceCharacterRelation(current, retired)
        );
      } catch {
        setCharacterActionError(CHARACTER_MESSAGES.relationRetireFailed);
      } finally {
        setCharacterRelationActionState("idle");
      }
    },
    [characterRelationActionState, input.activeWorkId, input.client],
  );

  const captureWorkspaceSelection = useCallback(
    async (manuscript: CharactersManuscriptPort | null) => {
      setCharacterActionError(null);
      setCharacterExtractionActionError(null);
      setCharacterExtractionPermissionRequired(false);
      const outcome = await captureCharacterWorkspaceSelectionThroughPort(
        input.activeDocument,
        manuscript,
      );
      if (outcome.status === "persist-failed") {
        setCharacterExtractionActionError(
          CHARACTER_MESSAGES.selectionRevisionFailed,
        );
      }
      const selection = outcome.status === "captured"
        ? outcome.selection
        : null;
      setCharacterWorkspaceSelection(selection);
      return selection;
    },
    [input.activeDocument],
  );

  const performCharacterExtraction = useCallback(
    async (selectionOverride?: CharacterWorkspaceSelection) => {
      const extractionSelection =
        selectionOverride ?? characterWorkspaceSelection;
      if (input.activeWorkId === null || extractionSelection === null) {
        setCharacterExtractionActionError(
          CHARACTER_MESSAGES.extractionSelectionRequired,
        );
        return;
      }
      setCharacterExtractionActionState("extracting");
      setCharacterExtractionActionError(null);
      try {
        const result = await runCharacterExtractionRecord({
          activeWorkId: input.activeWorkId,
          client: input.client,
          conversationId: input.assistantConversationId,
          requestId: entityId<"CharacterExtractionRequest">(
            crypto.randomUUID(),
          ),
          selection: extractionSelection,
        });
        const outcome = resolveCharacterExtractionRunResult(result);
        if (outcome.status === "login-required") {
          setCharacterExtractionActionError(outcome.error);
          return;
        }
        if (outcome.status === "permission-required") {
          setCharacterExtractionPermissionRequired(
            outcome.permissionRequired,
          );
          setCharacterExtractionDestinationId(outcome.destinationId);
          return;
        }
        if (outcome.status === "context-rejected") {
          setCharacterExtractionActionError(outcome.error);
          return;
        }
        setCharacterExtractionPermissionRequired(outcome.permissionRequired);
        setCharacterExtractionDestinationId(outcome.destinationId);
        setCharacterExtractionCandidates((current) =>
          prependCharacterExtractionCandidate(current, outcome.candidate)
        );
      } catch (reason) {
        setCharacterExtractionActionError(
          reason instanceof Error
            ? reason.message
            : CHARACTER_MESSAGES.extractionFailed,
        );
      } finally {
        setCharacterExtractionActionState("idle");
      }
    },
    [
      characterWorkspaceSelection,
      input.activeWorkId,
      input.assistantConversationId,
      input.client,
    ],
  );

  const grantCharacterExtractionPermission = useCallback(async () => {
    if (
      input.activeWorkId === null ||
      characterExtractionDestinationId === null ||
      characterWorkspaceSelection === null ||
      characterExtractionActionState !== "idle"
    ) {
      return;
    }
    setCharacterExtractionActionState("granting");
    setCharacterExtractionActionError(null);
    try {
      await grantCharacterExtractionPermissionRecord({
        activeWorkId: input.activeWorkId,
        assistantClient: input.assistantClient,
        conversationId: input.assistantConversationId,
        destinationId: characterExtractionDestinationId,
      });
      setCharacterExtractionPermissionRequired(false);
      setCharacterExtractionActionState("idle");
      await performCharacterExtraction();
    } catch (reason) {
      setCharacterExtractionActionError(
        reason instanceof Error
          ? reason.message
          : CHARACTER_MESSAGES.extractionPermissionFailed,
      );
      setCharacterExtractionActionState("idle");
    }
  }, [
    characterExtractionActionState,
    characterExtractionDestinationId,
    characterWorkspaceSelection,
    input.activeWorkId,
    input.assistantClient,
    input.assistantConversationId,
    performCharacterExtraction,
  ]);

  const decideCharacterExtractionItem = useCallback(
    async (
      candidate: CharacterExtractionCandidate,
      item: CharacterExtractionItem,
      decision: CharacterExtractionDecision,
    ) => {
      if (!canDecideCharacterExtraction(
        input.activeWorkId,
        characterExtractionActionState,
        candidate,
      )) {
        return;
      }
      setCharacterExtractionActionState("deciding");
      setCharacterExtractionActionError(null);
      try {
        const result = await decideCharacterExtractionItemRecord({
          activeWorkId: input.activeWorkId,
          candidate,
          client: input.client,
          decision,
          item,
        });
        setCharacterExtractionCandidates((current) =>
          prependCharacterExtractionCandidate(current, result.candidate)
        );
        if (result.status === "stale") {
          setCharacterExtractionActionError(
            CHARACTER_MESSAGES.extractionCandidateStale,
          );
          return;
        }
        setCharacters(result.characters);
        const decidedItem = result.candidate.items.find(
          (entry) => entry.itemId === item.itemId,
        );
        if (decidedItem?.approvedCharacterId != null) {
          setSelectedCharacterId(decidedItem.approvedCharacterId);
        }
      } catch (reason) {
        setCharacterExtractionActionError(
          reason instanceof Error
            ? reason.message
            : CHARACTER_MESSAGES.extractionDecisionFailed,
        );
      } finally {
        setCharacterExtractionActionState("idle");
      }
    },
    [characterExtractionActionState, input.activeWorkId, input.client],
  );

  const performCharacterGeneration = useCallback(
    async (brief: CharacterGenerationBrief) => {
      if (!canRunCharacterGeneration(
        input.activeWorkId,
        characterGenerationActionState,
      )) {
        return;
      }
      setCharacterGenerationActionState("generating");
      setCharacterGenerationActionError(null);
      try {
        const result = await runCharacterGenerationRecord({
          activeWorkId: input.activeWorkId,
          brief,
          client: input.client,
          requestId: entityId<"CharacterGenerationRequest">(
            crypto.randomUUID(),
          ),
        });
        const outcome = resolveCharacterGenerationRunResult(result);
        if (outcome.status === "login-required") {
          setCharacterGenerationActionError(outcome.error);
          return;
        }
        setCharacterGenerationCandidates((current) =>
          prependCharacterGenerationCandidate(current, outcome.candidate)
        );
      } catch (reason) {
        setCharacterGenerationActionError(
          reason instanceof Error
            ? reason.message
            : CHARACTER_MESSAGES.generationFailed,
        );
      } finally {
        setCharacterGenerationActionState("idle");
      }
    },
    [characterGenerationActionState, input.activeWorkId, input.client],
  );

  const decideCharacterGenerationItem = useCallback(
    async (
      candidate: CharacterGenerationCandidate,
      item: CharacterGenerationItem,
      decision: CharacterExtractionDecision,
    ) => {
      if (!canDecideCharacterGeneration(
        input.activeWorkId,
        characterGenerationActionState,
        candidate,
      )) {
        return;
      }
      setCharacterGenerationActionState("deciding");
      setCharacterGenerationActionError(null);
      try {
        const result = await decideCharacterGenerationItemRecord({
          activeWorkId: input.activeWorkId,
          candidate,
          client: input.client,
          decision,
          item,
        });
        setCharacterGenerationCandidates((current) =>
          prependCharacterGenerationCandidate(current, result.candidate)
        );
        setCharacters(result.characters);
        const decidedItem = result.candidate.items.find(
          (entry) => entry.itemId === item.itemId,
        );
        if (decidedItem?.approvedCharacterId != null) {
          setSelectedCharacterId(decidedItem.approvedCharacterId);
        }
      } catch (reason) {
        setCharacterGenerationActionError(
          reason instanceof Error
            ? reason.message
            : CHARACTER_MESSAGES.generationDecisionFailed,
        );
      } finally {
        setCharacterGenerationActionState("idle");
      }
    },
    [characterGenerationActionState, input.activeWorkId, input.client],
  );

  const addCharacterEvidence = useCallback(
    async (character: CharacterProjection) => {
      if (!canAddCharacterEvidence(
        input.activeWorkId,
        characterExtractionActionState,
        character,
        characterWorkspaceSelection !== null,
      ) || characterWorkspaceSelection === null) {
        return;
      }
      setCharacterExtractionActionState("adding-evidence");
      setCharacterExtractionActionError(null);
      try {
        const updated = await addCharacterEvidenceRecord({
          activeWorkId: input.activeWorkId,
          character,
          client: input.client,
          selection: characterWorkspaceSelection,
        });
        setCharacters((current) =>
          prependCharacterEvidenceUpdate(current, updated)
        );
      } catch (reason) {
        setCharacterExtractionActionError(
          reason instanceof Error
            ? reason.message
            : CHARACTER_MESSAGES.evidenceFailed,
        );
      } finally {
        setCharacterExtractionActionState("idle");
      }
    },
    [
      characterExtractionActionState,
      characterWorkspaceSelection,
      input.activeWorkId,
      input.client,
    ],
  );

  const openCharacterDialog = useCallback(() => {
    const state = openCharacterDialogState();
    setCharacterActionError(state.error);
    setCharacterDialogOpen(state.dialogOpen);
  }, []);

  const closeCharacterDialog = useCallback(() => {
    const state = closeCharacterDialogState(characterActionState);
    if (state === null) return;
    setCharacterDialogOpen(state.dialogOpen);
    setCharacterActionError(state.error);
  }, [characterActionState]);

  const hideCharacterDialog = useCallback(() => {
    setCharacterDialogOpen(false);
  }, []);

  const focusCharacterInStructure = useCallback((characterId: string) => {
    const state = focusCharacterInStructureState(characterId);
    setSelectedCharacterId(state.selectedCharacterId);
    setCharacterActionError(state.error);
    setCharacterDialogOpen(state.dialogOpen);
  }, []);

  const selectCharacter = useCallback((characterId: string | null) => {
    setSelectedCharacterId(characterId);
  }, []);

  const rejectCharacterEvidenceNavigation = useCallback((message: string) => {
    const state = characterEvidenceNavigationRejectedState(message);
    setCharacterExtractionActionError(state.error);
  }, []);

  const startVisibleCharacterEvidenceNavigation = useCallback(() => {
    const state = characterEvidenceNavigationVisibleState();
    setCharacterExtractionActionError(state.error);
  }, []);

  const startCharacterEvidenceActivation = useCallback(() => {
    const state = characterEvidenceNavigationActivationState();
    setCharacterExtractionActionState(state.actionState);
  }, []);

  const applyCharacterEvidenceTabPolicy = useCallback(() => {
    const state = characterEvidenceNavigationIdleState();
    setCharacterExtractionActionState(state.actionState);
  }, []);

  const supersedeCharacterEvidenceNavigation = useCallback((
    crossDocumentActivationStarted: boolean,
  ) => {
    if (crossDocumentActivationStarted) {
      const state = characterEvidenceNavigationIdleState();
      setCharacterExtractionActionState(state.actionState);
    }
  }, []);

  const completeCharacterEvidenceNavigation = useCallback((
    path: "same-document" | "visible-transition" | "cross-document",
  ) => {
    const state = characterEvidenceNavigationOpenedState(path);
    if (state === null) return;
    setCharacterExtractionActionState(state.actionState);
    setCharacterExtractionActionError(state.error);
  }, []);

  const failCharacterEvidenceNavigation = useCallback((
    message: string,
    crossDocumentActivationStarted: boolean,
  ) => {
    const state = characterEvidenceNavigationFailedState(
      message,
      crossDocumentActivationStarted,
    );
    if (crossDocumentActivationStarted) {
      setCharacterExtractionActionState("idle");
    }
    setCharacterExtractionActionError(state.error);
  }, []);

  const evidenceNavigation = useMemo<CharacterEvidenceNavigationStatePort>(
    () => Object.freeze({
      reject: rejectCharacterEvidenceNavigation,
      visibleTransitionStarted: startVisibleCharacterEvidenceNavigation,
      activationStarted: startCharacterEvidenceActivation,
      tabPolicyApplied: applyCharacterEvidenceTabPolicy,
      superseded: supersedeCharacterEvidenceNavigation,
      opened: completeCharacterEvidenceNavigation,
      failed: failCharacterEvidenceNavigation,
    }),
    [
      applyCharacterEvidenceTabPolicy,
      completeCharacterEvidenceNavigation,
      failCharacterEvidenceNavigation,
      rejectCharacterEvidenceNavigation,
      startCharacterEvidenceActivation,
      startVisibleCharacterEvidenceNavigation,
      supersedeCharacterEvidenceNavigation,
    ],
  );

  return {
    characters,
    characterRelations,
    characterDialogOpen,
    selectedCharacterId,
    characterActionState,
    characterRelationActionState,
    characterActionError,
    characterWorkspaceSelection,
    characterExtractionCandidates,
    characterExtractionActionState,
    characterExtractionActionError,
    characterExtractionPermissionRequired,
    characterGenerationCandidates,
    characterGenerationActionState,
    characterGenerationActionError,
    createCharacter,
    updateCharacter,
    retireCharacter,
    createCharacterRelation,
    updateCharacterRelation,
    retireCharacterRelation,
    captureWorkspaceSelection,
    performCharacterExtraction,
    grantCharacterExtractionPermission,
    decideCharacterExtractionItem,
    performCharacterGeneration,
    decideCharacterGenerationItem,
    addCharacterEvidence,
    openCharacterDialog,
    closeCharacterDialog,
    hideCharacterDialog,
    focusCharacterInStructure,
    selectCharacter,
    evidenceNavigation,
  };
}

export type {
  CharacterDraftInput,
  CharacterRelationDraftInput,
  CharactersManuscriptPort,
  CharactersWorkspaceCompatibilityPort,
} from "./characters-client";
