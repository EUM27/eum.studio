import { useCallback, useMemo, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { PlotThreadProjection } from "../../../application/plots/plot-contract";
import type {
  SceneExtractionAnnotationDecision,
  SceneExtractionBoundary,
  SceneExtractionCandidate,
  SceneExtractionScene,
} from "../../../application/structure/scene-extraction-contract";
import type { SceneDraftCandidate } from "../../../application/structure/scene-draft-contract";
import type {
  SceneEventOverrideOperation,
  SceneProjection,
  SceneProjectionList,
  UpdateSceneRuleSetCommand,
} from "../../../application/structure/scene-projection";
import { entityId, type EntityId } from "../../../domain/writing";
import type {
  ManuscriptDocumentStateSummary,
} from "../../editor/ManuscriptEditor";
import type {
  ManuscriptSceneBoundaryPreview,
} from "../../editor/scene-boundary-preview-extension";
import type {
  SceneBoundaryHistoryEntry,
} from "../../editor/scene-boundary-history-extension";
import type { SceneDraftActionState } from "../../editor/SceneDraftPanel";
import type {
  SceneExtractionActionState,
  SceneExtractionSelection,
} from "../../editor/SceneExtractionPanel";
import type { useStructureController } from "./useStructureController";

type SceneStructureClient = Pick<
  StudioBridge["structure"],
  | "createSceneOverride"
  | "updateSceneRuleSet"
  | "setSceneEventOverride"
  | "runSceneExtraction"
  | "decideSceneExtractionBoundary"
  | "decideSceneExtractionAnnotation"
  | "runSceneDraft"
  | "updateSceneDraftCandidate"
  | "prepareSceneDraftInsertion"
  | "completeSceneDraftInsertion"
>;

type ScenePermissionClient = Pick<
  StudioBridge["assistant"],
  "grantContextPermission"
>;

type StructureReconcile = ReturnType<
  typeof useStructureController
>["reconcile"];

type SceneBoundaryNavigationPreviewTarget = Readonly<{
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
}>;

export type SceneWorkspaceState = ReturnType<typeof useSceneWorkspaceState>;

export function useSceneWorkspaceState() {
  const [sceneActionState, setSceneActionState] = useState<
    "idle" | "creating" | "updating-rule" | "updating-event"
  >("idle");
  const [sceneActionError, setSceneActionError] = useState<string | null>(null);
  const [sceneDraftActionState, setSceneDraftActionState] =
    useState<SceneDraftActionState>("idle");
  const [sceneDraftActionError, setSceneDraftActionError] = useState<
    string | null
  >(null);
  const [sceneExtractionSelection, setSceneExtractionSelection] =
    useState<SceneExtractionSelection | null>(null);
  const [
    sceneBoundaryNavigationPreviewTarget,
    setSceneBoundaryNavigationPreviewTarget,
  ] = useState<SceneBoundaryNavigationPreviewTarget | null>(null);
  const [sceneExtractionActionState, setSceneExtractionActionState] =
    useState<SceneExtractionActionState>("idle");
  const [sceneExtractionActionError, setSceneExtractionActionError] =
    useState<string | null>(null);
  const [sceneExtractionPermissionRequired, setSceneExtractionPermissionRequired] =
    useState(false);
  const [sceneExtractionDestinationId, setSceneExtractionDestinationId] =
    useState<string | null>(null);

  const resetSceneWorkspace = useCallback(() => {
    setSceneDraftActionError(null);
    setSceneExtractionSelection(null);
    setSceneExtractionActionError(null);
    setSceneExtractionPermissionRequired(false);
    setSceneExtractionDestinationId(null);
    setSceneBoundaryNavigationPreviewTarget(null);
  }, []);
  const installLoadedSceneWorkspace = useCallback(() => {
    setSceneExtractionSelection(null);
    setSceneBoundaryNavigationPreviewTarget(null);
    setSceneExtractionPermissionRequired(false);
    setSceneExtractionDestinationId(null);
    setSceneActionError(null);
    setSceneExtractionActionError(null);
    setSceneDraftActionError(null);
  }, []);
  const failSceneWorkspaceLoad = useCallback(() => {
    setSceneBoundaryNavigationPreviewTarget(null);
    setSceneActionError("장면 목록을 불러오지 못했습니다.");
  }, []);
  const clearSceneActionError = useCallback(() => {
    setSceneActionError(null);
  }, []);
  const reportSceneActionError = useCallback((message: string) => {
    setSceneActionError(message);
  }, []);
  const clearSceneExtractionActionError = useCallback(() => {
    setSceneExtractionActionError(null);
  }, []);
  const reportSceneExtractionActionError = useCallback((message: string) => {
    setSceneExtractionActionError(message);
  }, []);
  const selectSceneExtraction = useCallback((
    selection: SceneExtractionSelection | null,
  ) => {
    setSceneExtractionSelection(selection);
  }, []);
  const clearSceneContextForDocumentEdit = useCallback((
    document: ManuscriptDocumentSource,
  ) => {
    setSceneExtractionSelection((current) =>
      current?.documentId === document.documentId ? null : current
    );
    setSceneBoundaryNavigationPreviewTarget((current) =>
      current?.workId === document.workId &&
        current.documentId === document.documentId
        ? null
        : current
    );
  }, []);
  const clearSceneBoundaryPreview = useCallback(() => {
    setSceneBoundaryNavigationPreviewTarget(null);
  }, []);
  const publishSceneBoundaryPreview = useCallback((
    target: SceneBoundaryNavigationPreviewTarget,
  ) => {
    setSceneBoundaryNavigationPreviewTarget(target);
  }, []);
  const startSceneExtractionPreview = useCallback(() => {
    setSceneExtractionActionState("previewing");
  }, []);
  const finishSceneExtractionPreview = useCallback(() => {
    setSceneExtractionActionState("idle");
  }, []);
  const startSceneDraftNavigation = useCallback(() => {
    setSceneDraftActionState("applying");
  }, []);
  const finishSceneDraftNavigation = useCallback(() => {
    setSceneDraftActionState("idle");
  }, []);
  const clearSceneDraftActionError = useCallback(() => {
    setSceneDraftActionError(null);
  }, []);
  const reportSceneDraftActionError = useCallback((message: string) => {
    setSceneDraftActionError(message);
  }, []);

  return useMemo(() => ({
    sceneActionState,
    setSceneActionState,
    sceneActionError,
    setSceneActionError,
    sceneDraftActionState,
    setSceneDraftActionState,
    sceneDraftActionError,
    setSceneDraftActionError,
    sceneExtractionSelection,
    setSceneExtractionSelection,
    sceneBoundaryNavigationPreviewTarget,
    sceneExtractionActionState,
    setSceneExtractionActionState,
    sceneExtractionActionError,
    setSceneExtractionActionError,
    sceneExtractionPermissionRequired,
    setSceneExtractionPermissionRequired,
    sceneExtractionDestinationId,
    setSceneExtractionDestinationId,
    resetSceneWorkspace,
    installLoadedSceneWorkspace,
    failSceneWorkspaceLoad,
    clearSceneActionError,
    reportSceneActionError,
    clearSceneExtractionActionError,
    reportSceneExtractionActionError,
    selectSceneExtraction,
    clearSceneContextForDocumentEdit,
    clearSceneBoundaryPreview,
    publishSceneBoundaryPreview,
    startSceneExtractionPreview,
    finishSceneExtractionPreview,
    startSceneDraftNavigation,
    finishSceneDraftNavigation,
    clearSceneDraftActionError,
    reportSceneDraftActionError,
  }), [
    clearSceneActionError,
    clearSceneBoundaryPreview,
    clearSceneContextForDocumentEdit,
    clearSceneDraftActionError,
    clearSceneExtractionActionError,
    failSceneWorkspaceLoad,
    finishSceneDraftNavigation,
    finishSceneExtractionPreview,
    installLoadedSceneWorkspace,
    publishSceneBoundaryPreview,
    reportSceneActionError,
    reportSceneDraftActionError,
    reportSceneExtractionActionError,
    resetSceneWorkspace,
    sceneActionError,
    sceneActionState,
    sceneBoundaryNavigationPreviewTarget,
    sceneDraftActionError,
    sceneDraftActionState,
    sceneExtractionActionError,
    sceneExtractionActionState,
    sceneExtractionDestinationId,
    sceneExtractionPermissionRequired,
    sceneExtractionSelection,
    selectSceneExtraction,
    startSceneDraftNavigation,
    startSceneExtractionPreview,
  ]);
}

export function useSceneWorkspaceController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  activeWorkPlots: readonly PlotThreadProjection[];
  assistantConversationId: EntityId<"AssistantConversation">;
  assistantPermissionClient: ScenePermissionClient;
  createSceneDraftRequestId: () => EntityId<"SceneDraftRequest">;
  createSceneExtractionRequestId: () => EntityId<"SceneExtractionRequest">;
  editor: Readonly<{
    getCurrentRevisionId: (
      documentId: EntityId<"Document">,
    ) => EntityId<"DocumentRevision"> | null | undefined;
    insertTextAtExactOffset: (
      document: ManuscriptDocumentSource,
      offset: number,
      expectedLength: number,
      text: string,
    ) => boolean;
    materializeDocumentText: (
      document: ManuscriptDocumentSource,
    ) => string | undefined;
    readDocumentState: (
      document: ManuscriptDocumentSource,
    ) => ManuscriptDocumentStateSummary | null | undefined;
    recordSceneBoundaryHistory: (
      document: ManuscriptDocumentSource,
      entry: SceneBoundaryHistoryEntry,
    ) => boolean;
  }>;
  openWritingSurface: () => void;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  prepareSceneExtractionCapture: () => void;
  reconcile: StructureReconcile;
  refreshSceneMusicQueueCandidates: (
    workId: EntityId<"Work">,
  ) => Promise<unknown>;
  refreshSceneProjection: ReturnType<
    typeof useStructureController
  >["refreshSceneProjection"];
  sceneExtractionCandidates: readonly SceneExtractionCandidate[];
  sceneProjection: SceneProjectionList | null;
  state: SceneWorkspaceState;
  structureClient: SceneStructureClient;
}>) {
  const sceneBoundaryPreviews = useMemo<
    readonly ManuscriptSceneBoundaryPreview[]
  >(() => {
    const activeDocument = input.activeDocument;
    if (activeDocument === null) return Object.freeze([]);
    const currentRevisionId =
      input.state.sceneBoundaryNavigationPreviewTarget?.workId ===
          activeDocument.workId &&
        input.state.sceneBoundaryNavigationPreviewTarget.documentId ===
          activeDocument.documentId
        ? input.state.sceneBoundaryNavigationPreviewTarget.documentRevisionId
        : input.state.sceneExtractionSelection?.documentId ===
            activeDocument.documentId
          ? input.state.sceneExtractionSelection.documentRevisionId
          : activeDocument.documentRevisionId;
    return Object.freeze(input.sceneExtractionCandidates.flatMap((candidate) => {
      if (
        candidate.status !== "ready" ||
        candidate.workId !== activeDocument.workId ||
        candidate.sourceRange.documentId !== activeDocument.documentId ||
        candidate.sourceRange.documentRevisionId !== currentRevisionId
      ) {
        return [];
      }
      return candidate.boundaries.flatMap((boundary) => {
        if (boundary.status !== "pending") return [];
        const before = candidate.scenes.find(
          (scene) => scene.sceneItemId === boundary.fromSceneItemId,
        );
        const after = candidate.scenes.find(
          (scene) => scene.sceneItemId === boundary.toSceneItemId,
        );
        if (before === undefined || after === undefined) return [];
        return [Object.freeze({
          boundaryId: boundary.boundaryId,
          offset: boundary.offset,
          beforeTitle: before.title,
          afterTitle: after.title,
        })];
      });
    }));
  }, [
    input.activeDocument,
    input.sceneExtractionCandidates,
    input.state.sceneBoundaryNavigationPreviewTarget,
    input.state.sceneExtractionSelection,
  ]);

  const createSceneBoundary = useCallback(async (
    operation: "add" | "split" = "add",
  ) => {
    if (
      input.activeDocument === null ||
      input.state.sceneActionState !== "idle"
    ) return;
    const summary = input.editor.readDocumentState(input.activeDocument);
    const selection = summary?.selection.ranges[summary.selection.mainIndex];
    const manuscript = input.editor.materializeDocumentText(input.activeDocument);
    if (selection === undefined || manuscript === undefined) {
      input.state.setSceneActionError("현재 원고 위치를 읽지 못했습니다.");
      return;
    }
    input.state.setSceneActionState("creating");
    input.state.setSceneActionError(null);
    try {
      await input.persistDocument(input.activeDocument);
      const created = await input.structureClient.createSceneOverride({
        schemaVersion: 1,
        workId: input.activeDocument.workId,
        documentId: input.activeDocument.documentId,
        selection: { anchor: selection.anchor, head: selection.head },
        exactQuote: manuscript.slice(selection.from, selection.to),
        operation,
        note: "",
      });
      if (operation === "split") {
        input.editor.recordSceneBoundaryHistory(input.activeDocument, {
          historyId: created.sceneOverrideId,
          workId: input.activeDocument.workId,
          documentId: input.activeDocument.documentId,
          selection: { anchor: selection.anchor, head: selection.head },
          exactQuote: manuscript.slice(selection.from, selection.to),
        });
      }
      await input.refreshSceneProjection(input.activeDocument.workId);
    } catch {
      input.state.setSceneActionError(
        operation === "split"
          ? "현재 위치에서 장면을 분할하지 못했습니다."
          : "현재 위치에 장면 경계를 저장하지 못했습니다.",
      );
    } finally {
      input.state.setSceneActionState("idle");
    }
  }, [input]);

  const applySceneBoundaryHistory = useCallback(async (
    entry: SceneBoundaryHistoryEntry,
    active: boolean,
  ): Promise<void> => {
    const document = input.activeDocument;
    if (
      document === null ||
      document.workId !== entry.workId ||
      document.documentId !== entry.documentId ||
      input.state.sceneActionState !== "idle"
    ) {
      input.state.setSceneActionError("장면 나눔 실행취소 대상을 열 수 없습니다.");
      return;
    }
    const manuscript = input.editor.materializeDocumentText(document);
    const from = Math.min(entry.selection.anchor, entry.selection.head);
    const to = Math.max(entry.selection.anchor, entry.selection.head);
    if (
      manuscript === undefined ||
      to > manuscript.length ||
      manuscript.slice(from, to) !== entry.exactQuote
    ) {
      input.state.setSceneActionError("장면 나눔 실행취소 위치가 현재 원고와 다릅니다.");
      return;
    }
    input.state.setSceneActionState("creating");
    input.state.setSceneActionError(null);
    try {
      await input.persistDocument(document);
      await input.structureClient.createSceneOverride({
        schemaVersion: 1,
        workId: entry.workId,
        documentId: entry.documentId,
        selection: entry.selection,
        exactQuote: entry.exactQuote,
        operation: active ? "split" : "merge",
        note: "",
      });
      await input.refreshSceneProjection(entry.workId);
    } catch {
      input.state.setSceneActionError(
        active
          ? "장면 나눔을 다시 적용하지 못했습니다."
          : "장면 나눔을 취소하지 못했습니다.",
      );
    } finally {
      input.state.setSceneActionState("idle");
    }
  }, [input]);

  const mergeSceneWithPrevious = useCallback(async (
    scene: SceneProjection,
    previousScene: SceneProjection,
  ) => {
    if (
      input.activeDocument === null ||
      input.state.sceneActionState !== "idle" ||
      scene.documentId !== input.activeDocument.documentId ||
      previousScene.documentId !== input.activeDocument.documentId ||
      scene.range === null ||
      previousScene.range === null
    ) return;
    const manuscript = input.editor.materializeDocumentText(input.activeDocument);
    if (manuscript === undefined) {
      input.state.setSceneActionError(
        "현재 원고의 장면 경계를 읽지 못했습니다.",
      );
      return;
    }
    const from = previousScene.range.end;
    const to = scene.range.start;
    input.state.setSceneActionState("creating");
    input.state.setSceneActionError(null);
    try {
      await input.persistDocument(input.activeDocument);
      await input.structureClient.createSceneOverride({
        schemaVersion: 1,
        workId: input.activeDocument.workId,
        documentId: input.activeDocument.documentId,
        selection: { anchor: from, head: to },
        exactQuote: manuscript.slice(from, to),
        operation: "merge",
        note: "",
      });
      await input.refreshSceneProjection(input.activeDocument.workId);
    } catch {
      input.state.setSceneActionError("앞 장면과 병합하지 못했습니다.");
    } finally {
      input.state.setSceneActionState("idle");
    }
  }, [input]);

  const deleteScene = useCallback(async (scene: SceneProjection) => {
    if (
      input.activeDocument === null ||
      input.state.sceneActionState !== "idle" ||
      scene.documentId !== input.activeDocument.documentId ||
      scene.range === null
    ) return;
    const manuscript = input.editor.materializeDocumentText(input.activeDocument);
    if (manuscript === undefined) {
      input.state.setSceneActionError("삭제할 장면 범위를 읽지 못했습니다.");
      return;
    }
    input.state.setSceneActionState("creating");
    input.state.setSceneActionError(null);
    try {
      await input.persistDocument(input.activeDocument);
      await input.structureClient.createSceneOverride({
        schemaVersion: 1,
        workId: input.activeDocument.workId,
        documentId: input.activeDocument.documentId,
        selection: {
          anchor: scene.range.start,
          head: scene.range.end,
        },
        exactQuote: manuscript.slice(scene.range.start, scene.range.end),
        operation: "delete",
        note: "",
      });
      await input.refreshSceneProjection(input.activeDocument.workId);
    } catch {
      input.state.setSceneActionError("장면을 삭제하지 못했습니다.");
    } finally {
      input.state.setSceneActionState("idle");
    }
  }, [input]);

  const updateSceneRuleSet = useCallback(async (
    draft: Pick<
      UpdateSceneRuleSetCommand,
      "displayName" | "boundaryRules" | "normalizationPolicy" | "enabled"
    >,
  ) => {
    if (
      input.sceneProjection === null ||
      input.state.sceneActionState !== "idle"
    ) return;
    input.state.setSceneActionState("updating-rule");
    input.state.setSceneActionError(null);
    try {
      const projection = await input.structureClient.updateSceneRuleSet({
        schemaVersion: 1,
        workId: input.sceneProjection.workId,
        sceneRuleSetId: input.sceneProjection.ruleSet.sceneRuleSetId,
        expectedRevision: input.sceneProjection.ruleSet.revision,
        ...draft,
      });
      input.reconcile.replaceSceneProjection(projection);
    } catch {
      input.state.setSceneActionError("장면 규칙을 저장하지 못했습니다.");
    } finally {
      input.state.setSceneActionState("idle");
    }
  }, [input]);

  const setSceneEventOverride = useCallback(async (
    scene: SceneProjection,
    eventBlockId: EntityId<"EventBlock">,
    operation: SceneEventOverrideOperation | null,
    expectedRevision: number | null,
  ) => {
    if (
      input.sceneProjection === null ||
      input.state.sceneActionState !== "idle" ||
      scene.workId !== input.sceneProjection.workId
    ) return;
    input.state.setSceneActionState("updating-event");
    input.state.setSceneActionError(null);
    try {
      const projection = await input.structureClient.setSceneEventOverride({
        schemaVersion: 1,
        workId: scene.workId,
        sceneKey: scene.sceneKey,
        eventBlockId,
        operation,
        expectedRevision,
      });
      input.reconcile.replaceSceneProjection(projection);
    } catch {
      input.state.setSceneActionError(
        "장면의 사건 소속을 변경하지 못했습니다.",
      );
    } finally {
      input.state.setSceneActionState("idle");
    }
  }, [input]);

  const captureSceneExtractionSelection = useCallback(async () => {
    input.prepareSceneExtractionCapture();
    input.state.setSceneExtractionActionError(null);
    input.state.setSceneExtractionPermissionRequired(false);
    let selection: SceneExtractionSelection | null = null;
    if (input.activeDocument !== null) {
      const summary = input.editor.readDocumentState(input.activeDocument);
      const range = summary?.selection.ranges[summary.selection.mainIndex];
      if (range !== undefined && !range.empty) {
        try {
          await input.persistDocument(input.activeDocument);
          const documentRevisionId = input.editor.getCurrentRevisionId(
            input.activeDocument.documentId,
          ) ?? input.activeDocument.documentRevisionId;
          if (documentRevisionId !== null) {
            selection = Object.freeze({
              documentId: input.activeDocument.documentId,
              documentTitle: input.activeDocument.label,
              documentRevisionId,
              from: range.from,
              to: range.to,
            });
          }
        } catch {
          input.state.setSceneExtractionActionError(
            "현재 선택 범위의 저장 revision을 확정하지 못했습니다.",
          );
        }
      }
    }
    input.state.setSceneExtractionSelection(selection);
    return selection;
  }, [input]);

  const performSceneExtraction = useCallback(async (
    selectionOverride?: SceneExtractionSelection,
  ) => {
    const extractionSelection =
      selectionOverride ?? input.state.sceneExtractionSelection;
    if (input.activeWorkId === null || extractionSelection === null) {
      input.state.setSceneExtractionActionError(
        "원고에서 정확한 범위를 선택한 뒤 장면 구분을 실행하세요.",
      );
      return;
    }
    input.state.setSceneExtractionActionState("extracting");
    input.state.setSceneExtractionActionError(null);
    try {
      const result = await input.structureClient.runSceneExtraction({
        schemaVersion: 1,
        requestId: input.createSceneExtractionRequestId(),
        workId: input.activeWorkId,
        conversationId: input.assistantConversationId,
        sourceRange: {
          documentId: entityId<"Document">(extractionSelection.documentId),
          documentRevisionId: entityId<"DocumentRevision">(
            extractionSelection.documentRevisionId,
          ),
          from: extractionSelection.from,
          to: extractionSelection.to,
        },
      });
      if (result.status === "login-required") {
        input.state.setSceneExtractionActionError(
          "GPT 연결이 필요합니다. 앱 설정에서 GPT로 로그인하세요.",
        );
        return;
      }
      if (result.status === "permission-required") {
        input.state.setSceneExtractionPermissionRequired(true);
        input.state.setSceneExtractionDestinationId(result.destinationId);
        return;
      }
      if (result.status === "context-rejected") {
        input.state.setSceneExtractionActionError(
          result.reason === "stale-context"
            ? "선택 뒤 원고가 변경되었습니다. 범위를 다시 선택하세요."
            : "현재 선택 범위를 장면 구분에 사용할 수 없습니다.",
        );
        return;
      }
      input.state.setSceneExtractionPermissionRequired(false);
      input.state.setSceneExtractionDestinationId(null);
      input.reconcile.upsertSceneExtractionCandidate(result.candidate);
    } catch (reason) {
      input.state.setSceneExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "장면 후보를 만들지 못했습니다.",
      );
    } finally {
      input.state.setSceneExtractionActionState("idle");
    }
  }, [input]);

  const grantSceneExtractionPermission = useCallback(async () => {
    if (
      input.activeWorkId === null ||
      input.state.sceneExtractionDestinationId === null ||
      input.state.sceneExtractionSelection === null ||
      input.state.sceneExtractionActionState !== "idle"
    ) return;
    input.state.setSceneExtractionActionState("granting");
    input.state.setSceneExtractionActionError(null);
    try {
      await input.assistantPermissionClient.grantContextPermission({
        schemaVersion: 1,
        workId: input.activeWorkId,
        conversationId: input.assistantConversationId,
        capability: "scene.extract",
        destinationId: input.state.sceneExtractionDestinationId,
        localScope: "selection",
        externalScope: "selection",
        duration: "once",
      });
      input.state.setSceneExtractionPermissionRequired(false);
      input.state.setSceneExtractionActionState("idle");
      await performSceneExtraction();
    } catch (reason) {
      input.state.setSceneExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "장면 구분 권한을 승인하지 못했습니다.",
      );
      input.state.setSceneExtractionActionState("idle");
    }
  }, [input, performSceneExtraction]);

  const decideSceneExtractionBoundary = useCallback(async (
    candidate: SceneExtractionCandidate,
    boundary: SceneExtractionBoundary,
    decision: "accept" | "exclude",
  ) => {
    if (
      input.activeWorkId === null ||
      candidate.workId !== input.activeWorkId ||
      input.state.sceneExtractionActionState !== "idle"
    ) return;
    input.state.setSceneExtractionActionState("deciding");
    input.state.setSceneExtractionActionError(null);
    try {
      const result =
        await input.structureClient.decideSceneExtractionBoundary({
          schemaVersion: 1,
          workId: input.activeWorkId,
          candidateId: candidate.candidateId,
          expectedCandidateRevision: candidate.revision,
          boundaryId: boundary.boundaryId,
          decision,
        });
      input.reconcile.upsertSceneExtractionCandidate(result.candidate);
      if (result.status === "stale") {
        input.state.setSceneExtractionActionError(
          "후보 생성 뒤 원고가 변경되어 이 경계를 적용할 수 없습니다.",
        );
        return;
      }
      input.reconcile.replaceSceneProjection(result.sceneProjection);
      input.state.setSceneActionError(null);
    } catch (reason) {
      input.state.setSceneExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "장면 경계 결정을 저장하지 못했습니다.",
      );
    } finally {
      input.state.setSceneExtractionActionState("idle");
    }
  }, [input]);

  const decideSceneExtractionAnnotation = useCallback(async (
    candidate: SceneExtractionCandidate,
    scene: SceneExtractionScene,
    decision: SceneExtractionAnnotationDecision,
  ) => {
    if (
      input.activeWorkId === null ||
      candidate.workId !== input.activeWorkId ||
      input.state.sceneExtractionActionState !== "idle"
    ) return;
    input.state.setSceneExtractionActionState("deciding");
    input.state.setSceneExtractionActionError(null);
    try {
      const result =
        await input.structureClient.decideSceneExtractionAnnotation({
          schemaVersion: 1,
          workId: input.activeWorkId,
          candidateId: candidate.candidateId,
          expectedCandidateRevision: candidate.revision,
          sceneItemId: scene.sceneItemId,
          decision,
        });
      input.reconcile.upsertSceneExtractionCandidate(result.candidate);
      if (result.status === "stale") {
        input.state.setSceneExtractionActionError(
          "후보 생성 뒤 원고가 변경되어 이 장면 정보를 적용할 수 없습니다.",
        );
        return;
      }
      input.reconcile.replaceSceneAnnotations(result.annotations.annotations);
      input.reconcile.replaceSceneProjection(result.sceneProjection);
      await input.refreshSceneMusicQueueCandidates(input.activeWorkId);
      input.state.setSceneActionError(null);
    } catch (reason) {
      input.state.setSceneExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "장면 정보 결정을 저장하지 못했습니다.",
      );
    } finally {
      input.state.setSceneExtractionActionState("idle");
    }
  }, [input]);

  const performSceneDraft = useCallback(async (
    plot: PlotThreadProjection,
    characterIds: readonly EntityId<"Character">[],
    settingIds: readonly EntityId<"LoreEntry">[],
  ) => {
    if (
      input.activeDocument === null ||
      input.activeWorkId === null ||
      plot.workId !== input.activeWorkId ||
      input.state.sceneDraftActionState !== "idle"
    ) return;
    const editorState = input.editor.readDocumentState(input.activeDocument);
    const selection =
      editorState?.selection.ranges[editorState.selection.mainIndex];
    if (selection === undefined || !selection.empty) {
      input.state.setSceneDraftActionError(
        "원고에 초안을 넣을 한 곳에 커서를 둔 뒤 플롯 작업면으로 돌아오세요.",
      );
      return;
    }
    input.state.setSceneDraftActionState("generating");
    input.state.setSceneDraftActionError(null);
    try {
      await input.persistDocument(input.activeDocument);
      const documentRevisionId = input.editor.getCurrentRevisionId(
        input.activeDocument.documentId,
      ) ?? input.activeDocument.documentRevisionId;
      if (documentRevisionId === null) {
        throw new Error("장면 초안 대상 원고 revision을 확정하지 못했습니다.");
      }
      const result = await input.structureClient.runSceneDraft({
        schemaVersion: 1,
        requestId: input.createSceneDraftRequestId(),
        workId: input.activeWorkId,
        plotThreadId: plot.plotThreadId,
        expectedPlotRevision: plot.revision,
        target: {
          documentId: input.activeDocument.documentId,
          documentRevisionId,
          insertionOffset: selection.from,
        },
        characterIds,
        settingIds,
      });
      if (result.status === "login-required") {
        input.state.setSceneDraftActionError(
          "GPT 연결 후 장면 초안을 만들 수 있습니다.",
        );
        return;
      }
      input.reconcile.upsertSceneDraftCandidate(result.candidate);
    } catch (reason) {
      input.state.setSceneDraftActionError(
        reason instanceof Error ? reason.message : "장면 초안을 만들지 못했습니다.",
      );
    } finally {
      input.state.setSceneDraftActionState("idle");
    }
  }, [input]);

  const updateSceneDraftCandidate = useCallback(async (
    candidate: SceneDraftCandidate,
    draftText: string,
  ) => {
    if (
      input.activeWorkId === null ||
      candidate.workId !== input.activeWorkId ||
      input.state.sceneDraftActionState !== "idle"
    ) return;
    input.state.setSceneDraftActionState("updating");
    input.state.setSceneDraftActionError(null);
    try {
      const updated =
        await input.structureClient.updateSceneDraftCandidate({
          schemaVersion: 1,
          workId: candidate.workId,
          candidateId: candidate.candidateId,
          expectedCandidateRevision: candidate.revision,
          draftText,
        });
      input.reconcile.upsertSceneDraftCandidate(updated);
    } catch (reason) {
      input.state.setSceneDraftActionError(
        reason instanceof Error
          ? reason.message
          : "장면 초안 변경을 저장하지 못했습니다.",
      );
    } finally {
      input.state.setSceneDraftActionState("idle");
    }
  }, [input]);

  const applySceneDraftCandidate = useCallback(async (
    candidate: SceneDraftCandidate,
  ) => {
    if (
      input.activeDocument === null ||
      input.activeWorkId === null ||
      candidate.workId !== input.activeWorkId ||
      input.state.sceneDraftActionState !== "idle"
    ) return;
    if (input.activeDocument.documentId !== candidate.target.documentId) {
      input.state.setSceneDraftActionError(
        "장면 초안의 대상 회차를 연 뒤 다시 삽입해 주세요.",
      );
      return;
    }
    input.state.setSceneDraftActionState("applying");
    input.state.setSceneDraftActionError(null);
    try {
      await input.persistDocument(input.activeDocument);
      const preparation =
        await input.structureClient.prepareSceneDraftInsertion({
          schemaVersion: 1,
          workId: candidate.workId,
          candidateId: candidate.candidateId,
          expectedCandidateRevision: candidate.revision,
        });
      input.reconcile.upsertSceneDraftCandidate(preparation.candidate);
      if (preparation.status === "stale") {
        input.state.setSceneDraftActionError(
          "플롯 연결 정보나 대상 원고가 생성 이후 변경되어 자동 삽입하지 않았습니다.",
        );
        return;
      }
      let resultDocumentRevisionId: EntityId<"DocumentRevision">;
      if (preparation.status === "already-inserted") {
        resultDocumentRevisionId = preparation.resultDocumentRevisionId;
      } else {
        const inserted = input.editor.insertTextAtExactOffset(
          input.activeDocument,
          candidate.target.insertionOffset,
          preparation.baseDocumentLength,
          candidate.draftText,
        );
        if (!inserted) {
          throw new Error("현재 원고가 달라 장면 초안을 삽입하지 않았습니다.");
        }
        await input.persistDocument(input.activeDocument);
        const currentRevisionId = input.editor.getCurrentRevisionId(
          input.activeDocument.documentId,
        );
        if (currentRevisionId === null || currentRevisionId === undefined) {
          throw new Error("삽입한 장면 초안의 저장 revision을 확인하지 못했습니다.");
        }
        resultDocumentRevisionId = currentRevisionId;
      }
      const completed =
        await input.structureClient.completeSceneDraftInsertion({
          schemaVersion: 1,
          workId: candidate.workId,
          candidateId: candidate.candidateId,
          expectedCandidateRevision: candidate.revision,
          resultDocumentRevisionId,
        });
      input.reconcile.upsertSceneDraftCandidate(completed);
      input.openWritingSurface();
    } catch (reason) {
      input.state.setSceneDraftActionError(
        reason instanceof Error
          ? reason.message
          : "장면 초안을 원고에 삽입하지 못했습니다.",
      );
    } finally {
      input.state.setSceneDraftActionState("idle");
    }
  }, [input]);

  const regenerateSceneDraftCandidate = useCallback((
    candidate: SceneDraftCandidate,
  ) => {
    const plot = input.activeWorkPlots.find(
      (entry) => entry.plotThreadId === candidate.context.plot.plotThreadId,
    );
    if (plot === undefined) {
      input.state.setSceneDraftActionError(
        "다시 생성할 현재 플롯을 찾지 못했습니다.",
      );
      return;
    }
    void performSceneDraft(
      plot,
      candidate.context.characters.map((character) => character.characterId),
      candidate.context.settings.map((setting) => setting.loreEntryId),
    );
  }, [input, performSceneDraft]);

  return {
    sceneBoundaryPreviews,
    createSceneBoundary,
    applySceneBoundaryHistory,
    deleteScene,
    mergeSceneWithPrevious,
    updateSceneRuleSet,
    setSceneEventOverride,
    captureSceneExtractionSelection,
    performSceneExtraction,
    grantSceneExtractionPermission,
    decideSceneExtractionBoundary,
    decideSceneExtractionAnnotation,
    performSceneDraft,
    updateSceneDraftCandidate,
    applySceneDraftCandidate,
    regenerateSceneDraftCandidate,
  };
}
