import type { ChatGptOAuthConnectionStatus } from "../../../application/assistant/chatgpt-oauth";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  CharacterProjection,
  CreateCharacterCommand,
  UpdateCharacterCommand,
} from "../../../application/characters/character-contract";
import type {
  CharacterExtractionCandidate,
  CharacterExtractionDecision,
  CharacterExtractionDecisionResult,
  CharacterExtractionItem,
  CharacterExtractionResult,
} from "../../../application/characters/character-extraction-contract";
import type {
  CharacterGenerationBrief,
  CharacterGenerationCandidate,
  CharacterGenerationDecisionResult,
  CharacterGenerationItem,
  CharacterGenerationResult,
} from "../../../application/characters/character-generation-contract";
import type {
  CharacterRelationProjection,
  UpdateCharacterRelationCommand,
} from "../../../application/characters/character-relation-contract";
import { entityId, type EntityId } from "../../../domain/writing";
import type { CharacterWorkspaceSelection } from "../../editor/CharacterWorkspace";

export type CharactersClient = Pick<
  StudioBridge["characters"],
  | "create"
  | "list"
  | "update"
  | "addEvidence"
  | "retire"
  | "createRelation"
  | "listRelations"
  | "updateRelation"
  | "retireRelation"
  | "runExtraction"
  | "listExtractionCandidates"
  | "decideExtractionItem"
  | "runGeneration"
  | "listGenerationCandidates"
  | "decideGenerationItem"
>;

export type CharactersAssistantClient = Pick<
  StudioBridge["assistant"],
  "getChatGptOAuthStatus" | "grantContextPermission"
>;

export type CharacterDraftInput = Pick<
  CreateCharacterCommand,
  | "name"
  | "aliases"
  | "role"
  | "summary"
  | "appearance"
  | "personality"
  | "speech"
  | "goal"
  | "conflict"
  | "note"
>;

export type CharacterRelationDraftInput = Readonly<{
  toCharacterId: string;
  kind: string;
  description: string;
}>;

export type CharactersSelection = Readonly<{
  from: number;
  to: number;
  empty: boolean;
}>;

export type CharactersManuscriptPort = Readonly<{
  readSelection: (
    document: ManuscriptDocumentSource,
  ) => CharactersSelection | undefined;
  persist: (document: ManuscriptDocumentSource) => Promise<void>;
  currentRevisionId: (
    document: ManuscriptDocumentSource,
  ) => EntityId<"DocumentRevision"> | null;
}>;

export type CharactersEditorCapabilities = Omit<
  CharactersManuscriptPort,
  "persist"
>;

export function createCharactersManuscriptPort(
  editor: CharactersEditorCapabilities,
  persist: CharactersManuscriptPort["persist"],
): CharactersManuscriptPort {
  return Object.freeze({ ...editor, persist });
}

export type CharactersWorkspaceCompatibilityPort = Readonly<{
  publishOAuthStatus: (status: ChatGptOAuthConnectionStatus) => void;
  resetWorkspaceSurfaceAfterNullWork: () => void;
}>;

export type CharactersTimerPort = Readonly<{
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
}>;

const DEFAULT_TIMER_PORT: CharactersTimerPort = Object.freeze({
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export async function loadCanonicalCharacterRecords(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: Pick<CharactersClient, "list" | "listRelations">;
}>): Promise<Readonly<{
  characters: readonly CharacterProjection[];
  relations: readonly CharacterRelationProjection[];
}>> {
  const [characterProjection, relationProjection] = await Promise.all([
    input.client.list({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listRelations({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
  ]);
  return Object.freeze({
    characters: characterProjection.characters,
    relations: relationProjection.relations,
  });
}

export function startCharactersWorkLoad(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  assistantClient: CharactersAssistantClient;
  client: CharactersClient;
  onFailed: () => void;
  onLoaded: (
    characters: readonly CharacterProjection[],
    relations: readonly CharacterRelationProjection[],
    extractionCandidates: readonly CharacterExtractionCandidate[],
    generationCandidates: readonly CharacterGenerationCandidate[],
    oauthStatus: ChatGptOAuthConnectionStatus,
  ) => void;
  onReset: () => void;
  timer?: CharactersTimerPort;
}>): () => void {
  if (input.activeWorkId === null) {
    const timer = input.timer ?? DEFAULT_TIMER_PORT;
    const reset = timer.schedule(input.onReset, 0);
    return () => timer.cancel(reset);
  }
  let disposed = false;
  void Promise.all([
    input.client.list({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listRelations({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listExtractionCandidates({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listGenerationCandidates({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.assistantClient.getChatGptOAuthStatus(),
  ]).then(
    ([
      projection,
      relationProjection,
      extractionProjection,
      generationProjection,
      oauthStatus,
    ]) => {
      if (!disposed) {
        input.onLoaded(
          projection.characters,
          relationProjection.relations,
          extractionProjection.candidates,
          generationProjection.candidates,
          oauthStatus,
        );
      }
    },
    () => {
      if (!disposed) input.onFailed();
    },
  );
  return () => {
    disposed = true;
  };
}

export type CaptureCharacterWorkspaceSelectionOutcome =
  | Readonly<{
      selection: CharacterWorkspaceSelection;
      status: "captured";
    }>
  | Readonly<{ status: "selection-unavailable" }>
  | Readonly<{ status: "persist-failed" }>;

export async function captureCharacterWorkspaceSelectionThroughPort(
  document: ManuscriptDocumentSource | null,
  manuscript: CharactersManuscriptPort | null,
): Promise<CaptureCharacterWorkspaceSelectionOutcome> {
  if (document === null || manuscript === null) {
    return Object.freeze({ status: "selection-unavailable" });
  }
  const range = manuscript.readSelection(document);
  if (range === undefined || range.empty) {
    return Object.freeze({ status: "selection-unavailable" });
  }
  try {
    await manuscript.persist(document);
    const documentRevisionId = manuscript.currentRevisionId(document);
    if (documentRevisionId === null) {
      return Object.freeze({ status: "selection-unavailable" });
    }
    return Object.freeze({
      selection: Object.freeze({
        documentId: document.documentId,
        documentTitle: document.label,
        documentRevisionId,
        from: range.from,
        to: range.to,
      }),
      status: "captured",
    });
  } catch {
    return Object.freeze({ status: "persist-failed" });
  }
}

export function createCharacterRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: CharactersClient;
  draft: CharacterDraftInput;
}>): Promise<CharacterProjection> {
  return input.client.create({
    schemaVersion: 1,
    workId: input.activeWorkId,
    ...input.draft,
  });
}

export function updateCharacterRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  changes: UpdateCharacterCommand["changes"];
  character: CharacterProjection;
  client: CharactersClient;
}>): Promise<CharacterProjection> {
  return input.client.update({
    schemaVersion: 1,
    workId: input.activeWorkId,
    characterId: input.character.characterId,
    expectedRevision: input.character.revision,
    changes: input.changes,
  });
}

export function retireCharacterRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  character: CharacterProjection;
  client: CharactersClient;
}>): Promise<CharacterProjection> {
  return input.client.retire({
    schemaVersion: 1,
    workId: input.activeWorkId,
    characterId: input.character.characterId,
    expectedRevision: input.character.revision,
  });
}

export function createCharacterRelationRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  character: CharacterProjection;
  client: CharactersClient;
  draft: CharacterRelationDraftInput;
}>): Promise<CharacterRelationProjection> {
  return input.client.createRelation({
    schemaVersion: 1,
    workId: input.activeWorkId,
    fromCharacterId: input.character.characterId,
    toCharacterId: entityId<"Character">(input.draft.toCharacterId),
    kind: input.draft.kind,
    description: input.draft.description,
  });
}

export function updateCharacterRelationRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  changes: UpdateCharacterRelationCommand["changes"];
  client: CharactersClient;
  relation: CharacterRelationProjection;
}>): Promise<CharacterRelationProjection> {
  return input.client.updateRelation({
    schemaVersion: 1,
    workId: input.activeWorkId,
    relationId: input.relation.relationId,
    expectedRevision: input.relation.revision,
    changes: input.changes,
  });
}

export function retireCharacterRelationRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: CharactersClient;
  relation: CharacterRelationProjection;
}>): Promise<CharacterRelationProjection> {
  return input.client.retireRelation({
    schemaVersion: 1,
    workId: input.activeWorkId,
    relationId: input.relation.relationId,
    expectedRevision: input.relation.revision,
  });
}

export function runCharacterExtractionRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: CharactersClient;
  conversationId: EntityId<"AssistantConversation">;
  requestId: EntityId<"CharacterExtractionRequest">;
  selection: CharacterWorkspaceSelection;
}>): Promise<CharacterExtractionResult> {
  return input.client.runExtraction({
    schemaVersion: 1,
    requestId: input.requestId,
    workId: input.activeWorkId,
    conversationId: input.conversationId,
    sourceRange: {
      documentId: entityId<"Document">(input.selection.documentId),
      documentRevisionId: entityId<"DocumentRevision">(
        input.selection.documentRevisionId,
      ),
      from: input.selection.from,
      to: input.selection.to,
    },
  });
}

export function grantCharacterExtractionPermissionRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  assistantClient: CharactersAssistantClient;
  conversationId: EntityId<"AssistantConversation">;
  destinationId: string;
}>): Promise<unknown> {
  return input.assistantClient.grantContextPermission({
    schemaVersion: 1,
    workId: input.activeWorkId,
    conversationId: input.conversationId,
    capability: "character.extract",
    destinationId: input.destinationId,
    localScope: "selection",
    externalScope: "selection",
    duration: "once",
  });
}

export function decideCharacterExtractionItemRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  candidate: CharacterExtractionCandidate;
  client: CharactersClient;
  decision: CharacterExtractionDecision;
  item: CharacterExtractionItem;
}>): Promise<CharacterExtractionDecisionResult> {
  return input.client.decideExtractionItem({
    schemaVersion: 1,
    workId: input.activeWorkId,
    candidateId: input.candidate.candidateId,
    expectedCandidateRevision: input.candidate.revision,
    itemId: input.item.itemId,
    decision: input.decision,
  });
}

export function runCharacterGenerationRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  brief: CharacterGenerationBrief;
  client: CharactersClient;
  requestId: EntityId<"CharacterGenerationRequest">;
}>): Promise<CharacterGenerationResult> {
  return input.client.runGeneration({
    schemaVersion: 1,
    requestId: input.requestId,
    workId: input.activeWorkId,
    brief: input.brief,
  });
}

export function decideCharacterGenerationItemRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  candidate: CharacterGenerationCandidate;
  client: CharactersClient;
  decision: CharacterExtractionDecision;
  item: CharacterGenerationItem;
}>): Promise<CharacterGenerationDecisionResult> {
  return input.client.decideGenerationItem({
    schemaVersion: 1,
    workId: input.activeWorkId,
    candidateId: input.candidate.candidateId,
    expectedCandidateRevision: input.candidate.revision,
    itemId: input.item.itemId,
    decision: input.decision,
  });
}

export function addCharacterEvidenceRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  character: CharacterProjection;
  client: CharactersClient;
  selection: CharacterWorkspaceSelection;
}>): Promise<CharacterProjection> {
  return input.client.addEvidence({
    schemaVersion: 1,
    workId: input.activeWorkId,
    characterId: input.character.characterId,
    expectedRevision: input.character.revision,
    documentId: entityId<"Document">(input.selection.documentId),
    documentRevisionId: entityId<"DocumentRevision">(
      input.selection.documentRevisionId,
    ),
    selection: {
      anchor: input.selection.from,
      head: input.selection.to,
    },
  });
}
