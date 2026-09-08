import { randomUUID } from "node:crypto";
import { CreateAnchor } from "../../../application/anchors/create-anchor";
import type { AssistantContextAccessResult,AssistantContextPermissionGrant,AssistantContextReceipt,AssistantContextRequest } from "../../../application/assistant/assistant-context-permission";
import { authorizeAssistantContextRequest,createAssistantContextReceipt,parseAssistantContextPermissionGrant,parseAssistantContextReceipt,parseAssistantContextRequest } from "../../../application/assistant/assistant-context-permission";
import type { AssistantContextStateProjection,GrantAssistantContextPermissionCommand,ListAssistantContextStateCommand,RevokeAssistantContextPermissionCommand } from "../../../application/assistant/assistant-context-state";
import { parseAssistantContextStateProjection,parseGrantAssistantContextPermissionCommand,parseListAssistantContextStateCommand,parseRevokeAssistantContextPermissionCommand } from "../../../application/assistant/assistant-context-state";
import type { AssistantDestinationProfile } from "../../../application/assistant/assistant-destination-profile";
import { parseAssistantDestinationProfile } from "../../../application/assistant/assistant-destination-profile";
import type { AssistantExternalSettingReviewCandidate,AssistantExternalSettingReviewReceipt,AssistantExternalSettingReviewResult,RunAssistantExternalSettingReviewCommand } from "../../../application/assistant/assistant-external-setting-review";
import { authorizeAssistantExternalSettingReview,createAssistantExternalSettingReviewRecords,parseAssistantExternalSettingReviewCandidate,parseAssistantExternalSettingReviewPayload,parseAssistantExternalSettingReviewReceipt,parseAssistantExternalSettingReviewResult,parseRunAssistantExternalSettingReviewCommand } from "../../../application/assistant/assistant-external-setting-review";
import type { AssistantNotationCandidate,AssistantNotationReviewResult,RunAssistantNotationReviewCommand } from "../../../application/assistant/assistant-notation-review";
import { createAssistantNotationFindings,parseAssistantNotationCandidate,parseAssistantNotationReviewResult,parseRunAssistantNotationReviewCommand } from "../../../application/assistant/assistant-notation-review";
import type { CancelAssistantRequestResult } from "../../../application/assistant/assistant-request-lifecycle";
import { AssistantRequestError,AssistantRequestRegistry,parseAssistantOperationResponse,throwIfAssistantRequestAborted,waitForAssistantRequest } from "../../../application/assistant/assistant-request-lifecycle";
import type { AssistantSettingConflictFinding,AssistantSettingReviewFinding,AssistantSettingReviewReceipt,AssistantSettingReviewResult,AssistantSettingReviewSource,RunAssistantSettingReviewCommand } from "../../../application/assistant/assistant-setting-review";
import { authorizeAssistantSettingReview,createAssistantSettingReviewReceipt,findExactDuplicateSettingGroups,findExactSettingConflictGroups,parseAssistantSettingConflictFinding,parseAssistantSettingReviewFinding,parseAssistantSettingReviewReceipt,parseAssistantSettingReviewResult,parseAssistantSettingReviewSource,parseRunAssistantSettingReviewCommand } from "../../../application/assistant/assistant-setting-review";
import type { AssistantVocabularyCandidate,AssistantVocabularyLookupResult,RunAssistantVocabularyLookupCommand } from "../../../application/assistant/assistant-vocabulary-lookup";
import { findExactVocabularyOccurrences,parseAssistantVocabularyCandidate,parseAssistantVocabularyLookupResult,parseRunAssistantVocabularyLookupCommand } from "../../../application/assistant/assistant-vocabulary-lookup";
import type { AssistantVocabularySuggestionCandidate,AssistantVocabularySuggestionResult,RunAssistantVocabularySuggestionCommand } from "../../../application/assistant/assistant-vocabulary-suggestion";
import { authorizeAssistantVocabularySuggestion,createAssistantVocabularySuggestionCandidate,parseAssistantVocabularySuggestionCandidate,parseAssistantVocabularySuggestionPayload,parseAssistantVocabularySuggestionResult,parseRunAssistantVocabularySuggestionCommand } from "../../../application/assistant/assistant-vocabulary-suggestion";
import { parseCharacterProjection } from "../../../application/characters/character-contract";
import type { CharacterExtractionCandidate,CharacterExtractionCandidateList,CharacterExtractionDecisionResult,CharacterExtractionResult,DecideCharacterExtractionItemCommand,ListCharacterExtractionCandidatesCommand,RunCharacterExtractionCommand } from "../../../application/characters/character-extraction-contract";
import { CHARACTER_EXTRACTION_PROMPT_VERSION,createCharacterExtractionParagraphs,parseCharacterExtractionCandidate,parseCharacterExtractionCandidateList,parseCharacterExtractionDecisionResult,parseCharacterExtractionResult,parseDecideCharacterExtractionItemCommand,parseListCharacterExtractionCandidatesCommand,parseRunCharacterExtractionCommand,resolveCharacterExtractionEvidences } from "../../../application/characters/character-extraction-contract";
import type { CharacterGenerationCandidateList,CharacterGenerationDecisionResult,CharacterGenerationResult,DecideCharacterGenerationItemCommand,ListCharacterGenerationCandidatesCommand,RunCharacterGenerationCommand } from "../../../application/characters/character-generation-contract";
import { CHARACTER_GENERATION_PROMPT_VERSION,parseCharacterGenerationCandidate,parseCharacterGenerationCandidateList,parseCharacterGenerationDecisionResult,parseCharacterGenerationResult,parseDecideCharacterGenerationItemCommand,parseListCharacterGenerationCandidatesCommand,parseRunCharacterGenerationCommand } from "../../../application/characters/character-generation-contract";
import { createManuscriptPreflightBoundaryContext,diagnoseManuscriptPreflight } from "../../../application/editor/manuscript-preflight";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { CompleteSceneDraftInsertionCommand,ListSceneDraftCandidatesCommand,PrepareSceneDraftInsertionCommand,PrepareSceneDraftInsertionResult,RunSceneDraftCommand,RunSceneDraftResult,SceneDraftCandidate,SceneDraftCandidateList,SceneDraftContext,UpdateSceneDraftCandidateCommand } from "../../../application/structure/scene-draft-contract";
import { parseCompleteSceneDraftInsertionCommand,parseListSceneDraftCandidatesCommand,parsePrepareSceneDraftInsertionCommand,parsePrepareSceneDraftInsertionResult,parseRunSceneDraftCommand,parseRunSceneDraftResult,parseSceneDraftCandidate,parseSceneDraftCandidateList,parseSceneDraftContext,parseUpdateSceneDraftCandidateCommand,SCENE_DRAFT_PROMPT_VERSION } from "../../../application/structure/scene-draft-contract";
import type { DecideSceneExtractionAnnotationCommand,DecideSceneExtractionBoundaryCommand,ListSceneExtractionCandidatesCommand,RunSceneExtractionCommand,SceneExtractionAnnotationDecisionResult,SceneExtractionCandidate,SceneExtractionCandidateList,SceneExtractionDecisionResult,SceneExtractionResult } from "../../../application/structure/scene-extraction-contract";
import { createSceneExtractionParagraphs,parseDecideSceneExtractionAnnotationCommand,parseDecideSceneExtractionBoundaryCommand,parseListSceneExtractionCandidatesCommand,parseRunSceneExtractionCommand,parseSceneExtractionAnnotationDecisionResult,parseSceneExtractionCandidate,parseSceneExtractionCandidateList,parseSceneExtractionDecisionResult,parseSceneExtractionResult,resolveSceneExtractionModelScenes,SCENE_EXTRACTION_PROMPT_VERSION } from "../../../application/structure/scene-extraction-contract";
import type { Poc3LedgerRecord } from "../../../domain/poc-3-storage-ledger";
import type { Anchor,EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { CharacterExtractionExecution,CharacterGenerationExecution,LocalWorkspaceRuntimeOptions,SceneDraftExecution,SceneExtractionExecution } from "../contracts";
import type { PreparedCharacterExtraction,PreparedCharacterGeneration,PreparedSceneDraft,PreparedSceneExtraction,StoredSceneDraftCandidateRow } from "../repositories/assistant";
import { readStoredCharacterExtractionCandidateRowById,readStoredCharacterExtractionCandidateRows,readStoredCharacterGenerationCandidateRowById,readStoredCharacterGenerationCandidateRows,readStoredSceneDraftCandidateRowById,readStoredSceneDraftCandidateRows,readStoredSceneExtractionCandidateRowById,readStoredSceneExtractionCandidateRows } from "../repositories/assistant";
import type { StoredCharacterRow } from "../repositories/character-lore";
import { readStoredCharacterRowById,readStoredCharacterRows,readStoredLoreEntryRowById } from "../repositories/character-lore";
import { readStoredEventBlockRowById } from "../repositories/events";
import { readStoredPlotEventLinkRows,readStoredPlotThreadRowById } from "../repositories/plots";
import { createAnchorLedgerRecord,createRecordMeta } from "../repositories/record-builders";
import { readNullableString,readRequiredInteger,readRequiredString,readString } from "../repositories/scalars";
import type { StoredSceneAnnotationRow } from "../repositories/scene-annotations";
import { readStoredSceneAnnotationRowByKey } from "../repositories/scene-annotations";
import type { StoredSceneMetadataBindingRow } from "../repositories/scene-geometry";
import { WORK_SCENE_RULE_REVISION_SQL } from "../repositories/scene-geometry";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { CharacterLoreService } from "./character-lore";
import type { InfrastructureService } from "./infrastructure";
import type { SceneAnnotationsService } from "./scene-annotations";
import type { SceneGeometryService } from "./scene-geometry";
import type { SettingsService } from "./settings";

/** Owns assistant commands and their existing transaction boundaries. */
export class AssistantService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "assistantDestinationProfile" | "executeAssistantVocabularySuggestion" | "executeAssistantExternalSettingReview" | "characterExtraction" | "defaults" | "characterGeneration" | "sceneExtraction" | "sceneDraft">;
  readonly #assistantRequests = new AssistantRequestRegistry();
  readonly #database: NodeSqliteDatabase;
  readonly #revisionStore: RevisionStore;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen" | "assertAssistantWorkExists">;
  readonly #character_lore: Pick<CharacterLoreService, "projectCharacterRow">;
  readonly #scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially" | "prepareSceneIdentityRecords" | "readActiveSceneMetadataBinding">;
  readonly #scene_annotations: Pick<SceneAnnotationsService, "listSceneAnnotationsSerially">;
  readonly #settings: Pick<SettingsService, "getManuscriptPreflightSettingsSerially">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "assistantDestinationProfile" | "executeAssistantVocabularySuggestion" | "executeAssistantExternalSettingReview" | "characterExtraction" | "defaults" | "characterGeneration" | "sceneExtraction" | "sceneDraft">;
    readonly database: NodeSqliteDatabase;
    readonly revisionStore: RevisionStore;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen" | "assertAssistantWorkExists">;
    readonly character_lore: Pick<CharacterLoreService, "projectCharacterRow">;
    readonly scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially" | "prepareSceneIdentityRecords" | "readActiveSceneMetadataBinding">;
    readonly scene_annotations: Pick<SceneAnnotationsService, "listSceneAnnotationsSerially">;
    readonly settings: Pick<SettingsService, "getManuscriptPreflightSettingsSerially">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#options = input.options;
    this.#database = input.database;
    this.#revisionStore = input.revisionStore;
    this.#ledger = input.ledger;
    this.#infrastructure = input.infrastructure;
    this.#character_lore = input.character_lore;
    this.#scene_geometry = input.scene_geometry;
    this.#scene_annotations = input.scene_annotations;
    this.#settings = input.settings;
  }

  #getAssistantDestinationProfile(): AssistantDestinationProfile {
    const profile = this.#options.assistantDestinationProfile;
    if (profile === undefined) {
      throw new Error("Assistant destination profile is not configured");
    }
    return parseAssistantDestinationProfile(profile);
  }

  listAssistantContextState(
    value: unknown,
  ): Promise<AssistantContextStateProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListAssistantContextStateCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listAssistantContextStateSerially(command),
    );
  }

  grantAssistantContextPermission(
    value: unknown,
  ): Promise<AssistantContextPermissionGrant> {
    this.#infrastructure.assertOpen();
    const command = parseGrantAssistantContextPermissionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#grantAssistantContextPermissionSerially(command);
    });

    return execution;
  }

  revokeAssistantContextPermission(
    value: unknown,
  ): Promise<AssistantContextPermissionGrant> {
    this.#infrastructure.assertOpen();
    const command = parseRevokeAssistantContextPermissionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#revokeAssistantContextPermissionSerially(command);
    });

    return execution;
  }

  authorizeAssistantContextAccess(
    value: unknown,
  ): Promise<AssistantContextAccessResult> {
    this.#infrastructure.assertOpen();
    const request = parseAssistantContextRequest(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.authorizeAssistantContextAccessSerially(request);
    });

    return execution;
  }

  getAssistantDestinationProfile(): AssistantDestinationProfile {
    this.#infrastructure.assertOpen();
    return this.#getAssistantDestinationProfile();
  }

  runAssistantVocabularyLookup(
    value: unknown,
  ): Promise<AssistantVocabularyLookupResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunAssistantVocabularyLookupCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#runAssistantVocabularyLookupSerially(command);
    });

    return execution;
  }

  runAssistantVocabularySuggestion(
    value: unknown,
  ): Promise<AssistantVocabularySuggestionResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunAssistantVocabularySuggestionCommand(value);
    return this.#assistantRequests.run(command, (signal) => {
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      throwIfAssistantRequestAborted(signal);
      await priorSaves;
      throwIfAssistantRequestAborted(signal);
      return this.#runAssistantVocabularySuggestionSerially(command, signal);
    });

    return execution;
    });
  }

  runAssistantExternalSettingReview(
    value: unknown,
  ): Promise<AssistantExternalSettingReviewResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunAssistantExternalSettingReviewCommand(value);
    return this.#assistantRequests.run(command, (signal) => {
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      throwIfAssistantRequestAborted(signal);
      await priorSaves;
      throwIfAssistantRequestAborted(signal);
      return this.#runAssistantExternalSettingReviewSerially(command, signal);
    });

    return execution;
    });
  }

  cancelAssistantRequest(value: unknown): CancelAssistantRequestResult {
    this.#infrastructure.assertOpen();
    return this.#assistantRequests.cancel(value);
  }

  runCharacterExtraction(value: unknown): Promise<CharacterExtractionResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunCharacterExtractionCommand(value);
    const preparation = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#prepareCharacterExtractionSerially(command);
    });

    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const executed = await prepared.execute();
      const recording = this.#operations.enqueueMutation(async (priorSaves) => {
        await priorSaves;
        return this.#recordCharacterExtractionSerially(
          prepared,
          executed,
        );
      });

      return recording;
    });
  }

  listCharacterExtractionCandidates(
    value: unknown,
  ): Promise<CharacterExtractionCandidateList> {
    this.#infrastructure.assertOpen();
    const command = parseListCharacterExtractionCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listCharacterExtractionCandidatesSerially(command)
    );
  }

  decideCharacterExtractionItem(
    value: unknown,
  ): Promise<CharacterExtractionDecisionResult> {
    this.#infrastructure.assertOpen();
    const command = parseDecideCharacterExtractionItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#decideCharacterExtractionItemSerially(command);
    });

    return execution;
  }

  runCharacterGeneration(value: unknown): Promise<CharacterGenerationResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunCharacterGenerationCommand(value);
    const preparation = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#prepareCharacterGenerationSerially(command);
    });

    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const executed = await prepared.execute();
      const recording = this.#operations.enqueueMutation(async (priorSaves) => {
        await priorSaves;
        return this.#recordCharacterGenerationSerially(prepared, executed);
      });

      return recording;
    });
  }

  listCharacterGenerationCandidates(
    value: unknown,
  ): Promise<CharacterGenerationCandidateList> {
    this.#infrastructure.assertOpen();
    const command = parseListCharacterGenerationCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listCharacterGenerationCandidatesSerially(command)
    );
  }

  decideCharacterGenerationItem(
    value: unknown,
  ): Promise<CharacterGenerationDecisionResult> {
    this.#infrastructure.assertOpen();
    const command = parseDecideCharacterGenerationItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#decideCharacterGenerationItemSerially(command);
    });

    return execution;
  }

  runSceneExtraction(value: unknown): Promise<SceneExtractionResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunSceneExtractionCommand(value);
    const preparation = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#prepareSceneExtractionSerially(command);
    });

    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const executed = await prepared.execute();
      const recording = this.#operations.enqueueMutation(async (priorSaves) => {
        await priorSaves;
        return this.#recordSceneExtractionSerially(prepared, executed);
      });

      return recording;
    });
  }

  listSceneExtractionCandidates(
    value: unknown,
  ): Promise<SceneExtractionCandidateList> {
    this.#infrastructure.assertOpen();
    const command = parseListSceneExtractionCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listSceneExtractionCandidatesSerially(command)
    );
  }

  decideSceneExtractionBoundary(
    value: unknown,
  ): Promise<SceneExtractionDecisionResult> {
    this.#infrastructure.assertOpen();
    const command = parseDecideSceneExtractionBoundaryCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#decideSceneExtractionBoundarySerially(command);
    });

    return execution;
  }

  decideSceneExtractionAnnotation(
    value: unknown,
  ): Promise<SceneExtractionAnnotationDecisionResult> {
    this.#infrastructure.assertOpen();
    const command = parseDecideSceneExtractionAnnotationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#decideSceneExtractionAnnotationSerially(command);
    });

    return execution;
  }

  runSceneDraft(value: unknown): Promise<RunSceneDraftResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunSceneDraftCommand(value);
    const preparation = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#prepareSceneDraftSerially(command);
    });

    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const executed = await prepared.execute();
      const recording = this.#operations.enqueueMutation(async (priorSaves) => {
        await priorSaves;
        return this.#recordSceneDraftSerially(prepared, executed);
      });

      return recording;
    });
  }

  listSceneDraftCandidates(value: unknown): Promise<SceneDraftCandidateList> {
    this.#infrastructure.assertOpen();
    const command = parseListSceneDraftCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listSceneDraftCandidatesSerially(command)
    );
  }

  updateSceneDraftCandidate(value: unknown): Promise<SceneDraftCandidate> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateSceneDraftCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateSceneDraftCandidateSerially(command);
    });

    return execution;
  }

  prepareSceneDraftInsertion(
    value: unknown,
  ): Promise<PrepareSceneDraftInsertionResult> {
    this.#infrastructure.assertOpen();
    const command = parsePrepareSceneDraftInsertionCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#prepareSceneDraftInsertionSerially(command)
    );
  }

  completeSceneDraftInsertion(value: unknown): Promise<SceneDraftCandidate> {
    this.#infrastructure.assertOpen();
    const command = parseCompleteSceneDraftInsertionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#completeSceneDraftInsertionSerially(command);
    });

    return execution;
  }

  runAssistantNotationReview(
    value: unknown,
  ): Promise<AssistantNotationReviewResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunAssistantNotationReviewCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#runAssistantNotationReviewSerially(command);
    });

    return execution;
  }

  runAssistantSettingReview(
    value: unknown,
  ): Promise<AssistantSettingReviewResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunAssistantSettingReviewCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#runAssistantSettingReviewSerially(command);
    });

    return execution;
  }

  #parseAssistantPermissionGrantRow(
    row: Record<string, unknown>,
  ): AssistantContextPermissionGrant {
    const label = "Assistant context permission grant row";
    return parseAssistantContextPermissionGrant({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      grantId: readRequiredString(row, "grantId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readNullableString(row, "conversationId", label),
      capability: readRequiredString(row, "capability", label),
      destinationId: readRequiredString(row, "destinationId", label),
      localScope: readRequiredString(row, "localScope", label),
      externalScope: readRequiredString(row, "externalScope", label),
      duration: readRequiredString(row, "duration", label),
      createdAt: readRequiredString(row, "createdAt", label),
      revokedAt: readNullableString(row, "revokedAt", label),
      consumedAt: readNullableString(row, "consumedAt", label),
    });
  }

  #readAssistantPermissionGrants(
    workId: EntityId<"Work">,
    conversationId: EntityId<"AssistantConversation">,
  ): readonly AssistantContextPermissionGrant[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "grantId",
            revision,
            work_id AS "workId",
            conversation_id AS "conversationId",
            capability,
            destination_id AS "destinationId",
            local_scope AS "localScope",
            external_scope AS "externalScope",
            duration,
            created_at AS "createdAt",
            revoked_at AS "revokedAt",
            consumed_at AS "consumedAt"
          FROM assistant_context_permission_grants
          WHERE
            work_id = ? AND
            (duration = 'work' OR conversation_id = ?)
          ORDER BY created_at, id
        `)
        .all(workId, conversationId)
        .map((row) =>
          this.#parseAssistantPermissionGrantRow(
            row as Record<string, unknown>,
          )
        ),
    );
  }

  #readAssistantPermissionGrant(
    workId: EntityId<"Work">,
    grantId: EntityId<"AssistantContextPermissionGrant">,
  ): AssistantContextPermissionGrant {
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          id AS "grantId",
          revision,
          work_id AS "workId",
          conversation_id AS "conversationId",
          capability,
          destination_id AS "destinationId",
          local_scope AS "localScope",
          external_scope AS "externalScope",
          duration,
          created_at AS "createdAt",
          revoked_at AS "revokedAt",
          consumed_at AS "consumedAt"
        FROM assistant_context_permission_grants
        WHERE work_id = ? AND id = ?
      `)
      .all(workId, grantId);
    if (rows.length !== 1) {
      throw new Error(`Unknown assistant context permission grant: ${grantId}`);
    }
    return this.#parseAssistantPermissionGrantRow(
      (rows[0] ?? {}) as Record<string, unknown>,
    );
  }

  #parseAssistantReceiptJson(value: string, label: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(`${label} is invalid JSON`);
    }
  }

  #parseAssistantContextReceiptRow(
    row: Record<string, unknown>,
  ): AssistantContextReceipt {
    const label = "Assistant context receipt row";
    return parseAssistantContextReceipt({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      receiptId: readRequiredString(row, "receiptId", label),
      requestId: readRequiredString(row, "requestId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      capability: readRequiredString(row, "capability", label),
      destinationId: readRequiredString(row, "destinationId", label),
      readRanges: this.#parseAssistantReceiptJson(
        readRequiredString(row, "readRangesJson", label),
        `${label}.readRangesJson`,
      ),
      transmittedRanges: this.#parseAssistantReceiptJson(
        readRequiredString(row, "transmittedRangesJson", label),
        `${label}.transmittedRangesJson`,
      ),
      readCharacterCount: readRequiredInteger(
        row,
        "readCharacterCount",
        label,
      ),
      transmittedCharacterCount: readRequiredInteger(
        row,
        "transmittedCharacterCount",
        label,
      ),
      grantIds: this.#parseAssistantReceiptJson(
        readRequiredString(row, "grantIdsJson", label),
        `${label}.grantIdsJson`,
      ),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantContextReceipts(
    workId: EntityId<"Work">,
    conversationId: EntityId<"AssistantConversation">,
  ): readonly AssistantContextReceipt[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "receiptId",
            request_id AS "requestId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            capability,
            destination_id AS "destinationId",
            read_ranges_json AS "readRangesJson",
            transmitted_ranges_json AS "transmittedRangesJson",
            read_character_count AS "readCharacterCount",
            transmitted_character_count AS "transmittedCharacterCount",
            grant_ids_json AS "grantIdsJson",
            created_at AS "createdAt"
          FROM assistant_context_receipts
          WHERE work_id = ? AND conversation_id = ?
          ORDER BY created_at, id
        `)
        .all(workId, conversationId)
        .map((row) =>
          this.#parseAssistantContextReceiptRow(
            row as Record<string, unknown>,
          )
        ),
    );
  }

  #parseAssistantVocabularyCandidateRow(
    row: Record<string, unknown>,
  ): AssistantVocabularyCandidate {
    const label = "Assistant vocabulary candidate row";
    return parseAssistantVocabularyCandidate({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      candidateId: readRequiredString(row, "candidateId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      destinationId: readRequiredString(row, "destinationId", label),
      sourceRange: this.#parseAssistantReceiptJson(
        readRequiredString(row, "sourceRangeJson", label),
        `${label}.sourceRangeJson`,
      ),
      query: readRequiredString(row, "query", label),
      occurrences: this.#parseAssistantReceiptJson(
        readRequiredString(row, "occurrencesJson", label),
        `${label}.occurrencesJson`,
      ),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantVocabularyCandidates(
    workId: EntityId<"Work">,
  ): readonly AssistantVocabularyCandidate[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "candidateId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            source_range_json AS "sourceRangeJson",
            query_text AS "query",
            occurrences_json AS "occurrencesJson",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_vocabulary_candidates
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) =>
          this.#parseAssistantVocabularyCandidateRow(
            row as Record<string, unknown>,
          )
        ),
    );
  }

  #parseAssistantVocabularySuggestionCandidateRow(
    row: Record<string, unknown>,
  ): AssistantVocabularySuggestionCandidate {
    const label = "Assistant vocabulary suggestion candidate row";
    return parseAssistantVocabularySuggestionCandidate({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      candidateId: readRequiredString(row, "candidateId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      connectionId: readRequiredString(row, "connectionId", label),
      query: readRequiredString(row, "query", label),
      sourceRange: this.#parseAssistantReceiptJson(
        readRequiredString(row, "sourceRangeJson", label),
        `${label}.sourceRangeJson`,
      ),
      suggestions: this.#parseAssistantReceiptJson(
        readRequiredString(row, "suggestionsJson", label),
        `${label}.suggestionsJson`,
      ),
      note: readString(row, "note", label),
      connectorReceiptId: readRequiredString(
        row,
        "connectorReceiptId",
        label,
      ),
      contextReceiptId: readNullableString(row, "contextReceiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantVocabularySuggestionCandidates(
    workId: EntityId<"Work">,
  ): readonly AssistantVocabularySuggestionCandidate[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "candidateId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            connection_id AS "connectionId",
            query_text AS "query",
            source_range_json AS "sourceRangeJson",
            suggestions_json AS "suggestionsJson",
            note_text AS "note",
            connector_receipt_id AS "connectorReceiptId",
            context_receipt_id AS "contextReceiptId",
            created_at AS "createdAt"
          FROM assistant_vocabulary_suggestion_candidates
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantVocabularySuggestionCandidateRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantExternalSettingReviewReceiptRow(
    row: Record<string, unknown>,
  ): AssistantExternalSettingReviewReceipt {
    const label = "Assistant external setting review receipt row";
    return parseAssistantExternalSettingReviewReceipt({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      receiptId: readRequiredString(row, "receiptId", label),
      requestId: readRequiredString(row, "requestId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      connectionId: readRequiredString(row, "connectionId", label),
      sourceRange: this.#parseAssistantReceiptJson(
        readRequiredString(row, "sourceRangeJson", label),
        `${label}.sourceRangeJson`,
      ),
      transmittedSettings: this.#parseAssistantReceiptJson(
        readRequiredString(row, "transmittedSettingsJson", label),
        `${label}.transmittedSettingsJson`,
      ),
      transmittedSettingCount: readRequiredInteger(
        row,
        "transmittedSettingCount",
        label,
      ),
      connectorReceiptId: readRequiredString(
        row,
        "connectorReceiptId",
        label,
      ),
      contextReceiptId: readRequiredString(row, "contextReceiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantExternalSettingReviewReceipts(
    workId: EntityId<"Work">,
  ): readonly AssistantExternalSettingReviewReceipt[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "receiptId",
            request_id AS "requestId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            connection_id AS "connectionId",
            source_range_json AS "sourceRangeJson",
            transmitted_settings_json AS "transmittedSettingsJson",
            transmitted_setting_count AS "transmittedSettingCount",
            connector_receipt_id AS "connectorReceiptId",
            context_receipt_id AS "contextReceiptId",
            created_at AS "createdAt"
          FROM assistant_external_setting_review_receipts
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantExternalSettingReviewReceiptRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantExternalSettingReviewCandidateRow(
    row: Record<string, unknown>,
  ): AssistantExternalSettingReviewCandidate {
    const label = "Assistant external setting review Candidate row";
    return parseAssistantExternalSettingReviewCandidate({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      candidateId: readRequiredString(row, "candidateId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      connectionId: readRequiredString(row, "connectionId", label),
      query: readRequiredString(row, "query", label),
      reply: readString(row, "reply", label),
      proposals: this.#parseAssistantReceiptJson(
        readRequiredString(row, "proposalsJson", label),
        `${label}.proposalsJson`,
      ),
      reviewNotes: this.#parseAssistantReceiptJson(
        readRequiredString(row, "reviewNotesJson", label),
        `${label}.reviewNotesJson`,
      ),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantExternalSettingReviewCandidates(
    workId: EntityId<"Work">,
  ): readonly AssistantExternalSettingReviewCandidate[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "candidateId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            connection_id AS "connectionId",
            query_text AS "query",
            reply_text AS "reply",
            proposals_json AS "proposalsJson",
            review_notes_json AS "reviewNotesJson",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_external_setting_review_candidates
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantExternalSettingReviewCandidateRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantNotationCandidateRow(
    row: Record<string, unknown>,
  ): AssistantNotationCandidate {
    const label = "Assistant notation candidate row";
    return parseAssistantNotationCandidate({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      candidateId: readRequiredString(row, "candidateId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      destinationId: readRequiredString(row, "destinationId", label),
      sourceRange: this.#parseAssistantReceiptJson(
        readRequiredString(row, "sourceRangeJson", label),
        `${label}.sourceRangeJson`,
      ),
      findings: this.#parseAssistantReceiptJson(
        readRequiredString(row, "findingsJson", label),
        `${label}.findingsJson`,
      ),
      regexError: readNullableString(row, "regexError", label),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantNotationCandidates(
    workId: EntityId<"Work">,
  ): readonly AssistantNotationCandidate[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "candidateId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            source_range_json AS "sourceRangeJson",
            findings_json AS "findingsJson",
            regex_error AS "regexError",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_notation_candidates
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantNotationCandidateRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantSettingReviewReceiptRow(
    row: Record<string, unknown>,
  ): AssistantSettingReviewReceipt {
    const label = "Assistant setting review receipt row";
    return parseAssistantSettingReviewReceipt({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      receiptId: readRequiredString(row, "receiptId", label),
      requestId: readRequiredString(row, "requestId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      capability: "lore-review",
      destinationId: readRequiredString(row, "destinationId", label),
      reviewedSettings: this.#parseAssistantReceiptJson(
        readRequiredString(row, "reviewedSettingsJson", label),
        `${label}.reviewedSettingsJson`,
      ),
      transmittedSettingCount: readRequiredInteger(
        row,
        "transmittedSettingCount",
        label,
      ),
      grantIds: this.#parseAssistantReceiptJson(
        readRequiredString(row, "grantIdsJson", label),
        `${label}.grantIdsJson`,
      ),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantSettingReviewReceipts(
    workId: EntityId<"Work">,
  ): readonly AssistantSettingReviewReceipt[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "receiptId",
            request_id AS "requestId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            reviewed_settings_json AS "reviewedSettingsJson",
            transmitted_setting_count AS "transmittedSettingCount",
            grant_ids_json AS "grantIdsJson",
            created_at AS "createdAt"
          FROM assistant_setting_review_receipts
          WHERE work_id = ?
          ORDER BY created_at, id
        `)
        .all(workId)
        .map((row) => this.#parseAssistantSettingReviewReceiptRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantSettingReviewFindingRow(
    row: Record<string, unknown>,
  ): AssistantSettingReviewFinding {
    const label = "Assistant setting review finding row";
    return parseAssistantSettingReviewFinding({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      findingId: readRequiredString(row, "findingId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      destinationId: readRequiredString(row, "destinationId", label),
      kind: readRequiredString(row, "kind", label),
      settingKind: readRequiredString(row, "settingKind", label),
      label: readRequiredString(row, "label", label),
      references: this.#parseAssistantReceiptJson(
        readRequiredString(row, "referencesJson", label),
        `${label}.referencesJson`,
      ),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantSettingReviewFindings(
    workId: EntityId<"Work">,
  ): readonly AssistantSettingReviewFinding[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "findingId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            finding_kind AS "kind",
            setting_kind AS "settingKind",
            duplicate_label AS "label",
            references_json AS "referencesJson",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_setting_review_findings
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantSettingReviewFindingRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantSettingConflictFindingRow(
    row: Record<string, unknown>,
  ): AssistantSettingConflictFinding {
    const label = "Assistant setting conflict finding row";
    return parseAssistantSettingConflictFinding({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      findingId: readRequiredString(row, "findingId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      destinationId: readRequiredString(row, "destinationId", label),
      kind: readRequiredString(row, "kind", label),
      settingKind: readRequiredString(row, "settingKind", label),
      label: readRequiredString(row, "label", label),
      field: readRequiredString(row, "field", label),
      references: this.#parseAssistantReceiptJson(
        readRequiredString(row, "referencesJson", label),
        `${label}.referencesJson`,
      ),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantSettingConflictFindings(
    workId: EntityId<"Work">,
  ): readonly AssistantSettingConflictFinding[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "findingId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            finding_kind AS "kind",
            setting_kind AS "settingKind",
            duplicate_label AS "label",
            field_name AS "field",
            references_json AS "referencesJson",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_setting_conflict_findings
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantSettingConflictFindingRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #readAssistantSettingReviewSources(
    workId: EntityId<"Work">,
  ): readonly AssistantSettingReviewSource[] {
    const queries = [
      {
        kind: "character",
        sql: `
          SELECT
            id AS "entityId",
            revision,
            work_id AS "workId",
            name AS label,
            role,
            summary,
            note
          FROM characters
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY id
        `,
      },
      {
        kind: "plot",
        sql: `
          SELECT
            id AS "entityId",
            revision,
            work_id AS "workId",
            title AS label,
            stage,
            summary,
            note
          FROM plot_threads
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY id
        `,
      },
      {
        kind: "foreshadow",
        sql: `
          SELECT
            id AS "entityId",
            revision,
            work_id AS "workId",
            title AS label,
            note
          FROM foreshadow_lines
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY id
        `,
      },
    ] as const;
    return Object.freeze(queries.flatMap(({ kind, sql }) =>
      this.#database.prepare(sql).all(workId).map((row) => {
        const label = "Assistant setting review source row";
        const record = row as Record<string, unknown>;
        return parseAssistantSettingReviewSource({
          kind,
          entityId: readRequiredString(record, "entityId", label),
          revision: readRequiredInteger(record, "revision", label),
          workId: readRequiredString(record, "workId", label),
          label: readRequiredString(record, "label", label),
          fields: kind === "character"
            ? [
                { field: "role", value: readString(record, "role", label) },
                { field: "summary", value: readString(record, "summary", label) },
                { field: "note", value: readString(record, "note", label) },
              ]
            : kind === "plot"
              ? [
                  { field: "stage", value: readString(record, "stage", label) },
                  { field: "summary", value: readString(record, "summary", label) },
                  { field: "note", value: readString(record, "note", label) },
                ]
              : [
                  { field: "note", value: readString(record, "note", label) },
                ],
        });
      })
    ));
  }

  #listAssistantContextStateSerially(
    command: ListAssistantContextStateCommand,
  ): AssistantContextStateProjection {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    return parseAssistantContextStateProjection({
      schemaVersion: 1,
      workId: command.workId,
      conversationId: command.conversationId,
      grants: this.#readAssistantPermissionGrants(
        command.workId,
        command.conversationId,
      ),
      receipts: this.#readAssistantContextReceipts(
        command.workId,
        command.conversationId,
      ),
      candidates: this.#readAssistantVocabularyCandidates(command.workId),
      notationCandidates: this.#readAssistantNotationCandidates(command.workId),
      vocabularySuggestionCandidates:
        this.#readAssistantVocabularySuggestionCandidates(command.workId),
      settingReviewReceipts: this.#readAssistantSettingReviewReceipts(
        command.workId,
      ),
      settingReviewFindings: this.#readAssistantSettingReviewFindings(
        command.workId,
      ),
      settingConflictFindings: this.#readAssistantSettingConflictFindings(
        command.workId,
      ),
      externalSettingReviewReceipts:
        this.#readAssistantExternalSettingReviewReceipts(command.workId),
      externalSettingReviewCandidates:
        this.#readAssistantExternalSettingReviewCandidates(command.workId),
    });
  }

  #grantAssistantContextPermissionSerially(
    command: GrantAssistantContextPermissionCommand,
  ): AssistantContextPermissionGrant {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const grant = parseAssistantContextPermissionGrant({
      ...command,
      grantId: randomUUID(),
      revision: 1,
      createdAt: new Date().toISOString(),
      revokedAt: null,
      consumedAt: null,
    });
    this.#database
      .prepare(`
        INSERT INTO assistant_context_permission_grants (
          id,
          schema_version,
          revision,
          work_id,
          conversation_id,
          capability,
          destination_id,
          local_scope,
          external_scope,
          duration,
          created_at,
          revoked_at,
          consumed_at
        ) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      `)
      .run(
        grant.grantId,
        grant.workId,
        grant.conversationId,
        grant.capability,
        grant.destinationId,
        grant.localScope,
        grant.externalScope,
        grant.duration,
        grant.createdAt,
      );
    return this.#readAssistantPermissionGrant(grant.workId, grant.grantId);
  }

  #revokeAssistantContextPermissionSerially(
    command: RevokeAssistantContextPermissionCommand,
  ): AssistantContextPermissionGrant {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const current = this.#readAssistantPermissionGrant(
      command.workId,
      command.grantId,
    );
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Assistant context permission revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    if (current.revokedAt !== null) return current;
    const revokedAt = new Date().toISOString();
    const updated = this.#database
      .prepare(`
        UPDATE assistant_context_permission_grants
        SET revision = revision + 1, revoked_at = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND revoked_at IS NULL
      `)
      .run(
        revokedAt,
        command.workId,
        command.grantId,
        command.expectedRevision,
      );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Assistant context permission changed: ${command.grantId}`);
    }
    return this.#readAssistantPermissionGrant(
      command.workId,
      command.grantId,
    );
  }

  authorizeAssistantContextAccessSerially(
    request: AssistantContextRequest,
  ): AssistantContextAccessResult {
    this.#infrastructure.assertAssistantWorkExists(request.workId);
    const grants = this.#readAssistantPermissionGrants(
      request.workId,
      request.conversationId,
    );
    const authorization = authorizeAssistantContextRequest({
      request,
      grants,
      documents: [...this.#state.documentTargets.values()].map((target) => ({
        workId: target.workId,
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
        length: target.text.length,
      })),
    });
    if (!authorization.allowed) return authorization;
    const receipt = createAssistantContextReceipt({
      authorization,
      receiptId: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const grantId of authorization.consumedGrantIds) {
        const current = grants.find((grant) => grant.grantId === grantId);
        if (current === undefined) {
          throw new Error(`Unknown consumed assistant grant: ${grantId}`);
        }
        const consumed = this.#database
          .prepare(`
            UPDATE assistant_context_permission_grants
            SET revision = revision + 1, consumed_at = ?
            WHERE
              work_id = ? AND
              id = ? AND
              revision = ? AND
              duration = 'once' AND
              revoked_at IS NULL AND
              consumed_at IS NULL
          `)
          .run(
            receipt.createdAt,
            request.workId,
            grantId,
            current.revision,
          );
        if (Number(consumed.changes) !== 1) {
          throw new Error(`Assistant context permission changed: ${grantId}`);
        }
      }
      this.#database
        .prepare(`
          INSERT INTO assistant_context_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            capability,
            destination_id,
            read_ranges_json,
            transmitted_ranges_json,
            read_character_count,
            transmitted_character_count,
            grant_ids_json,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          receipt.receiptId,
          receipt.requestId,
          receipt.workId,
          receipt.conversationId,
          receipt.capability,
          receipt.destinationId,
          JSON.stringify(receipt.readRanges),
          JSON.stringify(receipt.transmittedRanges),
          receipt.readCharacterCount,
          receipt.transmittedCharacterCount,
          JSON.stringify(receipt.grantIds),
          receipt.createdAt,
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return Object.freeze({ allowed: true, receipt });
  }

  #runAssistantVocabularyLookupSerially(
    command: RunAssistantVocabularyLookupCommand,
  ): AssistantVocabularyLookupResult {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const destination = this.#getAssistantDestinationProfile().destinations.find(
      (entry) => entry.destinationId === command.destinationId,
    );
    if (
      destination === undefined ||
      destination.kind !== "local-exact-vocabulary-search" ||
      !destination.capabilities.includes("vocabulary-lookup")
    ) {
      throw new Error(`Unknown vocabulary lookup destination: ${command.destinationId}`);
    }
    const sourceTarget = this.#state.documentTargets.get(
      command.sourceRange.documentId,
    );
    if (sourceTarget === undefined) {
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "source-unavailable",
        documentId: command.sourceRange.documentId,
      });
    }
    if (sourceTarget.workId !== command.workId) {
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "outside-work",
        documentId: command.sourceRange.documentId,
      });
    }
    if (sourceTarget.currentRevisionId !== command.sourceRange.documentRevisionId) {
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "stale-context",
        documentId: command.sourceRange.documentId,
      });
    }
    if (command.sourceRange.to > sourceTarget.text.length) {
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "invalid-range",
        documentId: command.sourceRange.documentId,
      });
    }
    const searchDocuments = [...this.#state.documentTargets.values()]
      .filter((target) => target.workId === command.workId)
      .map((target) => ({
        workId: target.workId,
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
        text: target.text,
      }));
    const authorization = this.authorizeAssistantContextAccessSerially(
      parseAssistantContextRequest({
        schemaVersion: 1,
        requestId: command.requestId,
        workId: command.workId,
        conversationId: command.conversationId,
        capability: "vocabulary-lookup",
        destinationId: command.destinationId,
        requiredLocalScope: destination.requiredLocalScope,
        requiredExternalScope: destination.requiredExternalScope,
        readRanges: searchDocuments
          .filter((document) => document.text.length > 0)
          .map((document) => ({
            documentId: document.documentId,
            documentRevisionId: document.documentRevisionId,
            from: 0,
            to: document.text.length,
          })),
        transmittedRanges: [],
      }),
    );
    if (!authorization.allowed) {
      if (authorization.reason === "permission-required") {
        return parseAssistantVocabularyLookupResult({
          schemaVersion: 1,
          status: "permission-required",
          missing: authorization.missing,
        });
      }
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: authorization.reason,
        documentId: authorization.documentId,
      });
    }
    const query = sourceTarget.text.slice(
      command.sourceRange.from,
      command.sourceRange.to,
    );
    const candidate = parseAssistantVocabularyCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      workId: command.workId,
      conversationId: command.conversationId,
      destinationId: command.destinationId,
      sourceRange: command.sourceRange,
      query,
      occurrences: findExactVocabularyOccurrences({
        workId: command.workId,
        query,
        documents: searchDocuments,
      }),
      receiptId: authorization.receipt.receiptId,
      createdAt: new Date().toISOString(),
    });
    this.#database
      .prepare(`
        INSERT INTO assistant_vocabulary_candidates (
          id,
          schema_version,
          work_id,
          conversation_id,
          destination_id,
          source_range_json,
          query_text,
          occurrences_json,
          receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        candidate.candidateId,
        candidate.workId,
        candidate.conversationId,
        candidate.destinationId,
        JSON.stringify(candidate.sourceRange),
        candidate.query,
        JSON.stringify(candidate.occurrences),
        candidate.receiptId,
        candidate.createdAt,
      );
    return parseAssistantVocabularyLookupResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  async #runAssistantVocabularySuggestionSerially(
    command: RunAssistantVocabularySuggestionCommand,
    signal: AbortSignal,
  ): Promise<AssistantVocabularySuggestionResult> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const authorization = authorizeAssistantVocabularySuggestion({
      command,
      grants: this.#readAssistantPermissionGrants(
        command.workId,
        command.conversationId,
      ),
      documents: [...this.#state.documentTargets.values()].map((target) => ({
        workId: target.workId,
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
        length: target.text.length,
      })),
    });
    if (!authorization.allowed) {
      return authorization.reason === "permission-required"
        ? parseAssistantVocabularySuggestionResult({
            schemaVersion: 1,
            status: "permission-required",
            missing: authorization.missing,
          })
        : parseAssistantVocabularySuggestionResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: authorization.reason,
            documentId: authorization.documentId,
          });
    }
    const execute = this.#options.executeAssistantVocabularySuggestion;
    if (execute === undefined) {
      throw new Error("Assistant vocabulary suggestion connector is not configured");
    }
    let context: string | null = null;
    let contextReceiptId: EntityId<"AssistantContextReceipt"> | null = null;
    if (command.sourceRange !== null) {
      const access = this.authorizeAssistantContextAccessSerially(
        authorization.context.request,
      );
      if (!access.allowed) {
        return access.reason === "permission-required"
          ? parseAssistantVocabularySuggestionResult({
              schemaVersion: 1,
              status: "permission-required",
              missing: access.missing,
            })
          : parseAssistantVocabularySuggestionResult({
              schemaVersion: 1,
              status: "context-rejected",
              reason: access.reason,
              documentId: access.documentId,
            });
      }
      const sourceTarget = this.#state.documentTargets.get(
        command.sourceRange.documentId,
      );
      if (sourceTarget === undefined) {
        throw new Error(
          `Authorized assistant source disappeared: ${command.sourceRange.documentId}`,
        );
      }
      context = sourceTarget.text.slice(
        command.sourceRange.from,
        command.sourceRange.to,
      );
      contextReceiptId = access.receipt.receiptId;
    }
    const executed = await waitForAssistantRequest(execute(Object.freeze({
      signal,
      requestId: command.requestId,
      connectionId: command.connectionId,
      query: command.query,
      context,
    })), signal);
    throwIfAssistantRequestAborted(signal);
    if (
      String(executed.receipt.requestId) !== String(command.requestId) ||
      executed.receipt.connectionId !== command.connectionId ||
      executed.receipt.operation !== "vocabulary-suggestions"
    ) {
      throw new AssistantRequestError("invalid-response");
    }
    const candidate = createAssistantVocabularySuggestionCandidate({
      authorization,
      payload: parseAssistantOperationResponse(executed.payload, parseAssistantVocabularySuggestionPayload),
      candidateId: randomUUID(),
      connectorReceiptId: executed.receipt.receiptId,
      contextReceiptId,
      createdAt: new Date().toISOString(),
    });
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO assistant_connector_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            connection_id,
            connector_kind,
            operation,
            request_fingerprint,
            started_at,
            completed_at,
            result_state
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          executed.receipt.receiptId,
          executed.receipt.requestId,
          candidate.workId,
          candidate.conversationId,
          executed.receipt.connectionId,
          executed.receipt.connectorKind,
          executed.receipt.operation,
          executed.receipt.requestFingerprint,
          executed.receipt.startedAt,
          executed.receipt.completedAt,
          executed.receipt.resultState,
        );
      this.#database
        .prepare(`
        INSERT INTO assistant_vocabulary_suggestion_candidates (
          id,
          schema_version,
          work_id,
          conversation_id,
          connection_id,
          query_text,
          source_range_json,
          suggestions_json,
          note_text,
          connector_receipt_id,
          context_receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          candidate.candidateId,
          candidate.workId,
          candidate.conversationId,
          candidate.connectionId,
          candidate.query,
          JSON.stringify(candidate.sourceRange),
          JSON.stringify(candidate.suggestions),
          candidate.note,
          candidate.connectorReceiptId,
          candidate.contextReceiptId,
          candidate.createdAt,
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return parseAssistantVocabularySuggestionResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  async #runAssistantExternalSettingReviewSerially(
    command: RunAssistantExternalSettingReviewCommand,
    signal: AbortSignal,
  ): Promise<AssistantExternalSettingReviewResult> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const settings = this.#readAssistantSettingReviewSources(command.workId);
    const authorization = authorizeAssistantExternalSettingReview({
      command,
      grants: this.#readAssistantPermissionGrants(
        command.workId,
        command.conversationId,
      ),
      documents: [...this.#state.documentTargets.values()].map((target) => ({
        workId: target.workId,
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
        length: target.text.length,
      })),
      settings,
    });
    if (!authorization.allowed) {
      return authorization.reason === "permission-required"
        ? parseAssistantExternalSettingReviewResult({
            schemaVersion: 1,
            status: "permission-required",
            missing: authorization.missing,
          })
        : parseAssistantExternalSettingReviewResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: authorization.reason,
            documentId: authorization.documentId,
          });
    }
    const access = this.authorizeAssistantContextAccessSerially(
      authorization.context.request,
    );
    if (!access.allowed) {
      return access.reason === "permission-required"
        ? parseAssistantExternalSettingReviewResult({
            schemaVersion: 1,
            status: "permission-required",
            missing: access.missing,
          })
        : parseAssistantExternalSettingReviewResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: access.reason,
            documentId: access.documentId,
          });
    }
    const sourceTarget = this.#state.documentTargets.get(
      command.sourceRange.documentId,
    );
    if (sourceTarget === undefined) {
      throw new Error(`Authorized assistant source disappeared: ${command.sourceRange.documentId}`);
    }
    const execute = this.#options.executeAssistantExternalSettingReview;
    if (execute === undefined) {
      throw new Error("Assistant external setting review connector is not configured");
    }
    const executed = await waitForAssistantRequest(execute(Object.freeze({
      signal,
      requestId: command.requestId,
      connectionId: command.connectionId,
      query: command.query,
      sourceRange: command.sourceRange,
      manuscript: sourceTarget.text.slice(
        command.sourceRange.from,
        command.sourceRange.to,
      ),
      settings,
    })), signal);
    throwIfAssistantRequestAborted(signal);
    if (
      String(executed.receipt.requestId) !== String(command.requestId) ||
      executed.receipt.connectionId !== command.connectionId ||
      executed.receipt.operation !== "setting-review"
    ) {
      throw new AssistantRequestError("invalid-response");
    }
    const records = createAssistantExternalSettingReviewRecords({
      authorization,
      payload: parseAssistantOperationResponse(executed.payload, parseAssistantExternalSettingReviewPayload),
      candidateId: randomUUID(),
      receiptId: randomUUID(),
      connectorReceiptId: executed.receipt.receiptId,
      contextReceiptId: access.receipt.receiptId,
      createdAt: new Date().toISOString(),
    });
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO assistant_connector_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            connection_id,
            connector_kind,
            operation,
            request_fingerprint,
            started_at,
            completed_at,
            result_state
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          executed.receipt.receiptId,
          executed.receipt.requestId,
          records.receipt.workId,
          records.receipt.conversationId,
          executed.receipt.connectionId,
          executed.receipt.connectorKind,
          executed.receipt.operation,
          executed.receipt.requestFingerprint,
          executed.receipt.startedAt,
          executed.receipt.completedAt,
          executed.receipt.resultState,
        );
      this.#database
        .prepare(`
          INSERT INTO assistant_external_setting_review_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            connection_id,
            source_range_json,
            transmitted_settings_json,
            transmitted_setting_count,
            connector_receipt_id,
            context_receipt_id,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          records.receipt.receiptId,
          records.receipt.requestId,
          records.receipt.workId,
          records.receipt.conversationId,
          records.receipt.connectionId,
          JSON.stringify(records.receipt.sourceRange),
          JSON.stringify(records.receipt.transmittedSettings),
          records.receipt.transmittedSettingCount,
          records.receipt.connectorReceiptId,
          records.receipt.contextReceiptId,
          records.receipt.createdAt,
        );
      this.#database
        .prepare(`
          INSERT INTO assistant_external_setting_review_candidates (
            id,
            schema_version,
            work_id,
            conversation_id,
            connection_id,
            query_text,
            reply_text,
            proposals_json,
            review_notes_json,
            receipt_id,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          records.candidate.candidateId,
          records.candidate.workId,
          records.candidate.conversationId,
          records.candidate.connectionId,
          records.candidate.query,
          records.candidate.reply,
          JSON.stringify(records.candidate.proposals),
          JSON.stringify(records.candidate.reviewNotes),
          records.candidate.receiptId,
          records.candidate.createdAt,
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return parseAssistantExternalSettingReviewResult({
      schemaVersion: 1,
      status: "candidate",
      receipt: records.receipt,
      candidate: records.candidate,
    });
  }

  #prepareCharacterExtractionSerially(
    command: RunCharacterExtractionCommand,
  ): PreparedCharacterExtraction {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const connector = this.#options.characterExtraction;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseCharacterExtractionResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    if (command.sourceRange.from === command.sourceRange.to) {
      return Object.freeze({
        result: parseCharacterExtractionResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "invalid-range",
          documentId: command.sourceRange.documentId,
        }),
      });
    }
    const access = this.authorizeAssistantContextAccessSerially(
      parseAssistantContextRequest({
        schemaVersion: 1,
        requestId: entityId<"AssistantContextRequest">(command.requestId),
        workId: command.workId,
        conversationId: command.conversationId,
        capability: "character.extract",
        destinationId: connector.destinationId,
        requiredLocalScope: "selection",
        requiredExternalScope: "selection",
        readRanges: [command.sourceRange],
        transmittedRanges: [command.sourceRange],
      }),
    );
    if (!access.allowed) {
      return Object.freeze({
        result: access.reason === "permission-required"
          ? parseCharacterExtractionResult({
              schemaVersion: 1,
              status: "permission-required",
              missing: access.missing,
              destinationId: connector.destinationId,
            })
          : parseCharacterExtractionResult({
              schemaVersion: 1,
              status: "context-rejected",
              reason: access.reason,
              documentId: access.documentId,
            }),
      });
    }
    const target = this.#state.documentTargets.get(command.sourceRange.documentId);
    if (target === undefined) {
      throw new Error(
        `Authorized character extraction source disappeared: ${command.sourceRange.documentId}`,
      );
    }
    const manuscript = target.text.slice(
      command.sourceRange.from,
      command.sourceRange.to,
    );
    const paragraphs = createCharacterExtractionParagraphs({
      sourceRange: command.sourceRange,
      manuscript,
    });
    return Object.freeze({
      command,
      contextReceiptId: access.receipt.receiptId,
      paragraphs,
      execute: () => connector.execute({
        requestId: command.requestId,
        paragraphs,
      }),
    });
  }

  #recordCharacterExtractionSerially(
    prepared: Exclude<PreparedCharacterExtraction, { result: CharacterExtractionResult }>,
    executed: CharacterExtractionExecution,
  ): CharacterExtractionResult {
    if (executed.promptVersion !== CHARACTER_EXTRACTION_PROMPT_VERSION) {
      throw new Error("Character extraction prompt version does not match");
    }
    const target = this.#state.documentTargets.get(
      prepared.command.sourceRange.documentId,
    );
    const stale =
      target === undefined ||
      target.workId !== prepared.command.workId ||
      target.currentRevisionId !==
        prepared.command.sourceRange.documentRevisionId;
    const characters = readStoredCharacterRows(
      this.#database,
      prepared.command.workId,
    );
    const items = Object.freeze(executed.payload.characters.map((proposal) => {
      const names = new Set([proposal.name, ...proposal.aliases]);
      const matchingCharacterIds = Object.freeze(
        characters
          .filter((character) =>
            [character.name, ...character.aliases].some((name) => names.has(name))
          )
          .map((character) => character.characterId),
      );
      return Object.freeze({
        itemId: entityId<"CharacterExtractionItem">(randomUUID()),
        name: proposal.name,
        aliases: proposal.aliases,
        role: proposal.role,
        summary: proposal.summary,
        appearance: proposal.appearance,
        personality: proposal.personality,
        speech: proposal.speech,
        goal: proposal.goal,
        conflict: proposal.conflict,
        note: proposal.note,
        evidences: resolveCharacterExtractionEvidences({
          sourceRange: prepared.command.sourceRange,
          paragraphs: prepared.paragraphs,
          proposal,
        }),
        matchingCharacterIds,
        status: "pending" as const,
        approvedCharacterId: null,
      });
    }));
    const createdAt = new Date().toISOString();
    const candidate = parseCharacterExtractionCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      revision: 1,
      workId: prepared.command.workId,
      sourceRange: prepared.command.sourceRange,
      providerId: executed.providerId,
      modelId: executed.modelId,
      promptVersion: executed.promptVersion,
      status: stale ? "stale" : items.length === 0 ? "completed" : "ready",
      items,
      contextReceiptId: prepared.contextReceiptId,
      createdAt,
      updatedAt: createdAt,
    });
    this.#database.prepare(`
      INSERT INTO assistant_character_extraction_candidates (
        id,
        schema_version,
        request_id,
        revision,
        work_id,
        source_document_id,
        source_document_revision_id,
        source_from,
        source_to,
        provider_id,
        model_id,
        prompt_version,
        status,
        items_json,
        context_receipt_id,
        created_at,
        updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      candidate.sourceRange.documentId,
      candidate.sourceRange.documentRevisionId,
      candidate.sourceRange.from,
      candidate.sourceRange.to,
      candidate.providerId,
      candidate.modelId,
      candidate.promptVersion,
      candidate.status,
      JSON.stringify(candidate.items),
      candidate.contextReceiptId,
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseCharacterExtractionResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  #listCharacterExtractionCandidatesSerially(
    command: ListCharacterExtractionCandidatesCommand,
  ): CharacterExtractionCandidateList {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    return parseCharacterExtractionCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates: readStoredCharacterExtractionCandidateRows(
        this.#database,
        command.workId,
      ).map((row) => row.candidate),
    });
  }

  #markCharacterExtractionCandidateStale(
    candidate: CharacterExtractionCandidate,
  ): CharacterExtractionCandidate {
    if (candidate.status === "stale") return candidate;
    const updatedAt = new Date().toISOString();
    const updated = this.#database.prepare(`
      UPDATE assistant_character_extraction_candidates
      SET revision = revision + 1, status = 'stale', updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ?
    `).run(
      updatedAt,
      candidate.workId,
      candidate.candidateId,
      candidate.revision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(
        `Character extraction Candidate revision conflict: ${candidate.candidateId}`,
      );
    }
    const stored = readStoredCharacterExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (stored === null) {
      throw new Error(
        `Character extraction Candidate disappeared: ${candidate.candidateId}`,
      );
    }
    return stored.candidate;
  }

  async #createCharacterExtractionEvidenceAnchors(input: {
    readonly candidate: CharacterExtractionCandidate;
    readonly item: CharacterExtractionCandidate["items"][number];
    readonly characterId: EntityId<"Character">;
    readonly createdAt: string;
  }) {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(input.candidate.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${input.candidate.workId}`);
    }
    return Promise.all(input.item.evidences.map(async (evidence) => {
      const target = this.#state.documentTargets.get(evidence.documentId);
      if (
        target === undefined ||
        target.workId !== input.candidate.workId ||
        target.currentRevisionId !== evidence.documentRevisionId ||
        target.text.slice(evidence.from, evidence.to) !== evidence.exactText
      ) {
        throw new Error("Character extraction evidence is stale");
      }
      const anchorId = entityId<"Anchor">(randomUUID());
      const anchor = await new CreateAnchor({
        catalog,
        revisionStore: this.#revisionStore,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      }).execute({
        meta: {
          id: anchorId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        },
        workId: input.candidate.workId,
        documentId: evidence.documentId,
        documentRevisionId: evidence.documentRevisionId,
        startOffset: evidence.from,
        endOffset: evidence.to,
        policy: this.#options.defaults.anchorPolicy,
        commandRef: input.item.itemId,
        actorRef: work.studioId,
      });
      return Object.freeze({
        anchorId,
        anchor,
        evidenceId: entityId<"CharacterEvidence">(randomUUID()),
        sourceDocumentId: evidence.documentId,
        characterId: input.characterId,
      });
    }));
  }

  async #decideCharacterExtractionItemSerially(
    command: DecideCharacterExtractionItemCommand,
  ): Promise<CharacterExtractionDecisionResult> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const storedCandidate = readStoredCharacterExtractionCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (storedCandidate === null) {
      throw new Error(
        `Unknown character extraction Candidate: ${command.candidateId}`,
      );
    }
    const candidate = storedCandidate.candidate;
    if (candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Character extraction Candidate revision conflict: ${command.candidateId}`,
      );
    }
    const sourceTarget = this.#state.documentTargets.get(
      candidate.sourceRange.documentId,
    );
    if (
      sourceTarget === undefined ||
      sourceTarget.workId !== command.workId ||
      sourceTarget.currentRevisionId !== candidate.sourceRange.documentRevisionId
    ) {
      return parseCharacterExtractionDecisionResult({
        schemaVersion: 1,
        status: "stale",
        candidate: this.#markCharacterExtractionCandidateStale(candidate),
      }, parseCharacterProjection);
    }
    if (candidate.status !== "ready") {
      throw new Error(
        `Character extraction Candidate is not actionable: ${candidate.status}`,
      );
    }
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.status !== "pending") {
      throw new Error(
        `Character extraction item is not pending: ${command.itemId}`,
      );
    }
    const changedAt = new Date().toISOString();
    let characterId: EntityId<"Character"> | null = null;
    let currentCharacter: StoredCharacterRow | null = null;
    if (command.decision.kind === "create") {
      characterId = entityId<"Character">(randomUUID());
    } else if (command.decision.kind === "merge") {
      characterId = command.decision.targetCharacterId;
      currentCharacter = readStoredCharacterRowById(
        this.#database,
        command.workId,
        characterId,
      );
      if (
        currentCharacter === null ||
        currentCharacter.retiredAt !== null ||
        currentCharacter.revision !== command.decision.expectedCharacterRevision
      ) {
        throw new Error(`Character revision conflict: ${characterId}`);
      }
    }
    const evidenceAnchors = characterId === null
      ? Object.freeze([])
      : await this.#createCharacterExtractionEvidenceAnchors({
          candidate,
          item,
          characterId,
          createdAt: changedAt,
        });
    const itemStatus = command.decision.kind === "create"
      ? "created" as const
      : command.decision.kind === "merge"
        ? "merged" as const
        : "excluded" as const;
    const nextItems = Object.freeze(candidate.items.map((entry) =>
      entry.itemId === item.itemId
        ? Object.freeze({
            ...entry,
            status: itemStatus,
            approvedCharacterId: characterId,
          })
        : entry
    ));
    const nextCandidateStatus = nextItems.some((entry) => entry.status === "pending")
      ? "ready" as const
      : "completed" as const;
    const mergeFields = command.decision.kind === "merge"
      ? new Set(command.decision.fields)
      : new Set<never>();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (characterId !== null && command.decision.kind === "create") {
        transaction.write({
          kind: "character",
          ...createRecordMeta(changedAt),
          id: characterId,
          workId: command.workId,
          name: item.name,
          aliases: item.aliases,
          role: item.role,
          summary: item.summary,
          appearance: item.appearance,
          personality: item.personality,
          speech: item.speech,
          goal: item.goal,
          conflict: item.conflict,
          note: item.note,
        });
      }
      if (
        characterId !== null &&
        command.decision.kind === "merge" &&
        currentCharacter !== null
      ) {
        transaction.write({
          kind: "characterUpdate",
          id: characterId,
          workId: command.workId,
          expectedRevision: currentCharacter.revision,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          updatedAt: changedAt,
          name: mergeFields.has("name") ? item.name : currentCharacter.name,
          aliases: mergeFields.has("aliases")
            ? item.aliases
            : currentCharacter.aliases,
          role: mergeFields.has("role") ? item.role : currentCharacter.role,
          summary: mergeFields.has("summary")
            ? item.summary
            : currentCharacter.summary,
          appearance: mergeFields.has("appearance")
            ? item.appearance
            : currentCharacter.appearance,
          personality: mergeFields.has("personality")
            ? item.personality
            : currentCharacter.personality,
          speech: mergeFields.has("speech")
            ? item.speech
            : currentCharacter.speech,
          goal: mergeFields.has("goal") ? item.goal : currentCharacter.goal,
          conflict: mergeFields.has("conflict")
            ? item.conflict
            : currentCharacter.conflict,
          note: mergeFields.has("note") ? item.note : currentCharacter.note,
        });
      }
      for (const evidence of evidenceAnchors) {
        transaction.write(
          createAnchorLedgerRecord(command.workId, evidence.anchor),
        );
        transaction.write({
          kind: "characterEvidence",
          id: evidence.evidenceId,
          workId: command.workId,
          characterId: evidence.characterId,
          sourceDocumentId: evidence.sourceDocumentId,
          sourceAnchorId: evidence.anchorId,
          createdAt: changedAt,
        });
      }
      transaction.write({
        kind: "characterExtractionCandidateDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: nextCandidateStatus,
        items: nextItems,
        updatedAt: changedAt,
      });
    });
    const nextStoredCandidate = readStoredCharacterExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (nextStoredCandidate === null) {
      throw new Error(
        `Character extraction Candidate disappeared: ${candidate.candidateId}`,
      );
    }
    const characters = await Promise.all(
      readStoredCharacterRows(this.#database, candidate.workId)
        .map((row) => this.#character_lore.projectCharacterRow(row)),
    );
    return parseCharacterExtractionDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: nextStoredCandidate.candidate,
      characters,
    }, parseCharacterProjection);
  }

  #prepareCharacterGenerationSerially(
    command: RunCharacterGenerationCommand,
  ): PreparedCharacterGeneration {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const connector = this.#options.characterGeneration;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseCharacterGenerationResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    return Object.freeze({
      command,
      execute: () => connector.execute({
        requestId: command.requestId,
        brief: command.brief,
      }),
    });
  }

  #recordCharacterGenerationSerially(
    prepared: Exclude<PreparedCharacterGeneration, { result: CharacterGenerationResult }>,
    executed: CharacterGenerationExecution,
  ): CharacterGenerationResult {
    if (executed.promptVersion !== CHARACTER_GENERATION_PROMPT_VERSION) {
      throw new Error("Character generation prompt version does not match");
    }
    this.#infrastructure.assertAssistantWorkExists(prepared.command.workId);
    const characters = readStoredCharacterRows(
      this.#database,
      prepared.command.workId,
    );
    const items = Object.freeze(executed.payload.characters.map((proposal) => {
      const names = new Set([proposal.name, ...proposal.aliases]);
      const matchingCharacterIds = Object.freeze(
        characters
          .filter((character) =>
            [character.name, ...character.aliases].some((name) => names.has(name))
          )
          .map((character) => character.characterId),
      );
      return Object.freeze({
        itemId: entityId<"CharacterGenerationItem">(randomUUID()),
        name: proposal.name,
        aliases: proposal.aliases,
        role: proposal.role,
        summary: proposal.summary,
        appearance: proposal.appearance,
        personality: proposal.personality,
        speech: proposal.speech,
        goal: proposal.goal,
        conflict: proposal.conflict,
        note: proposal.note,
        matchingCharacterIds,
        status: "pending" as const,
        approvedCharacterId: null,
      });
    }));
    const createdAt = new Date().toISOString();
    const candidate = parseCharacterGenerationCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      revision: 1,
      workId: prepared.command.workId,
      brief: prepared.command.brief,
      providerId: executed.providerId,
      modelId: executed.modelId,
      promptVersion: executed.promptVersion,
      status: items.length === 0 ? "completed" : "ready",
      items,
      createdAt,
      updatedAt: createdAt,
    });
    this.#database.prepare(`
      INSERT INTO assistant_character_generation_candidates (
        id,
        schema_version,
        request_id,
        revision,
        work_id,
        brief_json,
        provider_id,
        model_id,
        prompt_version,
        status,
        items_json,
        created_at,
        updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      JSON.stringify(candidate.brief),
      candidate.providerId,
      candidate.modelId,
      candidate.promptVersion,
      candidate.status,
      JSON.stringify(candidate.items),
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseCharacterGenerationResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  #listCharacterGenerationCandidatesSerially(
    command: ListCharacterGenerationCandidatesCommand,
  ): CharacterGenerationCandidateList {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    return parseCharacterGenerationCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates: readStoredCharacterGenerationCandidateRows(
        this.#database,
        command.workId,
      ).map((row) => row.candidate),
    });
  }

  async #decideCharacterGenerationItemSerially(
    command: DecideCharacterGenerationItemCommand,
  ): Promise<CharacterGenerationDecisionResult> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const storedCandidate = readStoredCharacterGenerationCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (storedCandidate === null) {
      throw new Error(
        `Unknown character generation Candidate: ${command.candidateId}`,
      );
    }
    const candidate = storedCandidate.candidate;
    if (candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Character generation Candidate revision conflict: ${command.candidateId}`,
      );
    }
    if (candidate.status !== "ready") {
      throw new Error(
        `Character generation Candidate is not actionable: ${candidate.status}`,
      );
    }
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.status !== "pending") {
      throw new Error(
        `Character generation item is not pending: ${command.itemId}`,
      );
    }
    const changedAt = new Date().toISOString();
    let characterId: EntityId<"Character"> | null = null;
    let currentCharacter: StoredCharacterRow | null = null;
    if (command.decision.kind === "create") {
      characterId = entityId<"Character">(randomUUID());
    } else if (command.decision.kind === "merge") {
      characterId = command.decision.targetCharacterId;
      currentCharacter = readStoredCharacterRowById(
        this.#database,
        command.workId,
        characterId,
      );
      if (
        currentCharacter === null ||
        currentCharacter.retiredAt !== null ||
        currentCharacter.revision !== command.decision.expectedCharacterRevision
      ) {
        throw new Error(`Character revision conflict: ${characterId}`);
      }
    }
    const itemStatus = command.decision.kind === "create"
      ? "created" as const
      : command.decision.kind === "merge"
        ? "merged" as const
        : "excluded" as const;
    const nextItems = Object.freeze(candidate.items.map((entry) =>
      entry.itemId === item.itemId
        ? Object.freeze({
            ...entry,
            status: itemStatus,
            approvedCharacterId: characterId,
          })
        : entry
    ));
    const nextCandidateStatus = nextItems.some((entry) => entry.status === "pending")
      ? "ready" as const
      : "completed" as const;
    const mergeFields = command.decision.kind === "merge"
      ? new Set(command.decision.fields)
      : new Set<never>();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (characterId !== null && command.decision.kind === "create") {
        transaction.write({
          kind: "character",
          ...createRecordMeta(changedAt),
          id: characterId,
          workId: command.workId,
          name: item.name,
          aliases: item.aliases,
          role: item.role,
          summary: item.summary,
          appearance: item.appearance,
          personality: item.personality,
          speech: item.speech,
          goal: item.goal,
          conflict: item.conflict,
          note: item.note,
        });
      }
      if (
        characterId !== null &&
        command.decision.kind === "merge" &&
        currentCharacter !== null
      ) {
        transaction.write({
          kind: "characterUpdate",
          id: characterId,
          workId: command.workId,
          expectedRevision: currentCharacter.revision,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          updatedAt: changedAt,
          name: mergeFields.has("name") ? item.name : currentCharacter.name,
          aliases: mergeFields.has("aliases")
            ? item.aliases
            : currentCharacter.aliases,
          role: mergeFields.has("role") ? item.role : currentCharacter.role,
          summary: mergeFields.has("summary")
            ? item.summary
            : currentCharacter.summary,
          appearance: mergeFields.has("appearance")
            ? item.appearance
            : currentCharacter.appearance,
          personality: mergeFields.has("personality")
            ? item.personality
            : currentCharacter.personality,
          speech: mergeFields.has("speech") ? item.speech : currentCharacter.speech,
          goal: mergeFields.has("goal") ? item.goal : currentCharacter.goal,
          conflict: mergeFields.has("conflict")
            ? item.conflict
            : currentCharacter.conflict,
          note: mergeFields.has("note") ? item.note : currentCharacter.note,
        });
      }
      transaction.write({
        kind: "characterGenerationCandidateDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: nextCandidateStatus,
        items: nextItems,
        updatedAt: changedAt,
      });
    });
    const nextStoredCandidate = readStoredCharacterGenerationCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (nextStoredCandidate === null) {
      throw new Error(
        `Character generation Candidate disappeared: ${candidate.candidateId}`,
      );
    }
    const characters = await Promise.all(
      readStoredCharacterRows(this.#database, candidate.workId)
        .map((row) => this.#character_lore.projectCharacterRow(row)),
    );
    return parseCharacterGenerationDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: nextStoredCandidate.candidate,
      characters,
    }, parseCharacterProjection);
  }

  #prepareSceneExtractionSerially(
    command: RunSceneExtractionCommand,
  ): PreparedSceneExtraction {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const connector = this.#options.sceneExtraction;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseSceneExtractionResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    if (command.sourceRange.from === command.sourceRange.to) {
      return Object.freeze({
        result: parseSceneExtractionResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "invalid-range",
          documentId: command.sourceRange.documentId,
        }),
      });
    }
    const access = this.authorizeAssistantContextAccessSerially(
      parseAssistantContextRequest({
        schemaVersion: 1,
        requestId: entityId<"AssistantContextRequest">(command.requestId),
        workId: command.workId,
        conversationId: command.conversationId,
        capability: "scene.extract",
        destinationId: connector.destinationId,
        requiredLocalScope: "selection",
        requiredExternalScope: "selection",
        readRanges: [command.sourceRange],
        transmittedRanges: [command.sourceRange],
      }),
    );
    if (!access.allowed) {
      return Object.freeze({
        result: access.reason === "permission-required"
          ? parseSceneExtractionResult({
              schemaVersion: 1,
              status: "permission-required",
              missing: access.missing,
              destinationId: connector.destinationId,
            })
          : parseSceneExtractionResult({
              schemaVersion: 1,
              status: "context-rejected",
              reason: access.reason,
              documentId: access.documentId,
            }),
      });
    }
    const target = this.#state.documentTargets.get(command.sourceRange.documentId);
    if (target === undefined) {
      throw new Error(
        `Authorized scene extraction source disappeared: ${command.sourceRange.documentId}`,
      );
    }
    const manuscript = target.text.slice(
      command.sourceRange.from,
      command.sourceRange.to,
    );
    const paragraphs = createSceneExtractionParagraphs({
      sourceRange: command.sourceRange,
      manuscript,
    });
    return Object.freeze({
      command,
      contextReceiptId: access.receipt.receiptId,
      paragraphs,
      execute: () => connector.execute({
        requestId: command.requestId,
        paragraphs,
      }),
    });
  }

  #recordSceneExtractionSerially(
    prepared: Exclude<PreparedSceneExtraction, { result: SceneExtractionResult }>,
    executed: SceneExtractionExecution,
  ): SceneExtractionResult {
    if (executed.promptVersion !== SCENE_EXTRACTION_PROMPT_VERSION) {
      throw new Error("Scene extraction prompt version does not match");
    }
    const target = this.#state.documentTargets.get(
      prepared.command.sourceRange.documentId,
    );
    const stale =
      target === undefined ||
      target.workId !== prepared.command.workId ||
      target.currentRevisionId !== prepared.command.sourceRange.documentRevisionId;
    const characters = readStoredCharacterRows(
      this.#database,
      prepared.command.workId,
    );
    const resolveCharacterId = (name: string): EntityId<"Character"> | null => {
      if (!name) return null;
      const matches = characters.filter((character) =>
        character.name === name || character.aliases.includes(name)
      );
      return matches.length === 1 ? matches[0]!.characterId : null;
    };
    const resolved = resolveSceneExtractionModelScenes({
      sourceRange: prepared.command.sourceRange,
      paragraphs: prepared.paragraphs,
      payload: executed.payload,
    });
    const scenes = Object.freeze(resolved.map(({ proposal, range }) => {
      const sceneItemId = entityId<"SceneExtractionItem">(randomUUID());
      const characterIds = Object.freeze([
        ...new Set(proposal.characters
          .map(resolveCharacterId)
          .filter((value): value is EntityId<"Character"> => value !== null)),
      ]);
      return Object.freeze({
        sceneItemId,
        title: proposal.title,
        fromParagraphId: proposal.fromParagraphId,
        toParagraphId: proposal.toParagraphId,
        range,
        summary: proposal.summary,
        povCharacterId: resolveCharacterId(proposal.povCharacter),
        location: proposal.location,
        time: proposal.time,
        characterIds,
        goal: proposal.goal,
        conflict: proposal.conflict,
        outcome: proposal.outcome,
        annotationStatus: "pending" as const,
        sceneAnnotationId: null,
      });
    }));
    const boundaries = Object.freeze(scenes.slice(1).map((scene, index) =>
      Object.freeze({
        boundaryId: entityId<"SceneExtractionBoundary">(randomUUID()),
        fromSceneItemId: scenes[index]!.sceneItemId,
        toSceneItemId: scene.sceneItemId,
        offset: scene.range.from,
        status: "pending" as const,
        sceneOverrideId: null,
      })
    ));
    const createdAt = new Date().toISOString();
    const candidate = parseSceneExtractionCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      revision: 1,
      workId: prepared.command.workId,
      sourceRange: prepared.command.sourceRange,
      providerId: executed.providerId,
      modelId: executed.modelId,
      promptVersion: executed.promptVersion,
      status: stale ? "stale" : scenes.length === 0 ? "completed" : "ready",
      scenes,
      boundaries,
      contextReceiptId: prepared.contextReceiptId,
      createdAt,
      updatedAt: createdAt,
    });
    this.#database.prepare(`
      INSERT INTO assistant_scene_extraction_candidates (
        id, schema_version, request_id, revision, work_id,
        source_document_id, source_document_revision_id, source_from, source_to,
        provider_id, model_id, prompt_version, status, scenes_json,
        boundaries_json, context_receipt_id, created_at, updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      candidate.sourceRange.documentId,
      candidate.sourceRange.documentRevisionId,
      candidate.sourceRange.from,
      candidate.sourceRange.to,
      candidate.providerId,
      candidate.modelId,
      candidate.promptVersion,
      candidate.status,
      JSON.stringify(candidate.scenes),
      JSON.stringify(candidate.boundaries),
      candidate.contextReceiptId,
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseSceneExtractionResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  #listSceneExtractionCandidatesSerially(
    command: ListSceneExtractionCandidatesCommand,
  ): SceneExtractionCandidateList {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    return parseSceneExtractionCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates: readStoredSceneExtractionCandidateRows(
        this.#database,
        command.workId,
      ).map((row) => row.candidate),
    });
  }

  #markSceneExtractionCandidateStale(
    candidate: SceneExtractionCandidate,
  ): SceneExtractionCandidate {
    if (candidate.status === "stale") return candidate;
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE assistant_scene_extraction_candidates
      SET revision = revision + 1, status = 'stale', updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ?
    `).run(
      updatedAt,
      candidate.workId,
      candidate.candidateId,
      candidate.revision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(
        `Scene extraction Candidate revision conflict: ${candidate.candidateId}`,
      );
    }
    const stored = readStoredSceneExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (stored === null) {
      throw new Error(
        `Scene extraction Candidate disappeared: ${candidate.candidateId}`,
      );
    }
    return stored.candidate;
  }

  async #decideSceneExtractionBoundarySerially(
    command: DecideSceneExtractionBoundaryCommand,
  ): Promise<SceneExtractionDecisionResult> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const storedCandidate = readStoredSceneExtractionCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (storedCandidate === null) {
      throw new Error(`Unknown scene extraction Candidate: ${command.candidateId}`);
    }
    const candidate = storedCandidate.candidate;
    if (candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Scene extraction Candidate revision conflict: ${command.candidateId}`,
      );
    }
    const target = this.#state.documentTargets.get(candidate.sourceRange.documentId);
    if (
      target === undefined ||
      target.workId !== command.workId ||
      target.currentRevisionId !== candidate.sourceRange.documentRevisionId
    ) {
      return parseSceneExtractionDecisionResult({
        schemaVersion: 1,
        status: "stale",
        candidate: this.#markSceneExtractionCandidateStale(candidate),
      });
    }
    if (candidate.status !== "ready") {
      throw new Error(`Scene extraction Candidate is not actionable: ${candidate.status}`);
    }
    const boundary = candidate.boundaries.find(
      (entry) => entry.boundaryId === command.boundaryId,
    );
    if (boundary === undefined || boundary.status !== "pending") {
      throw new Error(`Scene extraction boundary is not pending: ${command.boundaryId}`);
    }
    if (
      boundary.offset < candidate.sourceRange.from ||
      boundary.offset > candidate.sourceRange.to ||
      boundary.offset > target.text.length
    ) {
      throw new Error("Scene extraction boundary is outside the current selection");
    }
    const changedAt = new Date().toISOString();
    let sceneOverrideId: EntityId<"SceneOverride"> | null = null;
    let anchorId: EntityId<"Anchor"> | null = null;
    let anchor: Anchor | null = null;
    let baseRuleSetRevision = 0;
    if (command.decision === "accept") {
      const catalog = createCatalogFromStoredRows(
        readStoredDocumentRows(this.#database),
      );
      const work = catalog.getWork(command.workId);
      if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
      const settingsRows = this.#database.prepare(WORK_SCENE_RULE_REVISION_SQL)
        .all(command.workId);
      const settingsRow = settingsRows[0];
      if (settingsRows.length !== 1 || settingsRow === undefined) {
        throw new Error(`Work scene settings are missing: ${command.workId}`);
      }
      baseRuleSetRevision = readRequiredInteger(
        settingsRow,
        "baseRuleSetRevision",
        "Work scene settings",
      );
      sceneOverrideId = entityId<"SceneOverride">(randomUUID());
      anchorId = entityId<"Anchor">(randomUUID());
      anchor = await new CreateAnchor({
        catalog,
        revisionStore: this.#revisionStore,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      }).execute({
        meta: {
          id: anchorId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt: changedAt,
          updatedAt: changedAt,
        },
        workId: command.workId,
        documentId: candidate.sourceRange.documentId,
        documentRevisionId: candidate.sourceRange.documentRevisionId,
        startOffset: boundary.offset,
        endOffset: boundary.offset,
        policy: this.#options.defaults.anchorPolicy,
        commandRef: boundary.boundaryId,
        actorRef: work.studioId,
      });
    }
    const nextBoundaries = Object.freeze(candidate.boundaries.map((entry) =>
      entry.boundaryId === boundary.boundaryId
        ? Object.freeze({
            ...entry,
            status: command.decision === "accept"
              ? "accepted" as const
              : "excluded" as const,
            sceneOverrideId,
          })
        : entry
    ));
    const nextStatus =
      nextBoundaries.some((entry) => entry.status === "pending") ||
        candidate.scenes.some((entry) => entry.annotationStatus === "pending")
      ? "ready" as const
      : "completed" as const;
    const fromScene = candidate.scenes.find(
      (scene) => scene.sceneItemId === boundary.fromSceneItemId,
    );
    const toScene = candidate.scenes.find(
      (scene) => scene.sceneItemId === boundary.toSceneItemId,
    );
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (anchor !== null && anchorId !== null && sceneOverrideId !== null) {
        transaction.write(createAnchorLedgerRecord(command.workId, anchor));
        transaction.write({
          kind: "sceneOverride",
          ...createRecordMeta(changedAt),
          id: sceneOverrideId,
          workId: command.workId,
          documentId: candidate.sourceRange.documentId,
          operation: "split",
          anchorIds: [anchorId],
          baseRuleSetRevision,
          note: `AI 장면 경계: ${fromScene?.title ?? "이전 장면"} → ${toScene?.title ?? "다음 장면"}`,
        });
      }
      transaction.write({
        kind: "sceneExtractionCandidateDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: nextStatus,
        boundaries: nextBoundaries,
        updatedAt: changedAt,
      });
    });
    const nextStored = readStoredSceneExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (nextStored === null) {
      throw new Error(`Scene extraction Candidate disappeared: ${candidate.candidateId}`);
    }
    return parseSceneExtractionDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: nextStored.candidate,
      sceneProjection: await this.#scene_geometry.listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
    });
  }

  async #decideSceneExtractionAnnotationSerially(
    command: DecideSceneExtractionAnnotationCommand,
  ): Promise<SceneExtractionAnnotationDecisionResult> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const storedCandidate = readStoredSceneExtractionCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (storedCandidate === null) {
      throw new Error(`Unknown scene extraction Candidate: ${command.candidateId}`);
    }
    const candidate = storedCandidate.candidate;
    if (candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Scene extraction Candidate revision conflict: ${command.candidateId}`,
      );
    }
    const target = this.#state.documentTargets.get(candidate.sourceRange.documentId);
    if (
      target === undefined ||
      target.workId !== command.workId ||
      target.currentRevisionId !== candidate.sourceRange.documentRevisionId
    ) {
      return parseSceneExtractionAnnotationDecisionResult({
        schemaVersion: 1,
        status: "stale",
        candidate: this.#markSceneExtractionCandidateStale(candidate),
      });
    }
    if (candidate.status !== "ready") {
      throw new Error(
        `Scene extraction Candidate is not actionable: ${candidate.status}`,
      );
    }
    if (candidate.boundaries.some((boundary) => boundary.status === "pending")) {
      throw new Error("Scene extraction boundaries must be decided first");
    }
    const sceneItem = candidate.scenes.find(
      (scene) => scene.sceneItemId === command.sceneItemId,
    );
    if (sceneItem === undefined || sceneItem.annotationStatus !== "pending") {
      throw new Error(
        `Scene extraction annotation is not pending: ${command.sceneItemId}`,
      );
    }
    const changedAt = new Date().toISOString();
    const annotationDecision = command.decision;
    let sceneAnnotationId: EntityId<"SceneAnnotation"> | null = null;
    let existingAnnotation: StoredSceneAnnotationRow | null = null;
    let boundSceneId: EntityId<"Scene"> | null = null;
    let identityRecords: readonly Poc3LedgerRecord[] = Object.freeze([]);
    let existingBinding: StoredSceneMetadataBindingRow | null = null;
    if (annotationDecision.kind === "accept") {
      const sceneProjection = await this.#scene_geometry.listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      const matchingScene = sceneProjection.scenes.find((scene) =>
        scene.sceneKey === annotationDecision.sceneKey &&
        scene.documentId === sceneItem.range.documentId &&
        scene.documentRevisionId === sceneItem.range.documentRevisionId &&
        scene.integrity === "resolved" &&
        scene.range !== null &&
        scene.range.start === sceneItem.range.from &&
        scene.range.end >= sceneItem.range.to &&
        /^\n*$/u.test(target.text.slice(sceneItem.range.to, scene.range.end))
      );
      if (matchingScene === undefined) {
        throw new Error(
          "Scene extraction annotation does not match the current SceneProjection",
        );
      }
      existingAnnotation = readStoredSceneAnnotationRowByKey(
        this.#database,
        command.workId,
        annotationDecision.sceneKey,
      );
      if (
        (existingAnnotation === null &&
          annotationDecision.expectedAnnotationRevision !== null) ||
        (existingAnnotation !== null &&
          existingAnnotation.revision !==
            annotationDecision.expectedAnnotationRevision)
      ) {
        throw new Error(
          `Scene annotation revision conflict: ${annotationDecision.sceneKey}`,
        );
      }
      const referencedCharacterIds = new Set([
        ...sceneItem.characterIds,
        ...(sceneItem.povCharacterId === null
          ? []
          : [sceneItem.povCharacterId]),
      ]);
      for (const characterId of referencedCharacterIds) {
        if (
          readStoredCharacterRowById(
            this.#database,
            command.workId,
            characterId,
          ) === null
        ) {
          throw new Error(
            `Scene annotation Character is outside its Work: ${characterId}`,
          );
        }
      }
      sceneAnnotationId = existingAnnotation?.sceneAnnotationId ??
        entityId<"SceneAnnotation">(randomUUID());
      const preparedIdentity = this.#scene_geometry.prepareSceneIdentityRecords(
        matchingScene,
        sceneAnnotationId,
        changedAt,
      );
      boundSceneId = preparedIdentity.sceneId;
      identityRecords = preparedIdentity.records;
      existingBinding = this.#scene_geometry.readActiveSceneMetadataBinding(
        command.workId,
        "annotation",
        sceneAnnotationId,
      );
    }
    const nextScenes = Object.freeze(candidate.scenes.map((scene) =>
      scene.sceneItemId === sceneItem.sceneItemId
        ? Object.freeze({
            ...scene,
            annotationStatus: annotationDecision.kind === "accept"
              ? "approved" as const
              : "excluded" as const,
            sceneAnnotationId,
          })
        : scene
    ));
    const nextStatus =
      candidate.boundaries.some((entry) => entry.status === "pending") ||
        nextScenes.some((entry) => entry.annotationStatus === "pending")
        ? "ready" as const
        : "completed" as const;
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of identityRecords) transaction.write(record);
      if (
        annotationDecision.kind === "accept" &&
        sceneAnnotationId !== null &&
        boundSceneId !== null
      ) {
        const annotationFields = {
          documentId: sceneItem.range.documentId,
          documentRevisionId: sceneItem.range.documentRevisionId,
          sourceCandidateId: candidate.candidateId,
          sourceSceneItemId: sceneItem.sceneItemId,
          title: sceneItem.title,
          summary: sceneItem.summary,
          ...(sceneItem.povCharacterId === null
            ? {}
            : { povCharacterId: sceneItem.povCharacterId }),
          location: sceneItem.location,
          time: sceneItem.time,
          characterIds: sceneItem.characterIds,
          goal: sceneItem.goal,
          conflict: sceneItem.conflict,
          outcome: sceneItem.outcome,
        } as const;
        if (existingAnnotation === null) {
          transaction.write({
            kind: "sceneAnnotation",
            ...createRecordMeta(changedAt),
            schemaVersion: 1,
            id: sceneAnnotationId,
            workId: command.workId,
            sceneKey: annotationDecision.sceneKey,
            ...annotationFields,
          });
        } else {
          transaction.write({
            kind: "sceneAnnotationUpdate",
            id: sceneAnnotationId,
            workId: command.workId,
            expectedRevision: existingAnnotation.revision,
            updatedAt: changedAt,
            ...annotationFields,
          });
        }
        if (existingBinding === null) {
          transaction.write({
            kind: "sceneMetadataBinding",
            id: `scene-binding:annotation:${command.workId}:${sceneAnnotationId}`,
            schemaVersion: 1,
            revision: 1,
            createdAt: changedAt,
            updatedAt: changedAt,
            workId: command.workId,
            metadataKind: "annotation",
            metadataId: sceneAnnotationId,
            sourceSceneKey: annotationDecision.sceneKey,
            sceneId: boundSceneId,
            status: "current",
          });
        } else {
          transaction.write({
            kind: "sceneMetadataBindingUpdate",
            id: existingBinding.bindingId,
            workId: command.workId,
            expectedRevision: existingBinding.revision,
            updatedAt: changedAt,
            sceneId: boundSceneId,
            status: "current",
            proposedSceneId: null,
            lineageOperationId: null,
          });
        }
      }
      transaction.write({
        kind: "sceneExtractionAnnotationCandidateDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: nextStatus,
        scenes: nextScenes,
        updatedAt: changedAt,
      });
    });
    const nextStored = readStoredSceneExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (nextStored === null) {
      throw new Error(`Scene extraction Candidate disappeared: ${candidate.candidateId}`);
    }
    return parseSceneExtractionAnnotationDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: nextStored.candidate,
      annotations: this.#scene_annotations.listSceneAnnotationsSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
      sceneProjection: await this.#scene_geometry.listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
    });
  }

  #createSceneDraftContextSerially(input: {
    readonly workId: EntityId<"Work">;
    readonly plotThreadId: EntityId<"PlotThread">;
    readonly expectedPlotRevision: number;
    readonly characterIds: readonly EntityId<"Character">[];
    readonly settingIds: readonly EntityId<"LoreEntry">[];
  }): SceneDraftContext {
    const plot = readStoredPlotThreadRowById(
      this.#database,
      input.workId,
      input.plotThreadId,
    );
    if (
      plot === null ||
      plot.retiredAt !== null ||
      plot.revision !== input.expectedPlotRevision
    ) {
      throw new Error(`Plot revision conflict: ${input.plotThreadId}`);
    }
    const events = readStoredPlotEventLinkRows(this.#database, input.workId)
      .filter((link) => link.plotBeatId === input.plotThreadId)
      .map((link) => {
        const event = readStoredEventBlockRowById(
          this.#database,
          input.workId,
          link.eventBlockId,
        );
        if (event === null || event.retiredAt !== null) {
          throw new Error(`Linked event is unavailable: ${link.eventBlockId}`);
        }
        return Object.freeze({
          plotEventLinkId: link.plotEventLinkId,
          linkRevision: link.revision,
          role: link.role,
          eventBlockId: event.eventBlockId,
          eventRevision: event.revision,
          title: event.title,
          note: event.note,
        });
      });
    const characters = input.characterIds.map((characterId) => {
      const character = readStoredCharacterRowById(
        this.#database,
        input.workId,
        characterId,
      );
      if (character === null || character.retiredAt !== null) {
        throw new Error(`Scene draft Character is unavailable: ${characterId}`);
      }
      return Object.freeze({
        characterId: character.characterId,
        revision: character.revision,
        name: character.name,
        aliases: character.aliases,
        role: character.role,
        summary: character.summary,
        appearance: character.appearance,
        personality: character.personality,
        speech: character.speech,
        goal: character.goal,
        conflict: character.conflict,
        note: character.note,
      });
    });
    const settings = input.settingIds.map((loreEntryId) => {
      const setting = readStoredLoreEntryRowById(
        this.#database,
        input.workId,
        loreEntryId,
      );
      if (
        setting === null ||
        setting.retiredAt !== null ||
        !setting.enabled
      ) {
        throw new Error(`Scene draft setting is unavailable: ${loreEntryId}`);
      }
      return Object.freeze({
        loreEntryId: setting.loreEntryId,
        revision: setting.revision,
        title: setting.title,
        content: setting.content,
        category: setting.category,
        aliases: setting.aliases,
      });
    });
    return parseSceneDraftContext({
      plot: {
        plotThreadId: plot.plotThreadId,
        revision: plot.revision,
        title: plot.title,
        stage: plot.stage,
        summary: plot.summary,
        note: plot.note,
      },
      events,
      characters,
      settings,
    });
  }

  #sceneDraftContextIsCurrent(
    candidate: Omit<SceneDraftCandidate, "integrity">,
  ): boolean {
    try {
      const current = this.#createSceneDraftContextSerially({
        workId: candidate.workId,
        plotThreadId: candidate.context.plot.plotThreadId,
        expectedPlotRevision: candidate.context.plot.revision,
        characterIds: candidate.context.characters.map(
          (character) => character.characterId,
        ),
        settingIds: candidate.context.settings.map(
          (setting) => setting.loreEntryId,
        ),
      });
      return JSON.stringify(current) === JSON.stringify(candidate.context);
    } catch {
      return false;
    }
  }

  async #findExactSceneDraftInsertionRevision(
    candidate: Omit<SceneDraftCandidate, "integrity">,
  ): Promise<EntityId<"DocumentRevision"> | null> {
    const target = this.#state.documentTargets.get(candidate.target.documentId);
    if (
      target === undefined ||
      target.workId !== candidate.workId ||
      target.currentRevisionId === candidate.target.documentRevisionId
    ) {
      return null;
    }
    const revision = await this.#revisionStore.getRevision(
      target.currentRevisionId,
    );
    if (
      revision === null ||
      revision.documentId !== candidate.target.documentId ||
      revision.parentRevisionId !== candidate.target.documentRevisionId
    ) {
      return null;
    }
    const baseText = await this.#revisionStore.materialize(
      candidate.target.documentRevisionId,
    );
    if (candidate.target.insertionOffset > baseText.length) return null;
    const expected =
      baseText.slice(0, candidate.target.insertionOffset) +
      candidate.draftText +
      baseText.slice(candidate.target.insertionOffset);
    const result = await this.#revisionStore.materialize(revision.id);
    return result === expected ? revision.id : null;
  }

  async #projectStoredSceneDraftCandidate(
    stored: StoredSceneDraftCandidateRow,
  ): Promise<SceneDraftCandidate> {
    if (stored.candidate.status === "applied") {
      return parseSceneDraftCandidate({
        ...stored.candidate,
        integrity: "current",
      });
    }
    const insertedRevision = await this.#findExactSceneDraftInsertionRevision(
      stored.candidate,
    );
    if (insertedRevision !== null) {
      return parseSceneDraftCandidate({
        ...stored.candidate,
        integrity: "inserted",
      });
    }
    const target = this.#state.documentTargets.get(stored.candidate.target.documentId);
    const current =
      target !== undefined &&
      target.workId === stored.candidate.workId &&
      target.currentRevisionId ===
        stored.candidate.target.documentRevisionId &&
      stored.candidate.target.insertionOffset <= target.text.length &&
      this.#sceneDraftContextIsCurrent(stored.candidate);
    return parseSceneDraftCandidate({
      ...stored.candidate,
      integrity: current ? "current" : "stale",
    });
  }

  #prepareSceneDraftSerially(command: RunSceneDraftCommand): PreparedSceneDraft {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const target = this.#state.documentTargets.get(command.target.documentId);
    if (
      target === undefined ||
      target.workId !== command.workId ||
      target.currentRevisionId !== command.target.documentRevisionId ||
      command.target.insertionOffset > target.text.length
    ) {
      throw new Error("Scene draft target is not the current Document revision");
    }
    const context = this.#createSceneDraftContextSerially({
      workId: command.workId,
      plotThreadId: command.plotThreadId,
      expectedPlotRevision: command.expectedPlotRevision,
      characterIds: command.characterIds,
      settingIds: command.settingIds,
    });
    const connector = this.#options.sceneDraft;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseRunSceneDraftResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    return Object.freeze({
      command,
      context,
      execute: () => connector.execute({
        requestId: command.requestId,
        context,
      }),
    });
  }

  async #recordSceneDraftSerially(
    prepared: Exclude<PreparedSceneDraft, { result: RunSceneDraftResult }>,
    executed: SceneDraftExecution,
  ): Promise<RunSceneDraftResult> {
    if (executed.promptVersion !== SCENE_DRAFT_PROMPT_VERSION) {
      throw new Error("Scene draft prompt version does not match");
    }
    const createdAt = new Date().toISOString();
    const storedCandidate = Object.freeze({
      schemaVersion: 1 as const,
      candidateId: entityId<"SceneDraftCandidate">(randomUUID()),
      revision: 1,
      workId: prepared.command.workId,
      context: prepared.context,
      target: prepared.command.target,
      providerId: executed.providerId,
      modelId: executed.modelId,
      promptVersion: executed.promptVersion,
      generatedText: executed.payload.draftText,
      draftText: executed.payload.draftText,
      status: "ready" as const,
      appliedDocumentRevisionId: null,
      createdAt,
      updatedAt: createdAt,
    });
    const candidate = await this.#projectStoredSceneDraftCandidate({
      requestId: prepared.command.requestId,
      candidate: storedCandidate,
    });
    this.#database.prepare(`
      INSERT INTO assistant_scene_draft_candidates (
        id, schema_version, request_id, revision, work_id, plot_thread_id,
        plot_thread_revision, target_document_id, target_document_revision_id,
        insertion_offset, provider_id, model_id, prompt_version, context_json,
        generated_text, draft_text, status, applied_document_revision_id,
        created_at, updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', NULL, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      candidate.context.plot.plotThreadId,
      candidate.context.plot.revision,
      candidate.target.documentId,
      candidate.target.documentRevisionId,
      candidate.target.insertionOffset,
      candidate.providerId,
      candidate.modelId,
      candidate.promptVersion,
      JSON.stringify(candidate.context),
      candidate.generatedText,
      candidate.draftText,
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseRunSceneDraftResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  async #listSceneDraftCandidatesSerially(
    command: ListSceneDraftCandidatesCommand,
  ): Promise<SceneDraftCandidateList> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const candidates = await Promise.all(
      readStoredSceneDraftCandidateRows(this.#database, command.workId).map(
        (stored) => this.#projectStoredSceneDraftCandidate(stored),
      ),
    );
    return parseSceneDraftCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates,
    });
  }

  async #updateSceneDraftCandidateSerially(
    command: UpdateSceneDraftCandidateCommand,
  ): Promise<SceneDraftCandidate> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const stored = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Unknown scene draft Candidate: ${command.candidateId}`);
    }
    const candidate = await this.#projectStoredSceneDraftCandidate(stored);
    if (
      candidate.revision !== command.expectedCandidateRevision ||
      candidate.status !== "ready" ||
      candidate.integrity !== "current"
    ) {
      throw new Error(`Scene draft Candidate is not editable: ${command.candidateId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE assistant_scene_draft_candidates
      SET revision = revision + 1, draft_text = ?, updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ? AND status = 'ready'
    `).run(
      command.draftText,
      updatedAt,
      command.workId,
      command.candidateId,
      command.expectedCandidateRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Scene draft Candidate revision conflict: ${command.candidateId}`);
    }
    const next = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (next === null) throw new Error("Scene draft Candidate disappeared");
    return this.#projectStoredSceneDraftCandidate(next);
  }

  async #prepareSceneDraftInsertionSerially(
    command: PrepareSceneDraftInsertionCommand,
  ): Promise<PrepareSceneDraftInsertionResult> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const stored = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Unknown scene draft Candidate: ${command.candidateId}`);
    }
    if (stored.candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(`Scene draft Candidate revision conflict: ${command.candidateId}`);
    }
    const candidate = await this.#projectStoredSceneDraftCandidate(stored);
    if (candidate.status !== "ready") {
      throw new Error(`Scene draft Candidate is already applied: ${command.candidateId}`);
    }
    if (candidate.integrity === "inserted") {
      const resultDocumentRevisionId =
        await this.#findExactSceneDraftInsertionRevision(stored.candidate);
      if (resultDocumentRevisionId === null) {
        throw new Error("Inserted scene draft revision disappeared");
      }
      return parsePrepareSceneDraftInsertionResult({
        schemaVersion: 1,
        status: "already-inserted",
        candidate,
        resultDocumentRevisionId,
      });
    }
    if (candidate.integrity === "stale") {
      return parsePrepareSceneDraftInsertionResult({
        schemaVersion: 1,
        status: "stale",
        candidate,
      });
    }
    const target = this.#state.documentTargets.get(candidate.target.documentId);
    if (target === undefined) throw new Error("Scene draft target disappeared");
    return parsePrepareSceneDraftInsertionResult({
      schemaVersion: 1,
      status: "authorized",
      candidate,
      baseDocumentLength: target.text.length,
    });
  }

  async #completeSceneDraftInsertionSerially(
    command: CompleteSceneDraftInsertionCommand,
  ): Promise<SceneDraftCandidate> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const stored = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Unknown scene draft Candidate: ${command.candidateId}`);
    }
    if (
      stored.candidate.revision !== command.expectedCandidateRevision ||
      stored.candidate.status !== "ready"
    ) {
      throw new Error(`Scene draft Candidate revision conflict: ${command.candidateId}`);
    }
    const exactRevision = await this.#findExactSceneDraftInsertionRevision(
      stored.candidate,
    );
    if (exactRevision !== command.resultDocumentRevisionId) {
      throw new Error("Scene draft insertion revision does not match exact text");
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE assistant_scene_draft_candidates
      SET
        revision = revision + 1,
        status = 'applied',
        applied_document_revision_id = ?,
        updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ? AND status = 'ready'
    `).run(
      command.resultDocumentRevisionId,
      updatedAt,
      command.workId,
      command.candidateId,
      command.expectedCandidateRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Scene draft Candidate revision conflict: ${command.candidateId}`);
    }
    const next = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (next === null) throw new Error("Scene draft Candidate disappeared");
    return this.#projectStoredSceneDraftCandidate(next);
  }

  #runAssistantNotationReviewSerially(
    command: RunAssistantNotationReviewCommand,
  ): AssistantNotationReviewResult {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const destination = this.#getAssistantDestinationProfile().destinations.find(
      (entry) => entry.destinationId === command.destinationId,
    );
    if (
      destination === undefined ||
      destination.kind !== "local-selected-notation-review" ||
      !destination.capabilities.includes("vocabulary-lookup")
    ) {
      throw new Error(`Unknown notation review destination: ${command.destinationId}`);
    }
    const sourceTarget = this.#state.documentTargets.get(command.sourceRange.documentId);
    if (sourceTarget === undefined) {
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "source-unavailable",
        documentId: command.sourceRange.documentId,
      });
    }
    if (sourceTarget.workId !== command.workId) {
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "outside-work",
        documentId: command.sourceRange.documentId,
      });
    }
    if (sourceTarget.currentRevisionId !== command.sourceRange.documentRevisionId) {
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "stale-context",
        documentId: command.sourceRange.documentId,
      });
    }
    if (command.sourceRange.to > sourceTarget.text.length) {
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "invalid-range",
        documentId: command.sourceRange.documentId,
      });
    }
    const authorization = this.authorizeAssistantContextAccessSerially(
      parseAssistantContextRequest({
        schemaVersion: 1,
        requestId: command.requestId,
        workId: command.workId,
        conversationId: command.conversationId,
        capability: "vocabulary-lookup",
        destinationId: command.destinationId,
        requiredLocalScope: destination.requiredLocalScope,
        requiredExternalScope: destination.requiredExternalScope,
        readRanges: [command.sourceRange],
        transmittedRanges: [],
      }),
    );
    if (!authorization.allowed) {
      if (authorization.reason === "permission-required") {
        return parseAssistantNotationReviewResult({
          schemaVersion: 1,
          status: "permission-required",
          missing: authorization.missing,
        });
      }
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: authorization.reason,
        documentId: authorization.documentId,
      });
    }
    const selectedText = sourceTarget.text.slice(
      command.sourceRange.from,
      command.sourceRange.to,
    );
    const report = diagnoseManuscriptPreflight(
      selectedText,
      this.#settings.getManuscriptPreflightSettingsSerially(command.workId).settings,
      createManuscriptPreflightBoundaryContext(
        sourceTarget.text,
        command.sourceRange,
      ),
    );
    const candidate = parseAssistantNotationCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      workId: command.workId,
      conversationId: command.conversationId,
      destinationId: command.destinationId,
      sourceRange: command.sourceRange,
      findings: createAssistantNotationFindings({
        sourceRange: command.sourceRange,
        report,
      }),
      regexError: report.regexError,
      receiptId: authorization.receipt.receiptId,
      createdAt: new Date().toISOString(),
    });
    this.#database
      .prepare(`
        INSERT INTO assistant_notation_candidates (
          id,
          schema_version,
          work_id,
          conversation_id,
          destination_id,
          source_range_json,
          findings_json,
          regex_error,
          receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        candidate.candidateId,
        candidate.workId,
        candidate.conversationId,
        candidate.destinationId,
        JSON.stringify(candidate.sourceRange),
        JSON.stringify(candidate.findings),
        candidate.regexError,
        candidate.receiptId,
        candidate.createdAt,
      );
    return parseAssistantNotationReviewResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  #runAssistantSettingReviewSerially(
    command: RunAssistantSettingReviewCommand,
  ): AssistantSettingReviewResult {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const destination = this.#getAssistantDestinationProfile().destinations.find(
      (entry) => entry.destinationId === command.destinationId,
    );
    if (
      destination === undefined ||
      destination.kind !== "local-exact-setting-review" ||
      !destination.capabilities.includes("lore-review")
    ) {
      throw new Error(`Unknown setting review destination: ${command.destinationId}`);
    }
    const grants = this.#readAssistantPermissionGrants(
      command.workId,
      command.conversationId,
    );
    const permission = authorizeAssistantSettingReview({
      command,
      grants,
      settings: [],
    });
    if (!permission.allowed) {
      return parseAssistantSettingReviewResult({
        schemaVersion: 1,
        status: "permission-required",
        missing: permission.missing,
      });
    }
    const authorization = authorizeAssistantSettingReview({
      command,
      grants,
      settings: this.#readAssistantSettingReviewSources(command.workId),
    });
    if (!authorization.allowed) {
      throw new Error("Assistant setting review permission changed during execution");
    }
    const createdAt = new Date().toISOString();
    const receipt = createAssistantSettingReviewReceipt({
      authorization,
      receiptId: randomUUID(),
      createdAt,
    });
    const findings = Object.freeze(
      findExactDuplicateSettingGroups(authorization.settings).map((group) =>
        parseAssistantSettingReviewFinding({
          schemaVersion: 1,
          findingId: randomUUID(),
          workId: command.workId,
          conversationId: command.conversationId,
          destinationId: command.destinationId,
          kind: "duplicate",
          settingKind: group.settingKind,
          label: group.label,
          references: group.references,
          receiptId: receipt.receiptId,
          createdAt,
        })
      ),
    );
    const conflicts = Object.freeze(
      findExactSettingConflictGroups(authorization.settings).map((group) =>
        parseAssistantSettingConflictFinding({
          schemaVersion: 1,
          findingId: randomUUID(),
          workId: command.workId,
          conversationId: command.conversationId,
          destinationId: command.destinationId,
          kind: "conflict",
          settingKind: group.settingKind,
          label: group.label,
          field: group.field,
          references: group.references,
          receiptId: receipt.receiptId,
          createdAt,
        })
      ),
    );
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const grantId of authorization.consumedGrantIds) {
        const current = grants.find((grant) => grant.grantId === grantId);
        if (current === undefined) {
          throw new Error(`Unknown consumed assistant grant: ${grantId}`);
        }
        const consumed = this.#database
          .prepare(`
            UPDATE assistant_context_permission_grants
            SET revision = revision + 1, consumed_at = ?
            WHERE
              work_id = ? AND
              id = ? AND
              revision = ? AND
              duration = 'once' AND
              revoked_at IS NULL AND
              consumed_at IS NULL
          `)
          .run(
            createdAt,
            command.workId,
            grantId,
            current.revision,
          );
        if (Number(consumed.changes) !== 1) {
          throw new Error(`Assistant context permission changed: ${grantId}`);
        }
      }
      this.#database
        .prepare(`
          INSERT INTO assistant_setting_review_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            destination_id,
            reviewed_settings_json,
            transmitted_setting_count,
            grant_ids_json,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, 0, ?, ?)
        `)
        .run(
          receipt.receiptId,
          receipt.requestId,
          receipt.workId,
          receipt.conversationId,
          receipt.destinationId,
          JSON.stringify(receipt.reviewedSettings),
          JSON.stringify(receipt.grantIds),
          receipt.createdAt,
        );
      const insertFinding = this.#database.prepare(`
        INSERT INTO assistant_setting_review_findings (
          id,
          schema_version,
          work_id,
          conversation_id,
          destination_id,
          finding_kind,
          setting_kind,
          duplicate_label,
          references_json,
          receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, 'duplicate', ?, ?, ?, ?, ?)
      `);
      for (const finding of findings) {
        insertFinding.run(
          finding.findingId,
          finding.workId,
          finding.conversationId,
          finding.destinationId,
          finding.settingKind,
          finding.label,
          JSON.stringify(finding.references),
          finding.receiptId,
          finding.createdAt,
        );
      }
      const insertConflict = this.#database.prepare(`
        INSERT INTO assistant_setting_conflict_findings (
          id,
          schema_version,
          work_id,
          conversation_id,
          destination_id,
          finding_kind,
          setting_kind,
          duplicate_label,
          field_name,
          references_json,
          receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, 'conflict', ?, ?, ?, ?, ?, ?)
      `);
      for (const finding of conflicts) {
        insertConflict.run(
          finding.findingId,
          finding.workId,
          finding.conversationId,
          finding.destinationId,
          finding.settingKind,
          finding.label,
          finding.field,
          JSON.stringify(finding.references),
          finding.receiptId,
          finding.createdAt,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return parseAssistantSettingReviewResult({
      schemaVersion: 1,
      status: "reviewed",
      receipt,
      findings,
      conflicts,
    });
  }
}
