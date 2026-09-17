import { createHash,randomUUID } from "node:crypto";
import type { CanonReviewCandidate,CanonReviewCandidateList,CanonReviewDecisionResult,CanonReviewResult } from "../../../application/canon/canon-review-contract";
import { CANON_REVIEW_PROMPT_VERSION,parseDecideCanonReviewItemCommand,parseListCanonReviewCandidatesCommand,parseResolveCanonReviewItemTargetCommand,parseRunCanonReviewCommand,parseUpdateCanonReviewItemCommand } from "../../../application/canon/canon-review-contract";
import type { AssistantContextActivityList,AssistantContextManifestList,AssistantContextPlanProjection } from "../../../application/continuity/assistant-context-manifest";
import { parseListAssistantContextActivitiesCommand,parseListAssistantContextManifestsCommand } from "../../../application/continuity/assistant-context-manifest";
import type { AssistantEntityContextPolicyList,AssistantEntityContextPolicyProjection } from "../../../application/continuity/assistant-context-policy";
import { parseListAssistantEntityContextPoliciesCommand,parseSaveAssistantEntityContextPolicyCommand } from "../../../application/continuity/assistant-context-policy";
import type { CharacterKnowledgeListProjection,CharacterKnowledgeProjection,PovKnowledgeContextProjection } from "../../../application/continuity/character-knowledge-contract";
import { parseCreateCharacterKnowledgeCommand,parseListCharacterKnowledgeCommand,parseProjectPovKnowledgeCommand,parseRetireCharacterKnowledgeCommand,parseSupersedeCharacterKnowledgeCommand,parseUpdateCharacterKnowledgeCommand } from "../../../application/continuity/character-knowledge-contract";
import { parsePlanAssistantContextInput } from "../../../application/continuity/context-planner";
import type { ContinuityReviewCandidate,ContinuityReviewCandidateList,ContinuityReviewDecisionResult,ContinuityReviewResult } from "../../../application/continuity/continuity-review-contract";
import { CONTINUITY_REVIEW_PROMPT_VERSION,parseDecideContinuityReviewItemCommand,parseListContinuityReviewCandidatesCommand,parseRunContinuityReviewCommand,parseUpdateContinuityReviewItemCommand } from "../../../application/continuity/continuity-review-contract";
import type { ContinuityOverviewProjection,ContinuityThreadProjection } from "../../../application/continuity/continuity-thread-contract";
import { parseCreateContinuityThreadCommand,parseDismissContinuityThreadCommand,parseListContinuityThreadsCommand,parseResolveContinuityThreadCommand,parseUpdateContinuityThreadCommand } from "../../../application/continuity/continuity-thread-contract";
import type { NarrativeDigestListProjection,NarrativeDigestProjection,NarrativeDigestResult } from "../../../application/continuity/narrative-digest-contract";
import { NARRATIVE_DIGEST_PROMPT_VERSION,parseGenerateNarrativeDigestCommand,parseGenerateSceneNarrativeDigestCommand,parseListNarrativeDigestsCommand,parseRegenerateNarrativeDigestCommand } from "../../../application/continuity/narrative-digest-contract";
import type { AutomaticSceneAnalysisResult,RunAutomaticSceneAnalysisCommand,SceneAnalysisLoreStatus,SceneAnalysisRunListProjection,SceneAnalysisRunProjection } from "../../../application/continuity/scene-analysis-run-contract";
import { parseAutomaticSceneAnalysisResult,parseListSceneAnalysisRunsCommand,parseRunAutomaticSceneAnalysisCommand,parseSceneAnalysisRunListProjection,parseSceneAnalysisRunProjection } from "../../../application/continuity/scene-analysis-run-contract";
import type { SceneInformationUpdateExecution } from "../../../application/continuity/scene-information-update-contract";
import { assertSceneInformationReviewedEntityScope,parseSceneInformationUpdateExecution } from "../../../application/continuity/scene-information-update-contract";
import type { SaveWorkSceneAnalysisSettingsCommand,WorkSceneAnalysisSettingsProjection } from "../../../application/settings/work-scene-analysis-settings";
import { createDefaultWorkSceneAnalysisSettingsProjection,parseGetWorkSceneAnalysisSettingsCommand,parseSaveWorkSceneAnalysisSettingsCommand,parseWorkSceneAnalysisSettingsProjection } from "../../../application/settings/work-scene-analysis-settings";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { LocalCanonService } from "../../canon/local-canon-runtime";
import type { LocalCharacterKnowledgeService } from "../../continuity/local-character-knowledge-runtime";
import type { LocalContextPlanner } from "../../continuity/local-context-planner";
import type { LocalContinuityService } from "../../continuity/local-continuity-runtime";
import type { LocalNarrativeDigestService } from "../../continuity/local-narrative-digest-runtime";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { readRequiredInteger,readRequiredString } from "../repositories/scalars";
import type { NodeSqliteDatabase } from "../storage-contracts";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns analysis commands and their existing transaction boundaries. */
export class AnalysisService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "canonReview" | "continuityReview" | "sceneInformationUpdate">;
  readonly #canonService: LocalCanonService;
  readonly #contextPlanner: LocalContextPlanner;
  readonly #continuityService: LocalContinuityService;
  readonly #characterKnowledgeService: LocalCharacterKnowledgeService;
  readonly #narrativeDigestService: LocalNarrativeDigestService;
  readonly #database: NodeSqliteDatabase;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "canonReview" | "continuityReview" | "sceneInformationUpdate">;
    readonly canonService: LocalCanonService;
    readonly contextPlanner: LocalContextPlanner;
    readonly continuityService: LocalContinuityService;
    readonly characterKnowledgeService: LocalCharacterKnowledgeService;
    readonly narrativeDigestService: LocalNarrativeDigestService;
    readonly database: NodeSqliteDatabase;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#options = input.options;
    this.#canonService = input.canonService;
    this.#contextPlanner = input.contextPlanner;
    this.#continuityService = input.continuityService;
    this.#characterKnowledgeService = input.characterKnowledgeService;
    this.#narrativeDigestService = input.narrativeDigestService;
    this.#database = input.database;
    this.#infrastructure = input.infrastructure;
  }

  getWorkSceneAnalysisSettings(
    value: unknown,
  ): Promise<WorkSceneAnalysisSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetWorkSceneAnalysisSettingsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getWorkSceneAnalysisSettingsSerially(command.workId),
    );
  }

  saveWorkSceneAnalysisSettings(
    value: unknown,
  ): Promise<WorkSceneAnalysisSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveWorkSceneAnalysisSettingsCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveWorkSceneAnalysisSettingsSerially(command);
    });

    return execution;
  }

  runCanonReview(value: unknown): Promise<CanonReviewResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunCanonReviewCommand(value);
    const preparation = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      const connector = this.#options.canonReview;
      if (connector === undefined || !connector.isConnected()) {
        return Object.freeze({
          prepared: this.#canonService.prepareReview(command),
          context: null,
        });
      }
      const startedAt = new Date().toISOString();
      const planStarted = Date.now();
      const plan = this.#contextPlanner.plan({
        schemaVersion: 1,
        workId: command.workId,
        capability: "canon.review",
        sourceRange: command.sourceRange,
        sceneId: null,
        povCharacterId: null,
        userQuery: "",
        tokenBudget: connector.contextTokenBudget,
      });
      const planDurationMs = Date.now() - planStarted;
      if (plan.status === "required-context-over-budget") {
        throw new Error(
          `required-context-over-budget: ${plan.requiredTokenCount}/${plan.tokenBudget}`,
        );
      }
      const authorizeStarted = Date.now();
      const prepared = this.#canonService.prepareReview(command);
      const authorizeDurationMs = Date.now() - authorizeStarted;
      if ("result" in prepared) return Object.freeze({ prepared, context: null });
      const manifestStarted = Date.now();
      const manifest = await this.#contextPlanner.recordManifest({
        workId: command.workId,
        receiptId: prepared.contextReceiptId,
        plan,
      });
      return Object.freeze({
        prepared,
        context: Object.freeze({
          manifest,
          startedAt,
          planDurationMs,
          authorizeDurationMs,
          manifestPersistDurationMs: Date.now() - manifestStarted,
        }),
      });
    });

    return preparation.then(async ({ prepared, context }) => {
      if ("result" in prepared) return prepared.result;
      const connectorStarted = Date.now();
      const executed = await prepared.execute();
      const connectorDurationMs = Date.now() - connectorStarted;
      const recording = this.#operations.enqueueMutation(async (priorSaves) => {
        await priorSaves;
        const persistStarted = Date.now();
        const result = await this.#canonService.recordReview(prepared, executed);
        const candidatePersistDurationMs = Date.now() - persistStarted;
        if (context !== null) {
          await this.#contextPlanner.recordActivity({
            workId: command.workId,
            receiptId: prepared.contextReceiptId,
            manifestId: context.manifest.manifestId,
            providerId: executed.providerId,
            modelId: executed.modelId,
            startedAt: context.startedAt,
            completedAt: new Date().toISOString(),
            stageDurationsMs: {
              plan: context.planDurationMs,
              authorize: context.authorizeDurationMs,
              connector: connectorDurationMs,
              persist: context.manifestPersistDurationMs + candidatePersistDurationMs,
            },
            candidateCount: result.status === "candidate"
              ? result.candidate.items.length
              : 0,
          });
        }
        return result;
      });

      return recording;
    });
  }

  listCanonReviewCandidates(
    value: unknown,
  ): Promise<CanonReviewCandidateList> {
    this.#infrastructure.assertOpen();
    const command = parseListCanonReviewCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#canonService.list(command)
    );
  }

  updateCanonReviewItem(value: unknown): Promise<CanonReviewCandidate> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateCanonReviewItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#canonService.updateItem(command);
    });

    return execution;
  }

  resolveCanonReviewItemTarget(value: unknown): Promise<CanonReviewCandidate> {
    this.#infrastructure.assertOpen();
    const command = parseResolveCanonReviewItemTargetCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#canonService.resolveTarget(command);
    });

    return execution;
  }

  decideCanonReviewItem(value: unknown): Promise<CanonReviewDecisionResult> {
    this.#infrastructure.assertOpen();
    const command = parseDecideCanonReviewItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#canonService.decide(command);
    });

    return execution;
  }

  createContinuityThread(value: unknown): Promise<ContinuityThreadProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateContinuityThreadCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#continuityService.create(command);
    });

    return execution;
  }

  updateContinuityThread(value: unknown): Promise<ContinuityThreadProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateContinuityThreadCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#continuityService.update(command);
    });

    return execution;
  }

  listContinuityThreads(value: unknown): Promise<ContinuityOverviewProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListContinuityThreadsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#continuityService.list(command)
    );
  }

  resolveContinuityThread(value: unknown): Promise<ContinuityThreadProjection> {
    this.#infrastructure.assertOpen();
    const command = parseResolveContinuityThreadCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#continuityService.resolve(command);
    });

    return execution;
  }

  dismissContinuityThread(value: unknown): Promise<ContinuityThreadProjection> {
    this.#infrastructure.assertOpen();
    const command = parseDismissContinuityThreadCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#continuityService.dismiss(command);
    });

    return execution;
  }

  runContinuityReview(value: unknown): Promise<ContinuityReviewResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunContinuityReviewCommand(value);
    const preparation = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      const connector = this.#options.continuityReview;
      if (connector === undefined || !connector.isConnected()) {
        return Object.freeze({
          prepared: this.#continuityService.prepareReview(command),
          context: null,
        });
      }
      const startedAt = new Date().toISOString();
      const planStarted = Date.now();
      const plan = this.#contextPlanner.plan({
        schemaVersion: 1,
        workId: command.workId,
        capability: "continuity.review",
        sourceRange: command.sourceRange,
        sceneId: null,
        povCharacterId: null,
        userQuery: "",
        tokenBudget: connector.contextTokenBudget,
      });
      const planDurationMs = Date.now() - planStarted;
      if (plan.status === "required-context-over-budget") {
        throw new Error(
          `required-context-over-budget: ${plan.requiredTokenCount}/${plan.tokenBudget}`,
        );
      }
      const authorizeStarted = Date.now();
      const prepared = this.#continuityService.prepareReview(command);
      const authorizeDurationMs = Date.now() - authorizeStarted;
      if ("result" in prepared) return Object.freeze({ prepared, context: null });
      const manifestStarted = Date.now();
      const manifest = await this.#contextPlanner.recordManifest({
        workId: command.workId,
        receiptId: prepared.contextReceiptId,
        plan,
      });
      return Object.freeze({
        prepared,
        context: Object.freeze({
          manifest,
          startedAt,
          planDurationMs,
          authorizeDurationMs,
          manifestPersistDurationMs: Date.now() - manifestStarted,
        }),
      });
    });

    return preparation.then(async ({ prepared, context }) => {
      if ("result" in prepared) return prepared.result;
      const connectorStarted = Date.now();
      const executed = await prepared.execute();
      const connectorDurationMs = Date.now() - connectorStarted;
      const recording = this.#operations.enqueueMutation(async (priorSaves) => {
        await priorSaves;
        const persistStarted = Date.now();
        const result = await this.#continuityService.recordReview(prepared, executed);
        const candidatePersistDurationMs = Date.now() - persistStarted;
        if (context !== null) {
          await this.#contextPlanner.recordActivity({
            workId: command.workId,
            receiptId: prepared.contextReceiptId,
            manifestId: context.manifest.manifestId,
            providerId: executed.providerId,
            modelId: executed.modelId,
            startedAt: context.startedAt,
            completedAt: new Date().toISOString(),
            stageDurationsMs: {
              plan: context.planDurationMs,
              authorize: context.authorizeDurationMs,
              connector: connectorDurationMs,
              persist: context.manifestPersistDurationMs + candidatePersistDurationMs,
            },
            candidateCount: result.status === "candidate"
              ? result.candidate.items.length
              : 0,
          });
        }
        return result;
      });

      return recording;
    });
  }

  listContinuityReviewCandidates(
    value: unknown,
  ): Promise<ContinuityReviewCandidateList> {
    this.#infrastructure.assertOpen();
    const command = parseListContinuityReviewCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#continuityService.listCandidates(command)
    );
  }

  updateContinuityReviewItem(value: unknown): Promise<ContinuityReviewCandidate> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateContinuityReviewItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#continuityService.updateItem(command);
    });

    return execution;
  }

  decideContinuityReviewItem(
    value: unknown,
  ): Promise<ContinuityReviewDecisionResult> {
    this.#infrastructure.assertOpen();
    const command = parseDecideContinuityReviewItemCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#continuityService.decide(command);
    });

    return execution;
  }

  createCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateCharacterKnowledgeCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#characterKnowledgeService.create(command);
    });

    return execution;
  }

  updateCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateCharacterKnowledgeCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#characterKnowledgeService.update(command);
    });

    return execution;
  }

  supersedeCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSupersedeCharacterKnowledgeCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#characterKnowledgeService.supersede(command);
    });

    return execution;
  }

  retireCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireCharacterKnowledgeCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#characterKnowledgeService.retire(command);
    });

    return execution;
  }

  listCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListCharacterKnowledgeCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#characterKnowledgeService.list(command)
    );
  }

  projectPovCharacterKnowledge(value: unknown): Promise<PovKnowledgeContextProjection> {
    this.#infrastructure.assertOpen();
    const command = parseProjectPovKnowledgeCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#characterKnowledgeService.projectPov(command)
    );
  }

  listAssistantEntityContextPolicies(
    value: unknown,
  ): Promise<AssistantEntityContextPolicyList> {
    this.#infrastructure.assertOpen();
    const command = parseListAssistantEntityContextPoliciesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#contextPlanner.listPolicies(command)
    );
  }

  saveAssistantEntityContextPolicy(
    value: unknown,
  ): Promise<AssistantEntityContextPolicyProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveAssistantEntityContextPolicyCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#contextPlanner.savePolicy(command);
    });

    return execution;
  }

  planAssistantContext(value: unknown): Promise<AssistantContextPlanProjection> {
    this.#infrastructure.assertOpen();
    const command = parsePlanAssistantContextInput(value);
    return this.#operations.readBarrier().then(() =>
      this.#contextPlanner.plan(command)
    );
  }

  listAssistantContextManifests(value: unknown): Promise<AssistantContextManifestList> {
    this.#infrastructure.assertOpen();
    const command = parseListAssistantContextManifestsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#contextPlanner.listManifests(command)
    );
  }

  listAssistantContextActivities(value: unknown): Promise<AssistantContextActivityList> {
    this.#infrastructure.assertOpen();
    const command = parseListAssistantContextActivitiesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#contextPlanner.listActivities(command)
    );
  }

  generateNarrativeDigest(value: unknown): Promise<NarrativeDigestResult> {
    this.#infrastructure.assertOpen();
    const command = parseGenerateNarrativeDigestCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#narrativeDigestService.generate(command);
    });

    return execution;
  }

  generateSceneNarrativeDigest(value: unknown): Promise<NarrativeDigestResult> {
    this.#infrastructure.assertOpen();
    const command = parseGenerateSceneNarrativeDigestCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#narrativeDigestService.generateScene(command);
    });

    return execution;
  }

  runAutomaticSceneAnalysis(
    value: unknown,
  ): Promise<AutomaticSceneAnalysisResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunAutomaticSceneAnalysisCommand(value);
    const execution = this.#operations.enqueueAnalysis(() =>
      this.#runAutomaticSceneAnalysisSerially(command));

    return execution;
  }

  async #runAutomaticSceneAnalysisSerially(
    command: RunAutomaticSceneAnalysisCommand,
  ): Promise<AutomaticSceneAnalysisResult> {
    await this.#operations.readBarrier();
    if (!this.#getWorkSceneAnalysisSettingsSerially(command.workId).settings.enabled) {
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "disabled",
      });
    }
    if (this.#options.sceneInformationUpdate !== undefined) {
      return this.#runIntegratedSceneInformationUpdateSerially(
        command,
        this.#options.sceneInformationUpdate,
      );
    }
    const digestResult = await this.generateSceneNarrativeDigest({
      schemaVersion: 1,
      requestId: command.digestRequestId,
      workId: command.workId,
      conversationId: command.conversationId,
      sceneId: command.sceneId,
      sourceRange: command.sourceRange,
      trigger: command.trigger,
    });
    if (digestResult.status === "login-required") {
      return parseAutomaticSceneAnalysisResult(digestResult);
    }
    if (digestResult.status === "permission-required") {
      return parseAutomaticSceneAnalysisResult(digestResult);
    }
    if (digestResult.status === "context-rejected") {
      return parseAutomaticSceneAnalysisResult(digestResult);
    }
    const digest = digestResult.digest;
    const ensureRun = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#ensureSceneAnalysisRunSerially(digest);
    });

    let run = await ensureRun;
    if (run.loreStatus === "candidate" || run.loreStatus === "no-change") {
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "unchanged",
        digest,
        run,
      });
    }
    const recordLoreStatus = (
      status: SceneAnalysisLoreStatus,
      candidateId: EntityId<"CanonReviewCandidate"> | null,
      lastError: string | null,
    ) => {
      const recording = this.#operations.enqueueMutation(async (priorSaves) => {
        await priorSaves;
        return this.#recordSceneAnalysisLoreStatusSerially(
          run,
          status,
          candidateId,
          lastError,
        );
      });

      return recording;
    };
    let canonResult: CanonReviewResult;
    try {
      canonResult = await this.runCanonReview({
        schemaVersion: 1,
        requestId: command.canonRequestId,
        workId: command.workId,
        conversationId: command.conversationId,
        sourceRange: command.sourceRange,
        requestedTargetKinds: ["lore-entry"],
      });
    } catch (reason) {
      const message = reason instanceof Error && reason.message.trim().length > 0
        ? reason.message
        : "별빛 검토 실행에 실패했습니다.";
      run = await recordLoreStatus("failed", null, message);
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "lore-failed",
        digest,
        run,
      });
    }
    if (canonResult.status === "candidate") {
      run = await recordLoreStatus(
        "candidate",
        canonResult.candidate.candidateId,
        null,
      );
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "completed",
        digest,
        run,
      });
    }
    if (canonResult.status === "no-change") {
      run = await recordLoreStatus("no-change", null, null);
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "completed",
        digest,
        run,
      });
    }
    if (canonResult.status === "login-required") {
      run = await recordLoreStatus("login-required", null, null);
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "lore-login-required",
        digest,
        run,
      });
    }
    if (canonResult.status === "permission-required") {
      run = await recordLoreStatus("permission-required", null, null);
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "lore-permission-required",
        missing: canonResult.missing,
        destinationId: canonResult.destinationId,
        digest,
        run,
      });
    }
    run = await recordLoreStatus("context-rejected", null, null);
    return parseAutomaticSceneAnalysisResult({
      schemaVersion: 1,
      status: "lore-context-rejected",
      reason: canonResult.reason,
      documentId: canonResult.documentId,
      digest,
      run,
    });
  }

  async #runIntegratedSceneInformationUpdateSerially(
    command: RunAutomaticSceneAnalysisCommand,
    connector: NonNullable<LocalWorkspaceRuntimeOptions["sceneInformationUpdate"]>,
  ): Promise<AutomaticSceneAnalysisResult> {
    if (!connector.isConnected()) {
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "login-required",
      });
    }
    const digestPrepared = await this.#narrativeDigestService.prepareScene({
      schemaVersion: 1,
      requestId: command.digestRequestId,
      workId: command.workId,
      conversationId: command.conversationId,
      sceneId: command.sceneId,
      sourceRange: command.sourceRange,
      trigger: command.trigger,
    }, { reuseExisting: true });
    if ("result" in digestPrepared) {
      const result = digestPrepared.result;
      if (result.status === "login-required") {
        return parseAutomaticSceneAnalysisResult(result);
      }
      if (result.status === "permission-required") {
        return parseAutomaticSceneAnalysisResult(result);
      }
      if (result.status === "context-rejected") {
        return parseAutomaticSceneAnalysisResult(result);
      }
      throw new Error("Scene information update digest preparation is unavailable");
    }
    if (digestPrepared.existingDigest !== null) {
      const existingRun = this.#ensureSceneAnalysisRunSerially(
        digestPrepared.existingDigest,
      );
      if (existingRun.informationUpdate?.status === "complete") {
        return parseAutomaticSceneAnalysisResult({
          schemaVersion: 1,
          status: "unchanged",
          digest: digestPrepared.existingDigest,
          run: existingRun,
        });
      }
    }

    const canonConnector = this.#options.canonReview;
    const continuityConnector = this.#options.continuityReview;
    if (
      canonConnector === undefined || continuityConnector === undefined ||
      !canonConnector.isConnected() || !continuityConnector.isConnected()
    ) {
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "login-required",
      });
    }
    if (
      connector.destinationId !== canonConnector.destinationId ||
      connector.destinationId !== continuityConnector.destinationId
    ) {
      throw new Error("Scene information update destinations do not match");
    }

    const canonCommand = parseRunCanonReviewCommand({
      schemaVersion: 1,
      requestId: command.canonRequestId,
      workId: command.workId,
      conversationId: command.conversationId,
      sourceRange: command.sourceRange,
      requestedTargetKinds: [
        "character",
        "character-relation",
        "lore-entry",
        "character-knowledge",
      ],
    });
    const canonPrepared = this.#canonService.prepareReview(canonCommand);
    if ("result" in canonPrepared) {
      const result = canonPrepared.result;
      if (result.status === "login-required") {
        return parseAutomaticSceneAnalysisResult({
          schemaVersion: 1,
          status: "login-required",
        });
      }
      if (result.status === "permission-required") {
        return parseAutomaticSceneAnalysisResult(result);
      }
      if (result.status === "context-rejected") {
        return parseAutomaticSceneAnalysisResult(result);
      }
      throw new Error("Scene information update Canon preparation is unavailable");
    }
    const continuityCommand = parseRunContinuityReviewCommand({
      schemaVersion: 1,
      requestId: command.continuityRequestId,
      workId: command.workId,
      conversationId: command.conversationId,
      sourceRange: command.sourceRange,
    });
    const continuityPrepared = this.#continuityService.prepareReview(
      continuityCommand,
    );
    if ("result" in continuityPrepared) {
      const result = continuityPrepared.result;
      if (result.status === "login-required") {
        return parseAutomaticSceneAnalysisResult({
          schemaVersion: 1,
          status: "login-required",
        });
      }
      if (result.status === "permission-required") {
        return parseAutomaticSceneAnalysisResult(result);
      }
      if (result.status === "context-rejected") {
        return parseAutomaticSceneAnalysisResult(result);
      }
      throw new Error("Scene information update Continuity preparation is unavailable");
    }

    const prepareActivity = async (
      capability: "canon.review" | "continuity.review",
      receiptId: EntityId<"AssistantContextReceipt">,
      tokenBudget: number,
    ) => {
      const startedAt = new Date().toISOString();
      const planStarted = Date.now();
      const plan = this.#contextPlanner.plan({
        schemaVersion: 1,
        workId: command.workId,
        capability,
        sourceRange: command.sourceRange,
        sceneId: command.sceneId,
        povCharacterId: null,
        userQuery: "",
        tokenBudget,
      });
      const planDurationMs = Date.now() - planStarted;
      if (plan.status === "required-context-over-budget") {
        throw new Error(
          `required-context-over-budget: ${plan.requiredTokenCount}/${plan.tokenBudget}`,
        );
      }
      const manifestStarted = Date.now();
      const manifest = await this.#contextPlanner.recordManifest({
        workId: command.workId,
        receiptId,
        plan,
      });
      return Object.freeze({
        startedAt,
        planDurationMs,
        manifestPersistDurationMs: Date.now() - manifestStarted,
        manifest,
      });
    };
    const canonActivity = await prepareActivity(
      "canon.review",
      canonPrepared.contextReceiptId,
      canonConnector.contextTokenBudget,
    );
    const continuityActivity = await prepareActivity(
      "continuity.review",
      continuityPrepared.contextReceiptId,
      continuityConnector.contextTokenBudget,
    );
    const canonParagraphs = canonPrepared.connectorInput.paragraphs;
    const continuityParagraphs = continuityPrepared.connectorInput.paragraphs;
    if (
      canonParagraphs.length !== continuityParagraphs.length ||
      canonParagraphs.some((paragraph, index) => {
        const continuityParagraph = continuityParagraphs[index];
        return continuityParagraph === undefined ||
          paragraph.paragraphId !== continuityParagraph.paragraphId ||
          paragraph.from !== continuityParagraph.from ||
          paragraph.to !== continuityParagraph.to ||
          paragraph.text !== continuityParagraph.text;
      })
    ) {
      throw new Error("Scene information update paragraph inputs disagree");
    }

    const connectorStarted = Date.now();
    const execution = parseSceneInformationUpdateExecution(
      await connector.execute(Object.freeze({
        digest: digestPrepared.connectorInput,
        canon: canonPrepared.connectorInput,
        continuity: continuityPrepared.connectorInput,
      })),
    );
    const suppliedEntityKeys = [
      ...digestPrepared.connectorInput.canonicalSources.map((source) =>
        `${source.kind}:${source.id}`
      ),
      ...canonPrepared.connectorInput.characterReferences.map((reference) =>
        `character:${reference.characterId}`
      ),
      ...continuityPrepared.connectorInput.subjectReferences.map((reference) =>
        `${reference.entity.kind}:${reference.entity.id}`
      ),
    ];
    assertSceneInformationReviewedEntityScope(
      execution.reviewedEntities,
      suppliedEntityKeys,
    );
    const connectorDurationMs = Date.now() - connectorStarted;
    const recording = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      const digestResult = await this.#narrativeDigestService.recordPrepared(
        digestPrepared,
        {
          providerId: execution.providerId,
          modelId: execution.modelId,
          promptVersion: NARRATIVE_DIGEST_PROMPT_VERSION,
          text: execution.digest.text,
        },
        connectorDurationMs,
      );
      if (
        digestResult.status !== "generated" &&
        digestResult.status !== "unchanged"
      ) {
        throw new Error("Integrated Scene information digest was not recorded");
      }
      const digest = digestResult.digest;
      let run = this.#ensureSceneAnalysisRunSerially(digest);

      const canonPersistStarted = Date.now();
      const canonResult = await this.#canonService.recordReview(canonPrepared, {
        providerId: execution.providerId,
        modelId: execution.modelId,
        promptVersion: CANON_REVIEW_PROMPT_VERSION,
        payload: execution.canon,
      });
      const canonPersistDurationMs = Date.now() - canonPersistStarted;
      if (canonResult.status === "candidate") {
        run = this.#recordSceneAnalysisLoreStatusSerially(
          run,
          "candidate",
          canonResult.candidate.candidateId,
          null,
        );
      } else if (canonResult.status === "no-change" && run.loreStatus !== "candidate") {
        run = this.#recordSceneAnalysisLoreStatusSerially(
          run,
          "no-change",
          null,
          null,
        );
      }

      const continuityPersistStarted = Date.now();
      const continuityResult = await this.#continuityService.recordReview(
        continuityPrepared,
        {
          providerId: execution.providerId,
          modelId: execution.modelId,
          promptVersion: CONTINUITY_REVIEW_PROMPT_VERSION,
          payload: execution.continuity,
        },
      );
      const continuityPersistDurationMs = Date.now() - continuityPersistStarted;
      await this.#contextPlanner.recordActivity({
        workId: command.workId,
        receiptId: canonPrepared.contextReceiptId,
        manifestId: canonActivity.manifest.manifestId,
        providerId: execution.providerId,
        modelId: execution.modelId,
        startedAt: canonActivity.startedAt,
        completedAt: new Date().toISOString(),
        stageDurationsMs: {
          plan: canonActivity.planDurationMs,
          authorize: 0,
          connector: 0,
          persist: canonActivity.manifestPersistDurationMs + canonPersistDurationMs,
        },
        candidateCount: canonResult.status === "candidate"
          ? canonResult.candidate.items.length
          : 0,
      });
      await this.#contextPlanner.recordActivity({
        workId: command.workId,
        receiptId: continuityPrepared.contextReceiptId,
        manifestId: continuityActivity.manifest.manifestId,
        providerId: execution.providerId,
        modelId: execution.modelId,
        startedAt: continuityActivity.startedAt,
        completedAt: new Date().toISOString(),
        stageDurationsMs: {
          plan: continuityActivity.planDurationMs,
          authorize: 0,
          connector: 0,
          persist: continuityActivity.manifestPersistDurationMs +
            continuityPersistDurationMs,
        },
        candidateCount: continuityResult.status === "candidate"
          ? continuityResult.candidate.items.length
          : 0,
      });
      run = this.#createSceneInformationUpdateBatchSerially({
        run,
        execution,
        canonResult,
        continuityResult,
      });
      return parseAutomaticSceneAnalysisResult({
        schemaVersion: 1,
        status: "completed",
        digest,
        run,
      });
    });

    return recording;
  }

  listSceneAnalysisRuns(value: unknown): Promise<SceneAnalysisRunListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListSceneAnalysisRunsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listSceneAnalysisRunsSerially(command.workId)
    );
  }

  listNarrativeDigests(value: unknown): Promise<NarrativeDigestListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListNarrativeDigestsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#narrativeDigestService.list(command)
    );
  }

  regenerateNarrativeDigest(value: unknown): Promise<NarrativeDigestResult> {
    this.#infrastructure.assertOpen();
    const command = parseRegenerateNarrativeDigestCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#narrativeDigestService.regenerate(command);
    });

    return execution;
  }

  #getWorkSceneAnalysisSettingsSerially(
    workId: EntityId<"Work">,
  ): WorkSceneAnalysisSettingsProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database.prepare(`
      SELECT revision,enabled,updated_at AS "updatedAt"
      FROM work_scene_analysis_settings
      WHERE work_id=?
    `).all(workId);
    if (rows.length === 0) {
      return createDefaultWorkSceneAnalysisSettingsProjection(workId);
    }
    if (rows.length !== 1) {
      throw new Error(`Work scene analysis settings identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const enabled = readRequiredInteger(
      row,
      "enabled",
      "Work scene analysis settings row",
    );
    if (enabled !== 0 && enabled !== 1) {
      throw new Error("Work scene analysis settings enabled flag is invalid");
    }
    return parseWorkSceneAnalysisSettingsProjection({
      schemaVersion: 1,
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work scene analysis settings row",
      ),
      settings: { enabled: enabled === 1 },
      updatedAt: readRequiredString(
        row,
        "updatedAt",
        "Work scene analysis settings row",
      ),
    });
  }

  #saveWorkSceneAnalysisSettingsSerially(
    command: SaveWorkSceneAnalysisSettingsCommand,
  ): WorkSceneAnalysisSettingsProjection {
    const current = this.#getWorkSceneAnalysisSettingsSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work scene analysis settings revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const nextRevision = current.revision + 1;
    const updatedAt = new Date().toISOString();
    const updated = this.#database.prepare(`
      INSERT INTO work_scene_analysis_settings (
        work_id,schema_version,revision,enabled,updated_at
      ) VALUES (?,1,?,?,?)
      ON CONFLICT(work_id) DO UPDATE SET
        revision=excluded.revision,
        enabled=excluded.enabled,
        updated_at=excluded.updated_at
      WHERE work_scene_analysis_settings.revision=?
    `).run(
      command.workId,
      nextRevision,
      command.settings.enabled ? 1 : 0,
      updatedAt,
      command.expectedRevision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(
        `Work scene analysis settings changed before save: ${command.workId}`,
      );
    }
    return this.#getWorkSceneAnalysisSettingsSerially(command.workId);
  }

  #projectSceneAnalysisRunRow(
    row: Readonly<Record<string, unknown>>,
  ): SceneAnalysisRunProjection {
    return parseSceneAnalysisRunProjection({
      schemaVersion: 1,
      runId: readRequiredString(row, "runId", "Scene analysis run row"),
      revision: readRequiredInteger(row, "revision", "Scene analysis run row"),
      workId: readRequiredString(row, "workId", "Scene analysis run row"),
      sceneId: readRequiredString(row, "sceneId", "Scene analysis run row"),
      digestId: readRequiredString(row, "digestId", "Scene analysis run row"),
      sourceFingerprint: readRequiredString(
        row,
        "sourceFingerprint",
        "Scene analysis run row",
      ),
      trigger: readRequiredString(row, "trigger", "Scene analysis run row"),
      loreStatus: readRequiredString(
        row,
        "loreStatus",
        "Scene analysis run row",
      ),
      canonCandidateId: row.canonCandidateId ?? null,
      attemptCount: readRequiredInteger(
        row,
        "attemptCount",
        "Scene analysis run row",
      ),
      lastError: row.lastError ?? null,
      informationUpdate: row.batchId === null || row.batchId === undefined
        ? null
        : {
            schemaVersion: 1,
            batchId: readRequiredString(
              row,
              "batchId",
              "Scene information update batch row",
            ),
            revision: readRequiredInteger(
              row,
              "batchRevision",
              "Scene information update batch row",
            ),
            packetHash: readRequiredString(
              row,
              "packetHash",
              "Scene information update batch row",
            ),
            previousPacketHash: row.previousPacketHash ?? null,
            providerId: readRequiredString(
              row,
              "batchProviderId",
              "Scene information update batch row",
            ),
            modelId: readRequiredString(
              row,
              "batchModelId",
              "Scene information update batch row",
            ),
            promptVersion: readRequiredString(
              row,
              "batchPromptVersion",
              "Scene information update batch row",
            ),
            canonCandidateId: row.batchCanonCandidateId ?? null,
            continuityCandidateId: row.batchContinuityCandidateId ?? null,
            status: readRequiredString(
              row,
              "batchStatus",
              "Scene information update batch row",
            ),
            lastError: row.batchLastError ?? null,
            reviewedEntities: JSON.parse(readRequiredString(
              row,
              "reviewedEntitiesJson",
              "Scene information update batch row",
            )),
            createdAt: readRequiredString(
              row,
              "batchCreatedAt",
              "Scene information update batch row",
            ),
            updatedAt: readRequiredString(
              row,
              "batchUpdatedAt",
              "Scene information update batch row",
            ),
          },
      createdAt: readRequiredString(row, "createdAt", "Scene analysis run row"),
      updatedAt: readRequiredString(row, "updatedAt", "Scene analysis run row"),
    });
  }

  #listSceneAnalysisRunsSerially(
    workId: EntityId<"Work">,
  ): SceneAnalysisRunListProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const runs = this.#database.prepare(`
      SELECT
        run.id AS "runId",
        run.revision,
        run.work_id AS "workId",
        run.scene_id AS "sceneId",
        run.digest_id AS "digestId",
        run.source_fingerprint AS "sourceFingerprint",
        run.trigger_kind AS "trigger",
        run.lore_status AS "loreStatus",
        run.canon_candidate_id AS "canonCandidateId",
        run.attempt_count AS "attemptCount",
        run.last_error AS "lastError",
        run.created_at AS "createdAt",
        run.updated_at AS "updatedAt",
        batch.id AS "batchId",
        batch.revision AS "batchRevision",
        batch.packet_hash AS "packetHash",
        batch.previous_packet_hash AS "previousPacketHash",
        batch.provider_id AS "batchProviderId",
        batch.model_id AS "batchModelId",
        batch.prompt_version AS "batchPromptVersion",
        batch.canon_candidate_id AS "batchCanonCandidateId",
        batch.continuity_candidate_id AS "batchContinuityCandidateId",
        batch.status AS "batchStatus",
        batch.last_error AS "batchLastError",
        batch.reviewed_entities_json AS "reviewedEntitiesJson",
        batch.created_at AS "batchCreatedAt",
        batch.updated_at AS "batchUpdatedAt"
      FROM scene_analysis_runs AS run
      LEFT JOIN scene_information_update_batches AS batch
        ON batch.work_id=run.work_id AND batch.scene_analysis_run_id=run.id
      WHERE run.work_id=?
      ORDER BY run.updated_at DESC,run.id DESC
    `).all(workId).map((row) => this.#projectSceneAnalysisRunRow(row));
    return parseSceneAnalysisRunListProjection({
      schemaVersion: 1,
      workId,
      runs,
    });
  }

  #ensureSceneAnalysisRunSerially(
    digest: NarrativeDigestProjection,
  ): SceneAnalysisRunProjection {
    const sceneSource = digest.sceneSource;
    if (digest.scope.kind !== "scene" || sceneSource === null) {
      throw new Error("Automatic Scene analysis requires a Scene NarrativeDigest");
    }
    const existing = this.#listSceneAnalysisRunsSerially(digest.workId).runs.find(
      (run) => run.sourceFingerprint === digest.sourceManifestHash,
    );
    if (existing !== undefined) {
      if (
        existing.sceneId !== sceneSource.sceneId ||
        existing.digestId !== digest.digestId
      ) {
        throw new Error("Scene analysis run source identity is inconsistent");
      }
      return existing;
    }
    const runId = entityId<"SceneAnalysisRun">(randomUUID());
    const createdAt = new Date().toISOString();
    this.#database.prepare(`
      INSERT INTO scene_analysis_runs (
        id,schema_version,revision,work_id,scene_id,digest_id,
        source_fingerprint,trigger_kind,lore_status,canon_candidate_id,
        attempt_count,last_error,created_at,updated_at
      ) VALUES (?,1,1,?,?,?,?,?,'pending',NULL,0,NULL,?,?)
    `).run(
      runId,
      digest.workId,
      sceneSource.sceneId,
      digest.digestId,
      digest.sourceManifestHash,
      sceneSource.trigger,
      createdAt,
      createdAt,
    );
    const created = this.#listSceneAnalysisRunsSerially(digest.workId).runs.find(
      (run) => run.runId === runId,
    );
    if (created === undefined) {
      throw new Error(`Created Scene analysis run disappeared: ${runId}`);
    }
    return created;
  }

  #recordSceneAnalysisLoreStatusSerially(
    current: SceneAnalysisRunProjection,
    status: SceneAnalysisLoreStatus,
    canonCandidateId: EntityId<"CanonReviewCandidate"> | null,
    lastError: string | null,
  ): SceneAnalysisRunProjection {
    const updatedAt = new Date().toISOString();
    const updated = this.#database.prepare(`
      UPDATE scene_analysis_runs
      SET revision=revision+1,
        lore_status=?,
        canon_candidate_id=?,
        attempt_count=attempt_count+1,
        last_error=?,
        updated_at=?
      WHERE work_id=? AND id=? AND revision=?
    `).run(
      status,
      canonCandidateId,
      lastError,
      updatedAt,
      current.workId,
      current.runId,
      current.revision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Scene analysis run changed before update: ${current.runId}`);
    }
    const projection = this.#listSceneAnalysisRunsSerially(current.workId).runs.find(
      (run) => run.runId === current.runId,
    );
    if (projection === undefined) {
      throw new Error(`Updated Scene analysis run disappeared: ${current.runId}`);
    }
    return projection;
  }

  #createSceneInformationUpdateBatchSerially(input: Readonly<{
    run: SceneAnalysisRunProjection;
    execution: SceneInformationUpdateExecution;
    canonResult: CanonReviewResult;
    continuityResult: ContinuityReviewResult;
  }>): SceneAnalysisRunProjection {
    if (input.run.informationUpdate !== null) return input.run;
    const execution = parseSceneInformationUpdateExecution(input.execution);
    const previous = this.#database.prepare(`
      SELECT packet_hash AS "packetHash"
      FROM scene_information_update_batches
      WHERE work_id=? AND scene_id=?
      ORDER BY created_at DESC,id DESC LIMIT 1
    `).all(input.run.workId, input.run.sceneId)[0];
    const previousPacketHash = previous === undefined
      ? null
      : readRequiredString(
          previous,
          "packetHash",
          "Previous Scene information update batch row",
        );
    const payloadJson = JSON.stringify({
      digest: execution.digest,
      canon: execution.canon,
      continuity: execution.continuity,
      reviewedEntities: execution.reviewedEntities,
    });
    const packetHash = createHash("sha256").update(JSON.stringify([
      input.run.sourceFingerprint,
      previousPacketHash,
      execution.promptVersion,
      payloadJson,
    ])).digest("hex");
    const canonCandidateId = input.canonResult.status === "candidate"
      ? input.canonResult.candidate.candidateId
      : null;
    const continuityCandidateId = input.continuityResult.status === "candidate"
      ? input.continuityResult.candidate.candidateId
      : null;
    const batchId = entityId<"SceneInformationUpdateBatch">(randomUUID());
    const createdAt = new Date().toISOString();
    this.#database.prepare(`
      INSERT INTO scene_information_update_batches (
        id,schema_version,revision,work_id,scene_analysis_run_id,scene_id,
        source_fingerprint,packet_hash,previous_packet_hash,provider_id,
        model_id,prompt_version,payload_json,reviewed_entities_json,digest_id,
        canon_candidate_id,continuity_candidate_id,status,last_error,
        created_at,updated_at
      ) VALUES (
        ?,1,1,?,?,?,
        ?,?,?,?,
        ?,?,?,?,?,
        ?,?,'complete',NULL,
        ?,?
      )
    `).run(
      batchId,
      input.run.workId,
      input.run.runId,
      input.run.sceneId,
      input.run.sourceFingerprint,
      packetHash,
      previousPacketHash,
      execution.providerId,
      execution.modelId,
      execution.promptVersion,
      payloadJson,
      JSON.stringify(execution.reviewedEntities),
      input.run.digestId,
      canonCandidateId,
      continuityCandidateId,
      createdAt,
      createdAt,
    );
    const projection = this.#listSceneAnalysisRunsSerially(input.run.workId).runs.find(
      (run) => run.runId === input.run.runId,
    );
    if (projection === undefined) {
      throw new Error(`Created Scene information update batch disappeared: ${batchId}`);
    }
    return projection;
  }
}

