import {
  useCallback,
  type MutableRefObject,
  type RefObject,
} from "react";

import type { AssistantVocabularyOccurrence } from "../../../application/assistant/assistant-vocabulary-lookup";
import type { AssistantSettingReference } from "../../../application/assistant/assistant-setting-review";
import type { CharacterProjection } from "../../../application/characters/character-contract";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { ForeshadowPointProjection } from "../../../application/foreshadowing/foreshadow-point-contract";
import type { FragmentProjection } from "../../../application/fragments/fragment-contract";
import type { LoreCandidateProjection } from "../../../application/lore/lore-candidate-contract";
import type { LoreEntryEvidenceProjection } from "../../../application/lore/lore-entry-contract";
import type { PlotThreadProjection } from "../../../application/plots/plot-contract";
import type { PlotThreadSourceProjection } from "../../../application/plots/plot-source-contract";
import type { EventRailSourceLocationProjection } from "../../../application/structure/event-rail-projection";
import type { SceneDraftCandidate } from "../../../application/structure/scene-draft-contract";
import type { SceneExtractionCandidate } from "../../../application/structure/scene-extraction-contract";
import type { SceneProjection } from "../../../application/structure/scene-projection";
import type {
  WorkStructureOverviewCharacter,
  WorkStructureOverviewDocument,
  WorkStructureOverviewEvent,
  WorkStructureOverviewPlot,
  WorkStructureOverviewPlotSource,
  WorkStructureOverviewScene,
} from "../../../application/structure/work-structure-overview";
import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import type { EntityId } from "../../../domain/writing";
import type { ManuscriptEditorHandle } from "../../editor/ManuscriptEditor";
import type { PlotWorkspaceTab } from "../../editor/PlotWorkspace";
import { createForeshadowManuscriptPort } from "../../features/foreshadow/foreshadow-client";
import type { useAssistantController } from "../../features/assistant/useAssistantController";
import type { useCharactersController } from "../../features/characters/useCharactersController";
import type { useCanonReviewController } from "../../features/canon/useCanonReviewController";
import type { useContinuityController } from "../../features/continuity/useContinuityController";
import type { useCharacterKnowledgeController } from "../../features/knowledge/useCharacterKnowledgeController";
import type { useManuscriptFocusController } from "../../features/activity/useManuscriptFocusController";
import type {
  useEventWorkspaceState,
} from "../../features/structure/useEventWorkspaceController";
import type { useForeshadowController } from "../../features/foreshadow/useForeshadowController";
import type { useFragmentsController } from "../../features/fragments/useFragmentsController";
import type { useLoreController } from "../../features/lore/useLoreController";
import type {
  usePlotWorkspaceState,
} from "../../features/structure/usePlotWorkspaceController";
import type {
  useSceneWorkspaceController,
  useSceneWorkspaceState,
} from "../../features/structure/useSceneWorkspaceController";
import type { useStructureController } from "../../features/structure/useStructureController";
import type { useResumeCheckpointController } from "../session/useResumeCheckpointController";
import { openWorkspaceSessionDocumentTab } from "../session/WorkspaceSessionStore";
import type { useWorkspaceSession } from "../session/useWorkspaceSession";
import type { WorkspaceRuntimeState } from "../session/workspace-session-state";
import type { useWorkStructureState } from "../structure/useWorkStructureState";
import { DocumentNavigator } from "./DocumentNavigator";
import type {
  DocumentNavigationDocument,
  DocumentNavigationPorts,
  DocumentNavigationTarget,
} from "./document-target";
import type { useWorkspaceNavigationState } from "./useWorkspaceNavigationController";

export type DocumentNavigationFeatureAdapter = Readonly<{
  applyTabPolicy: DocumentNavigationPorts["applyTabPolicy"];
  onActivationStarted: (document: DocumentNavigationDocument) => void;
  onRevealSucceeded: (document: DocumentNavigationDocument) => void;
  surfacePolicy?: "write" | "preserve";
}>;

export type CanonEvidenceNavigationSource = Readonly<{
  documentId: EntityId<"Document"> | string;
  documentRevisionId: EntityId<"DocumentRevision"> | string;
  from: number;
  to: number;
  exactText: string;
}>;

export function createCanonEvidenceNavigationTarget(
  workId: EntityId<"Work">,
  evidence: CanonEvidenceNavigationSource,
): Extract<DocumentNavigationTarget, { kind: "exact-selection" }> | null {
  if (
    !Number.isSafeInteger(evidence.from) ||
    !Number.isSafeInteger(evidence.to) ||
    evidence.from < 0 ||
    evidence.to <= evidence.from ||
    evidence.exactText.length === 0
  ) {
    return null;
  }
  return Object.freeze({
    kind: "exact-selection",
    workId,
    documentId: evidence.documentId as EntityId<"Document">,
    documentRevisionId: evidence.documentRevisionId as EntityId<"DocumentRevision">,
    range: Object.freeze({ from: evidence.from, to: evidence.to }),
  });
}

export function useWorkspaceFeatureNavigationController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | undefined;
  activeWork: WorkspaceWorkSummary | undefined;
  activeWorkCharacters: readonly CharacterProjection[];
  activeWorkDocumentIds: readonly EntityId<"Document">[];
  activeWorkDocuments: readonly ManuscriptDocumentSource[];
  activeWorkId: EntityId<"Work"> | null;
  activeWorkPlotSources: readonly PlotThreadSourceProjection[];
  activeWorkPlots: readonly PlotThreadProjection[];
  captureCharacterWorkspaceSelection: () => Promise<
    ReturnType<typeof useCharactersController>["characterWorkspaceSelection"]
  >;
  captureResumeForDocument: ReturnType<
    typeof useResumeCheckpointController
  >["captureResume"];
  controllers: Readonly<{
    assistant: ReturnType<typeof useAssistantController>;
    canon: ReturnType<typeof useCanonReviewController>;
    continuity: ReturnType<typeof useContinuityController>;
    characterKnowledge: ReturnType<typeof useCharacterKnowledgeController>;
    characters: ReturnType<typeof useCharactersController>;
    eventState: ReturnType<typeof useEventWorkspaceState>;
    foreshadow: ReturnType<typeof useForeshadowController>;
    manuscriptFocus: ReturnType<typeof useManuscriptFocusController>;
    fragments: ReturnType<typeof useFragmentsController>;
    lore: ReturnType<typeof useLoreController>;
    plotState: ReturnType<typeof usePlotWorkspaceState>;
    scene: ReturnType<typeof useSceneWorkspaceController>;
    sceneState: ReturnType<typeof useSceneWorkspaceState>;
    structure: ReturnType<typeof useStructureController>;
    workStructure: ReturnType<typeof useWorkStructureState>;
    workspaceNavigation: ReturnType<typeof useWorkspaceNavigationState>;
  }>;
  createDocumentNavigationPorts: (
    adapter: DocumentNavigationFeatureAdapter,
  ) => DocumentNavigationPorts;
  documentNavigationSelectionResumeSuppressionRef: MutableRefObject<
    DocumentNavigationDocument | null
  >;
  documentNavigator: DocumentNavigator;
  foreshadowLines: ReturnType<
    typeof useForeshadowController
  >["foreshadowLines"];
  manuscriptEditorRef: RefObject<ManuscriptEditorHandle | null>;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  runtime: WorkspaceRuntimeState;
  session: Pick<
    ReturnType<typeof useWorkspaceSession>,
    "setDocumentTabSession"
  >;
}>) {
  const {
    activeDocument,
    activeWork,
    activeWorkCharacters,
    activeWorkDocumentIds,
    activeWorkDocuments,
    activeWorkId,
    activeWorkPlotSources,
    activeWorkPlots,
    captureCharacterWorkspaceSelection,
    captureResumeForDocument,
    createDocumentNavigationPorts,
    documentNavigationSelectionResumeSuppressionRef,
    documentNavigator,
    foreshadowLines,
    manuscriptEditorRef,
    persistDocument,
    runtime,
  } = input;
  const { setDocumentTabSession } = input.session;
  const {
    assistantContextActionState,
    dismissAssistantContextForNavigation,
    hideAssistantContextForNavigation,
    reopenAssistantContextAfterNavigation,
    reportAssistantContextError,
  } = input.controllers.assistant;
  const {
    clearFeedback: clearCanonReviewFeedback,
    reportError: reportCanonReviewError,
  } = input.controllers.canon;
  const {
    clearFeedback: clearContinuityFeedback,
    reportError: reportContinuityError,
  } = input.controllers.continuity;
  const {
    clearFeedback: clearCharacterKnowledgeFeedback,
    reportError: reportCharacterKnowledgeError,
  } = input.controllers.characterKnowledge;
  const {
    evidenceNavigation: characterEvidenceNavigation,
    focusCharacterInStructure,
    hideCharacterDialog,
  } = input.controllers.characters;
  const {
    clearEventActionError,
    eventActionState,
    finishEventOpening,
    reportEventActionError,
    startEventOpening,
  } = input.controllers.eventState;
  const {
    captureForeshadowPoint: captureForeshadowPointAction,
    focusForeshadowLineInStructure,
    sourceNavigation: foreshadowSourceNavigation,
  } = input.controllers.foreshadow;
  const {
    exitManuscriptFocus,
  } = input.controllers.manuscriptFocus;
  const {
    completeFragmentSourceNavigation,
    failFragmentSourceNavigation,
    reopenFragmentShelfAfterSourceNavigationFailure,
    startFragmentSourceNavigation,
  } = input.controllers.fragments;
  const {
    candidateNavigation: loreCandidateNavigation,
    canonicalNavigation: loreCanonicalNavigation,
    enterLoreStructureSurface,
  } = input.controllers.lore;
  const {
    preparePlotSourceNavigation,
    reopenPlotManagementDialog,
    reportPlotActionError,
    selectPlotWorkspaceInitialTab,
    showPlotInWorkspace,
  } = input.controllers.plotState;
  const {
    captureSceneExtractionSelection,
  } = input.controllers.scene;
  const {
    clearSceneActionError,
    clearSceneBoundaryPreview,
    clearSceneDraftActionError,
    clearSceneExtractionActionError,
    finishSceneDraftNavigation,
    finishSceneExtractionPreview,
    publishSceneBoundaryPreview,
    reportSceneActionError,
    reportSceneDraftActionError,
    reportSceneExtractionActionError,
    sceneDraftActionState,
    sceneExtractionActionState,
    startSceneDraftNavigation,
    startSceneExtractionPreview,
  } = input.controllers.sceneState;
  const { eventSources } = input.controllers.structure;
  const {
    clearWorkStructureActionError,
    finishWorkStructureNavigation,
    hideWorkStructureDialog,
    reopenWorkStructureDialog,
    reportWorkStructureActionError,
    startWorkStructureNavigation,
    workStructureActionState,
  } = input.controllers.workStructure;
  const {
    preserveCurrentWorkLocation,
    selectCanonTab,
    selectStructureTab,
    showWorkSection,
    workSection,
  } = input.controllers.workspaceNavigation;

  const openCanonEvidence = useCallback(async (
    evidence: CanonEvidenceNavigationSource,
    surface: Readonly<{
      clearFeedback(): void;
      label: string;
      reportError(message: string): void;
      tab: "review" | "continuity" | "knowledge";
    }>,
  ) => {
    if (runtime.status !== "ready" || activeWork === undefined) {
      surface.reportError(`${surface.label} 근거를 열 수 있는 작품이 준비되지 않았습니다.`);
      return;
    }
    const target = createCanonEvidenceNavigationTarget(activeWork.workId, evidence);
    if (target === null) {
      surface.reportError(`${surface.label} 근거의 정확한 원문 범위가 올바르지 않습니다.`);
      return;
    }
    const sourceDocument = runtime.documentProfile.documents.find((document) =>
      document.workId === activeWork.workId &&
      document.documentId === evidence.documentId
    );
    if (sourceDocument === undefined) {
      surface.reportError(`${surface.label} 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.`);
      return;
    }
    preserveCurrentWorkLocation();
    surface.clearFeedback();
    const orderedDocumentIds = runtime.documentProfile.documents
      .filter((document) => document.workId === sourceDocument.workId)
      .map((document) => document.documentId);
    const currentActiveDocumentId = runtime.activeDocumentId ?? sourceDocument.documentId;
    let crossDocumentActivationStarted = false;
    const result = await documentNavigator.open(
      { target },
      createDocumentNavigationPorts({
        onActivationStarted: () => {
          crossDocumentActivationStarted = true;
        },
        applyTabPolicy: (document) => {
          if (crossDocumentActivationStarted) {
            setDocumentTabSession((current) =>
              openWorkspaceSessionDocumentTab({
                session: current,
                workId: document.workId,
                orderedDocumentIds,
                activeDocumentId: currentActiveDocumentId,
                documentId: document.documentId,
              })
            );
          }
          return "applied";
        },
        onRevealSucceeded: (document) => {
          documentNavigationSelectionResumeSuppressionRef.current =
            Object.freeze({ ...document });
        },
      }),
    );
    const resumeSuppression = documentNavigationSelectionResumeSuppressionRef.current;
    if (
      resumeSuppression?.workId === sourceDocument.workId &&
      resumeSuppression.documentId === sourceDocument.documentId
    ) {
      documentNavigationSelectionResumeSuppressionRef.current = null;
    }
    if (result.status === "superseded") return;
    if (result.status === "opened") {
      if (result.path !== "cross-document") {
        void captureResumeForDocument(sourceDocument).catch(() => undefined);
      }
      return;
    }
    selectCanonTab(surface.tab);
    showWorkSection("canon");
    if (result.status === "missing-document") {
      surface.reportError(`${surface.label} 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.`);
    } else if (result.status === "stale-revision") {
      surface.reportError(`${surface.label} 근거가 가리키는 원고 revision과 현재 원고가 다릅니다.`);
    } else if (
      result.status === "blocked" &&
      result.reason === "activation-rejected"
    ) {
      surface.reportError(`${surface.label} 근거의 원본 회차를 열지 못했습니다.`);
    } else {
      surface.reportError(`${surface.label} 근거의 정확한 원문 범위를 선택하지 못했습니다.`);
    }
  }, [
    activeWork,
    captureResumeForDocument,
    createDocumentNavigationPorts,
    documentNavigationSelectionResumeSuppressionRef,
    documentNavigator,
    preserveCurrentWorkLocation,
    runtime,
    selectCanonTab,
    setDocumentTabSession,
    showWorkSection,
  ]);

  const openCanonReviewEvidence = useCallback((
    evidence: CanonEvidenceNavigationSource,
  ) => openCanonEvidence(evidence, {
    clearFeedback: clearCanonReviewFeedback,
    label: "별빛",
    reportError: reportCanonReviewError,
    tab: "review",
  }), [clearCanonReviewFeedback, openCanonEvidence, reportCanonReviewError]);

  const openContinuityEvidence = useCallback((
    evidence: CanonEvidenceNavigationSource,
  ) => openCanonEvidence(evidence, {
    clearFeedback: clearContinuityFeedback,
    label: "연속성",
    reportError: reportContinuityError,
    tab: "continuity",
  }), [clearContinuityFeedback, openCanonEvidence, reportContinuityError]);

  const openCharacterKnowledgeEvidence = useCallback((
    evidence: CanonEvidenceNavigationSource,
  ) => openCanonEvidence(evidence, {
    clearFeedback: clearCharacterKnowledgeFeedback,
    label: "인물 지식",
    reportError: reportCharacterKnowledgeError,
    tab: "knowledge",
  }), [
    clearCharacterKnowledgeFeedback,
    openCanonEvidence,
    reportCharacterKnowledgeError,
  ]);

  const focusScene = useCallback(
      async (scene: SceneProjection) => {
        if (
          activeDocument === undefined ||
          scene.documentId !== activeDocument.documentId ||
          scene.integrity !== "resolved" ||
          scene.range === null
        ) {
          reportSceneActionError("이 장면은 현재 원고에서 바로 열 수 없습니다.");
          return;
        }
        const range = { from: scene.range.start, to: scene.range.end };
        const visibleTransitionStarted = workSection !== "write";
        preserveCurrentWorkLocation();
        if (visibleTransitionStarted) {
          clearSceneActionError();
        }
        const result = await documentNavigator.open(
          {
            target: {
              kind: "exact-selection",
              workId: activeDocument.workId,
              documentId: activeDocument.documentId,
              documentRevisionId: scene.documentRevisionId,
              range,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => undefined,
            applyTabPolicy: () => "applied",
            onRevealSucceeded: () => undefined,
          }),
        );
        if (result.status === "superseded") return;
        if (result.status !== "opened") {
          reportSceneActionError("장면의 정확한 범위로 이동하지 못했습니다.");
          return;
        }
        clearSceneActionError();
        if (result.path === "visible-transition") {
          void captureResumeForDocument(activeDocument).catch(() => undefined);
        }
      },
      [
        activeDocument,
        captureResumeForDocument,
        clearSceneActionError,
        createDocumentNavigationPorts,
        documentNavigator,
        preserveCurrentWorkLocation,
        reportSceneActionError,
        workSection,
      ],
    );
  
  const openAssistantVocabularyOccurrence = useCallback(
      async (occurrence: AssistantVocabularyOccurrence) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          assistantContextActionState !== "idle"
        ) {
          return;
        }
        const targetDocument = activeWorkDocuments.find(
          (document) => document.documentId === occurrence.documentId,
        );
        if (targetDocument === undefined) {
          reportAssistantContextError(
            "저장된 어휘 위치의 원본 회차를 찾지 못했습니다.",
          );
          return;
        }
        const range = { from: occurrence.from, to: occurrence.to };
        const orderedDocumentIds = activeWorkDocuments.map(
          (document) => document.documentId,
        );
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? targetDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "exact-selection",
              workId: targetDocument.workId,
              documentId: targetDocument.documentId,
              documentRevisionId: occurrence.documentRevisionId,
              range,
            },
          },
          createDocumentNavigationPorts({
            surfacePolicy: "preserve",
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
              hideAssistantContextForNavigation();
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: (document) => {
              documentNavigationSelectionResumeSuppressionRef.current =
                Object.freeze({ ...document });
            },
          }),
        );
        const resumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          resumeSuppression?.workId === targetDocument.workId &&
          resumeSuppression.documentId === targetDocument.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
        }
        if (result.status === "superseded") return;
        if (result.status === "opened") {
          hideAssistantContextForNavigation();
          if (result.path !== "cross-document") {
            void captureResumeForDocument(targetDocument).catch(() => undefined);
          }
          return;
        }
        if (result.status === "missing-document") {
          reportAssistantContextError(
            "저장된 어휘 위치의 원본 회차를 찾지 못했습니다.",
          );
        } else if (result.status === "stale-revision") {
          reportAssistantContextError(
            "저장된 어휘 위치의 원고 revision이 변경되었습니다.",
          );
        } else if (
          result.status === "blocked" &&
          result.reason === "activation-rejected"
        ) {
          reportAssistantContextError(
            "저장된 어휘 위치의 원본 회차를 열지 못했습니다.",
          );
        } else {
          reportAssistantContextError(
            "저장된 어휘의 정확한 원문 범위를 선택하지 못했습니다.",
          );
        }
        if (crossDocumentActivationStarted) {
          reopenAssistantContextAfterNavigation();
        }
      },
      [activeWork, activeWorkDocuments, assistantContextActionState, captureResumeForDocument, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, hideAssistantContextForNavigation, reopenAssistantContextAfterNavigation, reportAssistantContextError, runtime, setDocumentTabSession],
    );
  
  const prepareCharacterWorkspace = useCallback(async () => {
      hideCharacterDialog();
      return captureCharacterWorkspaceSelection();
    }, [captureCharacterWorkspaceSelection, hideCharacterDialog]);
  
  const openCharacterEvidence = useCallback(async (
      character: CharacterProjection,
      evidence: CharacterProjection["evidences"][number],
    ) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        character.workId !== activeWork.workId ||
        evidence.integrity !== "resolved" ||
        evidence.range === null
      ) {
        characterEvidenceNavigation.reject(
          "이 캐릭터 근거의 원고 위치를 바로 열 수 없습니다.",
        );
        return;
      }
      const targetDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.workId === activeWork.workId &&
          document.documentId === evidence.documentId,
      );
      if (targetDocument === undefined) {
        characterEvidenceNavigation.reject(
          "캐릭터 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.",
        );
        return;
      }
      const visibleTransitionStarted =
        activeDocument?.documentId === targetDocument.documentId &&
        workSection !== "write";
      preserveCurrentWorkLocation();
      if (visibleTransitionStarted) {
        characterEvidenceNavigation.visibleTransitionStarted();
      }
      let crossDocumentActivationStarted = false;
      const result = await documentNavigator.open(
        {
          target: {
            kind: "current-selection",
            workId: activeWork.workId,
            documentId: targetDocument.documentId,
            range: evidence.range,
          },
        },
        createDocumentNavigationPorts({
          onActivationStarted: () => {
            crossDocumentActivationStarted = true;
            characterEvidenceNavigation.activationStarted();
          },
          applyTabPolicy: () => {
            if (crossDocumentActivationStarted) {
              characterEvidenceNavigation.tabPolicyApplied();
            }
            return "applied";
          },
          onRevealSucceeded: (document) => {
            documentNavigationSelectionResumeSuppressionRef.current =
              Object.freeze({ ...document });
          },
        }),
      );
      const resumeSuppression =
        documentNavigationSelectionResumeSuppressionRef.current;
      if (
        resumeSuppression?.workId === targetDocument.workId &&
        resumeSuppression.documentId === targetDocument.documentId
      ) {
        documentNavigationSelectionResumeSuppressionRef.current = null;
      }
      if (result.status === "superseded") {
        characterEvidenceNavigation.superseded(
          crossDocumentActivationStarted,
        );
        return;
      }
      if (result.status === "opened") {
        characterEvidenceNavigation.opened(result.path);
        if (result.path === "visible-transition") {
          void captureResumeForDocument(targetDocument).catch(() => undefined);
        }
        return;
      }
      if (result.status === "missing-document") {
        characterEvidenceNavigation.failed(
          "캐릭터 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.",
          crossDocumentActivationStarted,
        );
      } else if (
        result.status === "blocked" &&
        result.reason === "activation-rejected"
      ) {
        characterEvidenceNavigation.failed(
          "캐릭터 근거의 원본 회차를 열지 못했습니다.",
          crossDocumentActivationStarted,
        );
      } else {
        characterEvidenceNavigation.failed(
          "캐릭터 근거의 정확한 원고 범위를 선택하지 못했습니다.",
          crossDocumentActivationStarted,
        );
      }
    }, [activeDocument?.documentId, activeWork, captureResumeForDocument, characterEvidenceNavigation, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, preserveCurrentWorkLocation, runtime, workSection]);
  
  const preparePlotWorkspace = useCallback(async (
      initialTab: PlotWorkspaceTab = "board",
    ) => {
      const selection = await captureSceneExtractionSelection();
      selectPlotWorkspaceInitialTab(initialTab);
      return selection;
    }, [captureSceneExtractionSelection, selectPlotWorkspaceInitialTab]);
  
  const previewSceneExtractionCandidate = useCallback(async (
      candidate: SceneExtractionCandidate,
    ) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        candidate.workId !== activeWork.workId ||
        sceneExtractionActionState !== "idle"
      ) {
        return;
      }
      const targetDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.workId === candidate.workId &&
          document.documentId === candidate.sourceRange.documentId,
      );
      if (targetDocument === undefined) {
        clearSceneBoundaryPreview();
        reportSceneExtractionActionError(
          "장면 후보의 원본 회차를 현재 작품에서 찾지 못했습니다.",
        );
        return;
      }
      const offset = candidate.boundaries.find(
        (boundary) => boundary.status === "pending",
      )?.offset ?? candidate.sourceRange.from;
      const navigationPreviewTarget = Object.freeze({
        workId: candidate.workId,
        documentId: candidate.sourceRange.documentId,
        documentRevisionId: candidate.sourceRange.documentRevisionId,
      });
      clearSceneBoundaryPreview();
      preserveCurrentWorkLocation();
      clearSceneExtractionActionError();
      let crossDocumentActivationStarted = false;
      const result = await documentNavigator.open(
        {
          target: {
            kind: "exact-preview-offset",
            workId: candidate.workId,
            documentId: candidate.sourceRange.documentId,
            documentRevisionId: candidate.sourceRange.documentRevisionId,
            offset,
          },
        },
        createDocumentNavigationPorts({
          onActivationStarted: () => {
            crossDocumentActivationStarted = true;
            startSceneExtractionPreview();
          },
          applyTabPolicy: () => "applied",
          onRevealSucceeded: (document) => {
            documentNavigationSelectionResumeSuppressionRef.current =
              Object.freeze({ ...document });
            publishSceneBoundaryPreview(navigationPreviewTarget);
          },
        }),
      );
      const resumeSuppression =
        documentNavigationSelectionResumeSuppressionRef.current;
      if (
        resumeSuppression?.workId === targetDocument.workId &&
        resumeSuppression.documentId === targetDocument.documentId
      ) {
        documentNavigationSelectionResumeSuppressionRef.current = null;
      }
      if (result.status === "superseded") {
        if (crossDocumentActivationStarted) {
          finishSceneExtractionPreview();
        }
        clearSceneBoundaryPreview();
        return;
      }
      if (result.status === "opened") {
        if (crossDocumentActivationStarted) {
          finishSceneExtractionPreview();
        }
        clearSceneExtractionActionError();
        return;
      }
      clearSceneBoundaryPreview();
      if (crossDocumentActivationStarted) {
        finishSceneExtractionPreview();
      }
      if (result.status === "missing-document") {
        reportSceneExtractionActionError(
          "장면 후보의 원본 회차를 현재 작품에서 찾지 못했습니다.",
        );
      } else if (
        result.status === "blocked" &&
        result.reason === "activation-rejected"
      ) {
        reportSceneExtractionActionError(
          "장면 후보의 원본 회차를 열지 못했습니다.",
        );
      } else {
        reportSceneExtractionActionError(
          "장면 경계 미리보기 위치를 원고에서 열지 못했습니다.",
        );
      }
    }, [activeWork, clearSceneBoundaryPreview, clearSceneExtractionActionError, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, finishSceneExtractionPreview, preserveCurrentWorkLocation, publishSceneBoundaryPreview, reportSceneExtractionActionError, runtime, sceneExtractionActionState, startSceneExtractionPreview]);
  
  const compareSceneDraftCandidate = useCallback(async (
      candidate: SceneDraftCandidate,
    ) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        candidate.workId !== activeWork.workId ||
        sceneDraftActionState !== "idle"
      ) {
        return;
      }
      const targetDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.workId === candidate.workId &&
          document.documentId === candidate.target.documentId,
      );
      if (targetDocument === undefined) {
        reportSceneDraftActionError("장면 초안의 대상 회차를 찾지 못했습니다.");
        return;
      }
      const offset = Math.min(
        candidate.target.insertionOffset,
        targetDocument.initialText.length,
      );
      preserveCurrentWorkLocation();
      let crossDocumentActivationStarted = false;
      const result = await documentNavigator.open(
        {
          target: {
            kind: "current-preview-offset",
            workId: candidate.workId,
            documentId: candidate.target.documentId,
            offset,
          },
        },
        createDocumentNavigationPorts({
          onActivationStarted: () => {
            crossDocumentActivationStarted = true;
            startSceneDraftNavigation();
          },
          applyTabPolicy: () => "applied",
          onRevealSucceeded: (document) => {
            documentNavigationSelectionResumeSuppressionRef.current =
              Object.freeze({ ...document });
          },
        }),
      );
      const resumeSuppression =
        documentNavigationSelectionResumeSuppressionRef.current;
      if (
        resumeSuppression?.workId === targetDocument.workId &&
        resumeSuppression.documentId === targetDocument.documentId
      ) {
        documentNavigationSelectionResumeSuppressionRef.current = null;
      }
      if (result.status === "superseded") {
        if (crossDocumentActivationStarted) {
          finishSceneDraftNavigation();
        }
        return;
      }
      if (result.status === "opened") {
        if (crossDocumentActivationStarted) {
          finishSceneDraftNavigation();
          clearSceneDraftActionError();
        }
        return;
      }
      if (crossDocumentActivationStarted) {
        finishSceneDraftNavigation();
      }
      if (result.status === "missing-document") {
        reportSceneDraftActionError("장면 초안의 대상 회차를 찾지 못했습니다.");
      } else if (
        result.status === "blocked" &&
        result.reason === "activation-rejected"
      ) {
        reportSceneDraftActionError("장면 초안의 대상 회차를 열지 못했습니다.");
      } else {
        reportSceneDraftActionError(
          crossDocumentActivationStarted
            ? "장면 초안의 현재 원고 위치를 열지 못했습니다."
            : "현재 원고 위치를 열지 못했습니다.",
        );
      }
    }, [activeWork, clearSceneDraftActionError, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, finishSceneDraftNavigation, preserveCurrentWorkLocation, reportSceneDraftActionError, runtime, sceneDraftActionState, startSceneDraftNavigation]);
  
  const openLoreEntryEvidence = useCallback(
      async (evidence: LoreEntryEvidenceProjection) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          evidence.integrity !== "resolved" ||
          evidence.range === null
        ) {
          loreCanonicalNavigation.reject(
            "검토가 필요한 별빛 근거는 원문 위치를 추정해서 열지 않습니다.",
          );
          return;
        }
        const sourceDocument = runtime.documentProfile.documents.find(
          (document) =>
            document.workId === activeWork.workId &&
            document.documentId === evidence.sourceDocumentId,
        );
        if (sourceDocument === undefined) {
          loreCanonicalNavigation.reject(
            "별빛 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.",
          );
          return;
        }
        const visibleTransitionStarted =
          activeDocument?.documentId === sourceDocument.documentId &&
          workSection !== "write";
        preserveCurrentWorkLocation();
        if (visibleTransitionStarted) {
          loreCanonicalNavigation.started();
        }
        const orderedDocumentIds = runtime.documentProfile.documents
          .filter((document) => document.workId === sourceDocument.workId)
          .map((document) => document.documentId);
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? sourceDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "exact-selection",
              workId: sourceDocument.workId,
              documentId: evidence.sourceDocumentId,
              documentRevisionId: evidence.sourceDocumentRevisionId,
              range: evidence.range,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
              loreCanonicalNavigation.started();
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: (document) => {
              documentNavigationSelectionResumeSuppressionRef.current =
                Object.freeze({ ...document });
            },
          }),
        );
        const resumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          resumeSuppression?.workId === sourceDocument.workId &&
          resumeSuppression.documentId === sourceDocument.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
        }
        if (result.status === "superseded") return;
        if (result.status === "opened") {
          loreCanonicalNavigation.opened();
          if (result.path !== "cross-document") {
            void captureResumeForDocument(sourceDocument).catch(() => undefined);
          }
          return;
        }
        if (result.status === "missing-document") {
          loreCanonicalNavigation.failed(
            "별빛 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.",
            crossDocumentActivationStarted,
          );
        } else if (
          result.status === "blocked" &&
          result.reason === "activation-rejected"
        ) {
          loreCanonicalNavigation.failed(
            "별빛 근거의 원본 회차를 열지 못했습니다.",
            crossDocumentActivationStarted,
          );
        } else {
          loreCanonicalNavigation.failed(
            "별빛 근거의 정확한 원문 범위를 선택하지 못했습니다.",
            crossDocumentActivationStarted,
          );
        }
      },
      [activeDocument?.documentId, activeWork, captureResumeForDocument, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, loreCanonicalNavigation, preserveCurrentWorkLocation, runtime, setDocumentTabSession, workSection],
    );
  
  const openLoreCandidateEvidence = useCallback(
      async (candidate: LoreCandidateProjection) => {
        const evidence = candidate.evidence;
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          candidate.workId !== activeWork.workId ||
          evidence.integrity !== "resolved" ||
          evidence.range === null
        ) {
          loreCandidateNavigation.reject(
            "검토가 필요한 후보 근거는 원문 위치를 추정해서 열지 않습니다.",
          );
          return;
        }
        const sourceDocument = runtime.documentProfile.documents.find(
          (document) =>
            document.workId === candidate.workId &&
            document.documentId === evidence.sourceDocumentId,
        );
        if (sourceDocument === undefined) {
          loreCandidateNavigation.reject(
            "후보 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.",
          );
          return;
        }
        const visibleTransitionStarted =
          activeDocument?.documentId === sourceDocument.documentId &&
          workSection !== "write";
        preserveCurrentWorkLocation();
        if (visibleTransitionStarted) {
          loreCandidateNavigation.started();
        }
        const orderedDocumentIds = runtime.documentProfile.documents
          .filter((document) => document.workId === sourceDocument.workId)
          .map((document) => document.documentId);
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? sourceDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "exact-selection",
              workId: candidate.workId,
              documentId: evidence.sourceDocumentId,
              documentRevisionId: evidence.sourceDocumentRevisionId,
              range: evidence.range,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
              loreCandidateNavigation.started();
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: (document) => {
              documentNavigationSelectionResumeSuppressionRef.current =
                Object.freeze({ ...document });
            },
          }),
        );
        const resumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          resumeSuppression?.workId === sourceDocument.workId &&
          resumeSuppression.documentId === sourceDocument.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
        }
        if (result.status === "superseded") return;
        if (result.status === "opened") {
          loreCandidateNavigation.opened();
          if (result.path !== "cross-document") {
            void captureResumeForDocument(sourceDocument).catch(() => undefined);
          }
          return;
        }
        if (result.status === "missing-document") {
          loreCandidateNavigation.failed(
            "후보 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.",
            crossDocumentActivationStarted,
          );
        } else if (
          result.status === "blocked" &&
          result.reason === "activation-rejected"
        ) {
          loreCandidateNavigation.failed(
            "후보 근거의 원본 회차를 열지 못했습니다.",
            crossDocumentActivationStarted,
          );
        } else {
          loreCandidateNavigation.failed(
            "후보 근거의 정확한 원문 범위를 선택하지 못했습니다.",
            crossDocumentActivationStarted,
          );
        }
      },
      [activeDocument?.documentId, activeWork, captureResumeForDocument, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, loreCandidateNavigation, preserveCurrentWorkLocation, runtime, setDocumentTabSession, workSection],
    );
  
  const openPlotThreadSource = useCallback(
      async (source: PlotThreadSourceProjection) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          source.workId !== activeWork.workId ||
          source.integrity !== "resolved" ||
          source.range === null
        ) {
          reportPlotActionError(
            "검토가 필요한 플롯 출처는 원문 위치를 추정해서 열지 않습니다.",
          );
          return;
        }
        const sourceDocument = runtime.documentProfile.documents.find(
          (document) =>
            document.workId === source.workId &&
            document.documentId === source.sourceDocumentId,
        );
        if (sourceDocument === undefined) {
          reportPlotActionError("플롯 출처의 원본 회차를 찾지 못했습니다.");
          return;
        }
        const visibleTransitionStarted =
          activeDocument?.documentId === sourceDocument.documentId &&
          workSection !== "write";
        preserveCurrentWorkLocation();
        if (visibleTransitionStarted) {
          preparePlotSourceNavigation();
        }
        const orderedDocumentIds = runtime.documentProfile.documents
          .filter((document) => document.workId === sourceDocument.workId)
          .map((document) => document.documentId);
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? sourceDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "exact-selection",
              workId: source.workId,
              documentId: source.sourceDocumentId,
              documentRevisionId: source.sourceDocumentRevisionId,
              range: source.range,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
              preparePlotSourceNavigation();
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: (document) => {
              documentNavigationSelectionResumeSuppressionRef.current =
                Object.freeze({ ...document });
            },
          }),
        );
        const resumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          resumeSuppression?.workId === sourceDocument.workId &&
          resumeSuppression.documentId === sourceDocument.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
        }
        if (result.status === "superseded") return;
        if (result.status === "opened") {
          preparePlotSourceNavigation();
          if (result.path !== "cross-document") {
            void captureResumeForDocument(sourceDocument).catch(() => undefined);
          }
          return;
        }
        if (result.status === "missing-document") {
          reportPlotActionError("플롯 출처의 원본 회차를 찾지 못했습니다.");
        } else if (
          result.status === "blocked" &&
          result.reason === "activation-rejected"
        ) {
          reportPlotActionError("플롯 출처의 원본 회차를 열지 못했습니다.");
        } else {
          reportPlotActionError(
            "플롯 출처의 정확한 원문 범위를 선택하지 못했습니다.",
          );
        }
        if (crossDocumentActivationStarted) {
          reopenPlotManagementDialog();
        }
      },
      [activeDocument?.documentId, activeWork, captureResumeForDocument, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, preparePlotSourceNavigation, preserveCurrentWorkLocation, reopenPlotManagementDialog, reportPlotActionError, runtime, setDocumentTabSession, workSection],
    );
  
  const openWorkStructureDocument = useCallback(
      async (document: WorkStructureOverviewDocument) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          workStructureActionState !== "idle"
        ) {
          return;
        }
        const targetDocument = activeWorkDocuments.find(
          (candidate) =>
            candidate.workId === activeWork.workId &&
            candidate.documentId === document.documentId,
        );
        if (targetDocument === undefined) {
          reportWorkStructureActionError(
            "작품 구조에 기록된 회차를 현재 작품에서 찾지 못했습니다.",
          );
          return;
        }
        preserveCurrentWorkLocation();
        startWorkStructureNavigation(true);
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? targetDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "document",
              workId: activeWork.workId,
              documentId: targetDocument.documentId,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds: activeWorkDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: () => undefined,
          }),
        );
        finishWorkStructureNavigation();
        if (result.status === "superseded") return;
        if (result.status === "opened") {
          clearWorkStructureActionError();
          return;
        }
        if (result.status === "missing-document") {
          reportWorkStructureActionError(
            "작품 구조에 기록된 회차를 현재 작품에서 찾지 못했습니다.",
          );
        } else {
          reportWorkStructureActionError(
            "작품 구조에 기록된 회차를 열지 못했습니다.",
          );
        }
        if (crossDocumentActivationStarted) {
          reopenWorkStructureDialog();
        }
      },
      [activeWork, activeWorkDocumentIds, activeWorkDocuments, clearWorkStructureActionError, createDocumentNavigationPorts, documentNavigator, finishWorkStructureNavigation, preserveCurrentWorkLocation, reopenWorkStructureDialog, reportWorkStructureActionError, runtime, setDocumentTabSession, startWorkStructureNavigation, workStructureActionState],
    );
  
  const openEventRailSource = useCallback(
      async (location: EventRailSourceLocationProjection) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          eventActionState !== "idle"
        ) {
          return;
        }
        if (location.integrity !== "resolved" || location.range === null) {
          reportEventActionError(
            "검토가 필요한 사건은 원문 위치를 추정해서 열지 않습니다.",
          );
          return;
        }
        const targetDocument = activeWorkDocuments.find(
          (document) =>
            document.workId === activeWork.workId &&
            document.documentId === location.documentId,
        );
        if (targetDocument === undefined) {
          reportEventActionError(
            "사건의 원문 회차를 현재 작품에서 찾지 못했습니다.",
          );
          return;
        }
        preserveCurrentWorkLocation();
        startEventOpening();
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? targetDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "exact-selection",
              workId: activeWork.workId,
              documentId: targetDocument.documentId,
              documentRevisionId: location.documentRevisionId,
              range: location.range,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds: activeWorkDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: (document) => {
              documentNavigationSelectionResumeSuppressionRef.current =
                Object.freeze({ ...document });
            },
          }),
        );
        const resumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          resumeSuppression?.workId === targetDocument.workId &&
          resumeSuppression.documentId === targetDocument.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
        }
        if (result.status === "superseded") {
          finishEventOpening();
          return;
        }
        finishEventOpening();
        if (result.status === "opened") {
          clearEventActionError();
          return;
        }
        if (result.status === "missing-document") {
          reportEventActionError(
            "사건의 원문 회차를 현재 작품에서 찾지 못했습니다.",
          );
        } else if (
          result.status === "blocked" &&
          result.reason === "activation-rejected"
        ) {
          reportEventActionError("사건의 정확한 원문 회차를 열지 못했습니다.");
        } else {
          reportEventActionError(
            "사건의 정확한 원고 범위를 선택하지 못했습니다.",
          );
        }
      },
      [activeWork, activeWorkDocumentIds, activeWorkDocuments, clearEventActionError, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, eventActionState, finishEventOpening, preserveCurrentWorkLocation, reportEventActionError, runtime, setDocumentTabSession, startEventOpening],
    );
  
  const openWorkStructureRange = useCallback(
      async (input: {
        readonly documentId: ManuscriptDocumentSource["documentId"];
        readonly range: { readonly from: number; readonly to: number };
      }) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          workStructureActionState !== "idle"
        ) {
          return;
        }
        const targetDocument = activeWorkDocuments.find(
          (document) =>
            document.workId === activeWork.workId &&
            document.documentId === input.documentId,
        );
        if (targetDocument === undefined) {
          reportWorkStructureActionError(
            "작품 구조의 원문 회차를 현재 작품에서 찾지 못했습니다.",
          );
          return;
        }
        const visibleTransitionStarted =
          activeDocument?.documentId === targetDocument.documentId &&
          workSection !== "write";
        preserveCurrentWorkLocation();
        startWorkStructureNavigation(visibleTransitionStarted);
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? targetDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "current-selection",
              workId: activeWork.workId,
              documentId: targetDocument.documentId,
              range: input.range,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
              hideWorkStructureDialog();
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds: activeWorkDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: (document) => {
              documentNavigationSelectionResumeSuppressionRef.current =
                Object.freeze({ ...document });
            },
          }),
        );
        const resumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          resumeSuppression?.workId === targetDocument.workId &&
          resumeSuppression.documentId === targetDocument.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
        }
        if (result.status === "superseded") {
          finishWorkStructureNavigation();
          return;
        }
        finishWorkStructureNavigation();
        if (result.status === "opened") {
          clearWorkStructureActionError();
          if (result.path === "same-document") {
            hideWorkStructureDialog();
          }
          if (result.path !== "cross-document") {
            void captureResumeForDocument(targetDocument).catch(() => undefined);
          }
          return;
        }
        if (result.status === "missing-document") {
          reportWorkStructureActionError(
            "작품 구조의 원문 회차를 현재 작품에서 찾지 못했습니다.",
          );
        } else if (
          result.status === "blocked" &&
          result.reason === "activation-rejected"
        ) {
          reportWorkStructureActionError(
            "작품 구조의 정확한 원문 회차를 열지 못했습니다.",
          );
        } else {
          reportWorkStructureActionError(
            "작품 구조에 기록된 정확한 원문 범위를 선택하지 못했습니다.",
          );
        }
        if (crossDocumentActivationStarted) {
          reopenWorkStructureDialog();
        }
      },
      [activeDocument?.documentId, activeWork, activeWorkDocumentIds, activeWorkDocuments, captureResumeForDocument, clearWorkStructureActionError, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, finishWorkStructureNavigation, hideWorkStructureDialog, preserveCurrentWorkLocation, reopenWorkStructureDialog, reportWorkStructureActionError, runtime, setDocumentTabSession, startWorkStructureNavigation, workSection, workStructureActionState],
    );
  
  const openWorkStructureCharacter = useCallback(
      (character: WorkStructureOverviewCharacter) => {
        if (
          activeWorkCharacters.some(
            (candidate) => candidate.characterId === character.characterId,
          )
        ) {
          hideWorkStructureDialog();
          focusCharacterInStructure(character.characterId);
          selectStructureTab("characters");
          showWorkSection("structure");
        } else {
          reportWorkStructureActionError(
            "작품 구조에 기록된 인물을 현재 작품에서 찾지 못했습니다.",
          );
        }
      },
      [
        activeWorkCharacters,
        focusCharacterInStructure,
        hideWorkStructureDialog,
        reportWorkStructureActionError,
        selectStructureTab,
        showWorkSection,
      ],
    );
  
  const openWorkStructureLore = useCallback(() => {
      hideWorkStructureDialog();
      enterLoreStructureSurface();
      selectStructureTab("lore");
      showWorkSection("structure");
    }, [
      enterLoreStructureSurface,
      hideWorkStructureDialog,
      selectStructureTab,
      showWorkSection,
    ]);
  
  const openWorkStructurePlot = useCallback(
      (plot: WorkStructureOverviewPlot) => {
        if (
          activeWorkPlots.some(
            (candidate) => candidate.plotThreadId === plot.plotThreadId,
          )
        ) {
          showPlotInWorkspace(plot.plotThreadId);
          hideWorkStructureDialog();
          selectStructureTab("plots");
          showWorkSection("structure");
        } else {
          reportWorkStructureActionError(
            "작품 구조에 기록된 플롯을 현재 작품에서 찾지 못했습니다.",
          );
        }
      },
      [
        activeWorkPlots,
        hideWorkStructureDialog,
        reportWorkStructureActionError,
        selectStructureTab,
        showPlotInWorkspace,
        showWorkSection,
      ],
    );
  
  const openWorkStructurePlotSource = useCallback(
      (source: WorkStructureOverviewPlotSource) => {
        const currentSource = activeWorkPlotSources.find(
          (candidate) => candidate.sourceId === source.sourceId,
        );
        if (
          currentSource === undefined ||
          currentSource.integrity !== "resolved" ||
          currentSource.range === null
        ) {
          reportWorkStructureActionError(
            "검토가 필요한 플롯 출처는 원문 위치를 추정해서 열지 않습니다.",
          );
          return;
        }
        void openWorkStructureRange({
          documentId: currentSource.sourceDocumentId,
          range: currentSource.range,
        });
      },
      [
        activeWorkPlotSources,
        openWorkStructureRange,
        reportWorkStructureActionError,
      ],
    );
  
  const openWorkStructureEvent = useCallback(
      (event: WorkStructureOverviewEvent) => {
        const currentSource = event.source === null
          ? undefined
          : eventSources.find(
              (candidate) =>
                candidate.workId === activeWorkId &&
                candidate.eventSourceId === event.source?.eventSourceId,
            );
        const currentAnchor = currentSource?.anchors.find(
          (anchor) => anchor.documentId === event.source?.documentId,
        );
        if (
          currentAnchor === undefined ||
          currentAnchor.integrity !== "resolved" ||
          currentAnchor.range === null
        ) {
          reportWorkStructureActionError(
            "검토가 필요한 사건은 원문 위치를 추정해서 열지 않습니다.",
          );
          return;
        }
        void openWorkStructureRange({
          documentId: currentAnchor.documentId,
          range: currentAnchor.range,
        });
      },
      [
        activeWorkId,
        eventSources,
        openWorkStructureRange,
        reportWorkStructureActionError,
      ],
    );
  
  const openWorkStructureScene = useCallback(
      (scene: WorkStructureOverviewScene) => {
        if (
          scene.integrity !== "resolved" ||
          scene.range === null
        ) {
          reportWorkStructureActionError(
            "검토가 필요한 장면은 원문 위치를 추정해서 열지 않습니다.",
          );
          return;
        }
        void openWorkStructureRange({
          documentId: scene.documentId,
          range: { from: scene.range.start, to: scene.range.end },
        });
      },
      [openWorkStructureRange, reportWorkStructureActionError],
    );
  
  const captureForeshadowPoint = useCallback(
      (lineId: string, roleId: string, note: string) => {
        const editor = manuscriptEditorRef.current;
        const manuscriptPort = editor === null
          ? null
          : createForeshadowManuscriptPort(
              {
                readSelection: (document) => {
                  const summary = editor.readDocumentState(document);
                  const selection =
                    summary?.selection.ranges[summary.selection.mainIndex];
                  return selection === undefined
                    ? undefined
                    : Object.freeze({
                        anchor: selection.anchor,
                        head: selection.head,
                        from: selection.from,
                        to: selection.to,
                        empty: selection.empty,
                      });
                },
                materializeDocumentText: (document) =>
                  editor.materializeDocumentText(document),
              },
              persistDocument,
            );
        return captureForeshadowPointAction(
          lineId,
          roleId,
          note,
          manuscriptPort,
        );
      },
      [captureForeshadowPointAction, manuscriptEditorRef, persistDocument],
    );
  
  const openForeshadowPointSource = useCallback(
      async (point: ForeshadowPointProjection) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          point.workId !== activeWork.workId ||
          point.integrity !== "resolved" ||
          point.range === null
        ) {
          foreshadowSourceNavigation.reject(
            "검토가 필요한 복선 지점은 원문 위치를 추정해서 열지 않습니다.",
          );
          return;
        }
        const sourceDocument = runtime.documentProfile.documents.find(
          (document) =>
            document.workId === point.workId &&
            document.documentId === point.sourceDocumentId,
        );
        if (sourceDocument === undefined) {
          foreshadowSourceNavigation.reject(
            "복선 지점의 원본 회차를 찾지 못했습니다.",
          );
          return;
        }
        const visibleTransitionStarted =
          activeDocument?.documentId === sourceDocument.documentId &&
          workSection !== "write";
        preserveCurrentWorkLocation();
        if (visibleTransitionStarted) {
          foreshadowSourceNavigation.started();
        }
        const orderedDocumentIds = runtime.documentProfile.documents
          .filter((document) => document.workId === sourceDocument.workId)
          .map((document) => document.documentId);
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? sourceDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "exact-selection",
              workId: point.workId,
              documentId: point.sourceDocumentId,
              documentRevisionId: point.sourceDocumentRevisionId,
              range: point.range,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
              foreshadowSourceNavigation.started();
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: (document) => {
              documentNavigationSelectionResumeSuppressionRef.current =
                Object.freeze({ ...document });
            },
          }),
        );
        const resumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          resumeSuppression?.workId === sourceDocument.workId &&
          resumeSuppression.documentId === sourceDocument.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
        }
        if (result.status === "superseded") return;
        if (result.status === "opened") {
          foreshadowSourceNavigation.opened();
          if (result.path !== "cross-document") {
            void captureResumeForDocument(sourceDocument).catch(() => undefined);
          }
          return;
        }
        if (result.status === "missing-document") {
          foreshadowSourceNavigation.failed(
            "복선 지점의 원본 회차를 찾지 못했습니다.",
            crossDocumentActivationStarted,
          );
        } else if (
          result.status === "blocked" &&
          result.reason === "activation-rejected"
        ) {
          foreshadowSourceNavigation.failed(
            "복선 지점의 원본 회차를 열지 못했습니다.",
            crossDocumentActivationStarted,
          );
        } else {
          foreshadowSourceNavigation.failed(
            "복선 지점의 정확한 원문 범위를 선택하지 못했습니다.",
            crossDocumentActivationStarted,
          );
        }
      },
      [activeDocument?.documentId, activeWork, captureResumeForDocument, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, documentNavigator, foreshadowSourceNavigation, preserveCurrentWorkLocation, runtime, setDocumentTabSession, workSection],
    );
  
  const openFragmentSource = useCallback(
      async (fragment: FragmentProjection) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          fragment.workId !== activeWork.workId ||
          fragment.integrity !== "resolved" ||
          fragment.range === null
        ) {
          failFragmentSourceNavigation(
            "검토가 필요한 파편은 원문 위치를 추정해서 열지 않습니다.",
            false,
          );
          return;
        }
        const sourceDocument = runtime.documentProfile.documents.find(
          (document) =>
            document.workId === fragment.workId &&
            document.documentId === fragment.sourceDocumentId,
        );
        if (sourceDocument === undefined) {
          failFragmentSourceNavigation("파편의 원본 회차를 찾지 못했습니다.", false);
          return;
        }
        preserveCurrentWorkLocation();
        const orderedDocumentIds = runtime.documentProfile.documents
          .filter((document) => document.workId === sourceDocument.workId)
          .map((document) => document.documentId);
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? sourceDocument.documentId;
        let crossDocumentActivationStarted = false;
        const result = await documentNavigator.open(
          {
            target: {
              kind: "exact-selection",
              workId: fragment.workId,
              documentId: fragment.sourceDocumentId,
              documentRevisionId: fragment.sourceDocumentRevisionId,
              range: fragment.range,
            },
          },
          createDocumentNavigationPorts({
            onActivationStarted: () => {
              crossDocumentActivationStarted = true;
              startFragmentSourceNavigation();
            },
            applyTabPolicy: (document) => {
              if (crossDocumentActivationStarted) {
                setDocumentTabSession((current) =>
                  openWorkspaceSessionDocumentTab({
                    session: current,
                    workId: document.workId,
                    orderedDocumentIds,
                    activeDocumentId: currentActiveDocumentId,
                    documentId: document.documentId,
                  }),
                );
              }
              return "applied";
            },
            onRevealSucceeded: (document) => {
              documentNavigationSelectionResumeSuppressionRef.current =
                Object.freeze({ ...document });
            },
          }),
        );
        const resumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          resumeSuppression?.workId === sourceDocument.workId &&
          resumeSuppression.documentId === sourceDocument.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
        }
        if (result.status === "superseded") return;
        if (result.status === "opened") {
          completeFragmentSourceNavigation();
          if (result.path !== "cross-document") {
            void captureResumeForDocument(sourceDocument).catch(() => undefined);
          }
          return;
        }
        if (result.status === "missing-document") {
          failFragmentSourceNavigation("파편의 원본 회차를 찾지 못했습니다.", false);
        } else if (
          result.status === "blocked" &&
          result.reason === "activation-rejected"
        ) {
          failFragmentSourceNavigation("파편의 원본 회차를 열지 못했습니다.", false);
        } else {
          failFragmentSourceNavigation(
            "파편의 정확한 원문 범위를 선택하지 못했습니다.",
            false,
          );
        }
        if (crossDocumentActivationStarted) {
          reopenFragmentShelfAfterSourceNavigationFailure();
        }
      },
      [runtime, activeWork, preserveCurrentWorkLocation, documentNavigator, createDocumentNavigationPorts, documentNavigationSelectionResumeSuppressionRef, failFragmentSourceNavigation, startFragmentSourceNavigation, setDocumentTabSession, completeFragmentSourceNavigation, captureResumeForDocument, reopenFragmentShelfAfterSourceNavigationFailure],
    );
  const openAssistantSettingReference = useCallback(
    (reference: AssistantSettingReference) => {
      if (activeWork === undefined || assistantContextActionState !== "idle") {
        return;
      }
      if (reference.kind === "character") {
        const character = activeWorkCharacters.find(
          (candidate) => candidate.characterId === reference.entityId,
        );
        if (character === undefined || character.revision !== reference.revision) {
          reportAssistantContextError(
            "검토 당시 인물 revision과 현재 인물이 다릅니다. 설정 검토를 다시 실행하세요.",
          );
          return;
        }
        dismissAssistantContextForNavigation();
        focusCharacterInStructure(character.characterId);
        selectStructureTab("characters");
        showWorkSection("structure");
        exitManuscriptFocus();
        return;
      }
      if (reference.kind === "plot") {
        const plot = activeWorkPlots.find(
          (candidate) => candidate.plotThreadId === reference.entityId,
        );
        if (plot === undefined || plot.revision !== reference.revision) {
          reportAssistantContextError(
            "검토 당시 플롯 revision과 현재 플롯이 다릅니다. 설정 검토를 다시 실행하세요.",
          );
          return;
        }
        dismissAssistantContextForNavigation();
        showPlotInWorkspace(plot.plotThreadId, "board");
        selectStructureTab("plots");
        showWorkSection("structure");
        exitManuscriptFocus();
        return;
      }
      const line = foreshadowLines.find(
        (candidate) =>
          candidate.workId === activeWork.workId &&
          candidate.lineId === reference.entityId,
      );
      if (line === undefined || line.revision !== reference.revision) {
        reportAssistantContextError(
          "검토 당시 복선 revision과 현재 복선이 다릅니다. 설정 검토를 다시 실행하세요.",
        );
        return;
      }
      dismissAssistantContextForNavigation();
      focusForeshadowLineInStructure(line.lineId);
      selectStructureTab("foreshadow");
      showWorkSection("structure");
      exitManuscriptFocus();
    },
    [
      activeWork,
      activeWorkCharacters,
      focusCharacterInStructure,
      activeWorkPlots,
      assistantContextActionState,
      dismissAssistantContextForNavigation,
      exitManuscriptFocus,
      focusForeshadowLineInStructure,
      foreshadowLines,
      reportAssistantContextError,
      selectStructureTab,
      showPlotInWorkspace,
      showWorkSection,
    ],
  );

  return {
    openCanonReviewEvidence,
    openContinuityEvidence,
    openCharacterKnowledgeEvidence,
    openAssistantSettingReference,
    focusScene,
    openAssistantVocabularyOccurrence,
    prepareCharacterWorkspace,
    openCharacterEvidence,
    preparePlotWorkspace,
    previewSceneExtractionCandidate,
    compareSceneDraftCandidate,
    openLoreEntryEvidence,
    openLoreCandidateEvidence,
    openPlotThreadSource,
    openWorkStructureDocument,
    openEventRailSource,
    openWorkStructureCharacter,
    openWorkStructureLore,
    openWorkStructurePlot,
    openWorkStructurePlotSource,
    openWorkStructureEvent,
    openWorkStructureScene,
    captureForeshadowPoint,
    openForeshadowPointSource,
    openFragmentSource,
  };
}
