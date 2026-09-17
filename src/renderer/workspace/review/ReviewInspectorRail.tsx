import { useSyncExternalStore } from "react";
import { Bot, PanelRightClose, PanelRightOpen } from "lucide-react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { WorkStructureOverviewProjection } from "../../../application/structure/work-structure-overview";
import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import { LoreCueInspector } from "../../editor/LoreCueDisclosure";
import { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";
import { ManuscriptAnnotationsPanel } from "../../editor/ManuscriptAnnotationsPanel";
import type { ManuscriptAnnotationProjection } from "../../../application/review/manuscript-annotation-contract";
import type { useManuscriptAnnotationsController } from "../../features/annotations/useManuscriptAnnotationsController";
import type { useAssistantController } from "../../features/assistant/useAssistantController";
import type { useCharactersController } from "../../features/characters/useCharactersController";
import type {
  useEventWorkspaceController,
  useEventWorkspaceState,
} from "../../features/structure/useEventWorkspaceController";
import type {
  useSceneWorkspaceController,
  useSceneWorkspaceState,
} from "../../features/structure/useSceneWorkspaceController";
import type { useForeshadowController } from "../../features/foreshadow/useForeshadowController";
import type { useFragmentsController } from "../../features/fragments/useFragmentsController";
import type { useLoreController } from "../../features/lore/useLoreController";
import type {
  useLoreCueController,
  useLoreCueState,
} from "../../features/lore/useLoreCueController";
import type { useMusicController } from "../../features/music/useMusicController";
import type { usePlotWorkspaceState } from "../../features/structure/usePlotWorkspaceController";
import type { useVersionController } from "../../features/version/useVersionController";
import { CreateEventBlockButton } from "../events/CreateEventBlockButton";
import type { useWorkspaceLayoutController } from "../layout/useWorkspaceLayoutController";
import type { useWorkspaceNavigationController } from "../navigation/useWorkspaceNavigationController";
import type { useWorkStructureState } from "../structure/useWorkStructureState";

function ManuscriptReviewSummary(input: {
  readonly telemetryStore: ManuscriptTelemetryStore;
}) {
  const hasSelection = useSyncExternalStore(
    input.telemetryStore.subscribeSelection,
    input.telemetryStore.getSelectionSnapshot,
  );
  return (
    <p className="review-rail-summary" aria-live="polite">
      {hasSelection
        ? "선택 범위를 검토할 수 있습니다."
        : "선택 범위가 없습니다."}
    </p>
  );
}

function formatVersionTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReviewInspectorRail(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWork: WorkspaceWorkSummary | null;
  commands: Readonly<{
    captureCharacterWorkspaceSelection: () => Promise<
      ReturnType<
        typeof useCharactersController
      >["characterWorkspaceSelection"]
    >;
    openCandidateInbox: () => void;
    openAnnotation: (annotation: ManuscriptAnnotationProjection) => void;
    openPlotWorkspace: ReturnType<
      typeof useWorkspaceNavigationController
    >["openPlotWorkspace"];
    toggleRightRail: () => void;
  }>;
  controllers: Readonly<{
    assistant: ReturnType<typeof useAssistantController>;
    annotations: ReturnType<typeof useManuscriptAnnotationsController>;
    characters: ReturnType<typeof useCharactersController>;
    event: ReturnType<typeof useEventWorkspaceController>;
    eventState: ReturnType<typeof useEventWorkspaceState>;
    foreshadow: ReturnType<typeof useForeshadowController>;
    fragments: ReturnType<typeof useFragmentsController>;
    lore: ReturnType<typeof useLoreController>;
    loreCue: ReturnType<typeof useLoreCueController>;
    loreCueState: ReturnType<typeof useLoreCueState>;
    music: ReturnType<typeof useMusicController>;
    plotState: ReturnType<typeof usePlotWorkspaceState>;
    scene: ReturnType<typeof useSceneWorkspaceController>;
    sceneState: ReturnType<typeof useSceneWorkspaceState>;
    version: ReturnType<typeof useVersionController>;
    workStructure: ReturnType<typeof useWorkStructureState>;
    workspaceLayout: ReturnType<typeof useWorkspaceLayoutController>;
  }>;
  embedded: boolean;
  hasManuscriptSelection: boolean;
  ids: Readonly<{
    assistantTab: string;
    currentTab: string;
    rail: string;
    versionsTab: string;
    workTab: string;
  }>;
  projections: Readonly<{
    activeCharacters: ReturnType<
      typeof useCharactersController
    >["characters"];
    activeLoreCandidates: ReturnType<
      typeof useLoreController
    >["loreCandidates"];
    activeLoreEntries: ReturnType<typeof useLoreController>["loreEntries"];
    activePlots: readonly unknown[];
    workStructureOverview: WorkStructureOverviewProjection | null;
  }>;
  ready: boolean;
  rightRail: Readonly<{
    reentryVisible: boolean;
    visible: boolean;
  }> | null;
  telemetryStore: ManuscriptTelemetryStore;
  workspaceSurface: string;
}>) {
  const activeDocument = input.activeDocument;
  const assistant = input.controllers.assistant;
  const annotations = input.controllers.annotations;
  const characters = input.controllers.characters;
  const event = input.controllers.event;
  const eventState = input.controllers.eventState;
  const foreshadow = input.controllers.foreshadow;
  const fragments = input.controllers.fragments;
  const lore = input.controllers.lore;
  const loreCue = input.controllers.loreCue;
  const loreCueState = input.controllers.loreCueState;
  const music = input.controllers.music;
  const plotState = input.controllers.plotState;
  const scene = input.controllers.scene;
  const sceneState = input.controllers.sceneState;
  const version = input.controllers.version;
  const workStructure = input.controllers.workStructure;
  const workspaceLayout = input.controllers.workspaceLayout;
  const reviewInspectorTab = workspaceLayout.reviewInspectorTab;
  const showsManuscript = input.workspaceSurface === "manuscript";

  return (
    <>
      {input.ready &&
        activeDocument !== null &&
        showsManuscript &&
        input.rightRail?.visible && (
          <aside
            aria-label="검토 레일"
            className="workspace-rail workspace-rail-right"
            id={input.ids.rail}
          >
            <header className="workspace-rail-header">
              <div>
                <p className="review-inspector-kicker">원고 도구</p>
                <h3>검토</h3>
              </div>
              <button
                aria-label="검토 레일 닫기"
                aria-controls={input.ids.rail}
                className="rail-toggle"
                onClick={input.commands.toggleRightRail}
                type="button"
              >
                {input.embedded ? (
                  <PanelRightClose aria-hidden="true" size={16} />
                ) : (
                  "닫기"
                )}
              </button>
            </header>
            <div
              aria-label="검토 범위"
              className="review-inspector-tabs"
              role="tablist"
            >
              <button
                aria-controls={input.ids.rail}
                aria-selected={reviewInspectorTab === "current"}
                id={input.ids.currentTab}
                onClick={() => workspaceLayout.selectReviewInspectorTab("current")}
                role="tab"
                type="button"
              >
                현재
              </button>
              <button
                aria-controls={input.ids.rail}
                aria-selected={reviewInspectorTab === "assistant"}
                id={input.ids.assistantTab}
                onClick={() =>
                  workspaceLayout.selectReviewInspectorTab("assistant")
                }
                role="tab"
                type="button"
              >
                조수
              </button>
            </div>
            <div
              aria-labelledby={
                reviewInspectorTab === "current"
                  ? input.ids.currentTab
                  : reviewInspectorTab === "assistant"
                    ? input.ids.assistantTab
                    : reviewInspectorTab === "work"
                      ? input.ids.workTab
                      : input.ids.versionsTab
              }
              className="review-inspector-panel"
              role="tabpanel"
            >
              <div
                className="review-inspector-section-stack"
                hidden={reviewInspectorTab !== "current"}
              >
                <ManuscriptReviewSummary telemetryStore={input.telemetryStore} />
                <ManuscriptAnnotationsPanel
                  activeDocumentId={activeDocument.documentId}
                  annotations={annotations.annotations}
                  busy={annotations.annotationActionState !== "idle"}
                  documentTitles={Object.fromEntries(
                    input.activeWork?.documents.map((document) => [
                      document.documentId,
                      document.title,
                    ]) ?? [],
                  )}
                  error={annotations.annotationActionError}
                  hasSelection={input.hasManuscriptSelection}
                  onCreate={annotations.createAnnotationFromCurrentSelection}
                  onOpen={input.commands.openAnnotation}
                  onRetire={annotations.retireAnnotation}
                  onUpdate={annotations.updateAnnotation}
                />
                {loreCueState.pinnedLoreCue !== null &&
                  loreCueState.pinnedLoreCue.workId === activeDocument.workId &&
                  loreCueState.pinnedLoreCue.documentId ===
                    activeDocument.documentId && (
                    <LoreCueInspector
                      cue={loreCueState.pinnedLoreCue}
                      entries={input.projections.activeLoreEntries}
                      error={loreCueState.loreCueActionError}
                      onClose={loreCue.closeLoreCueInspector}
                      onSelectOccurrence={loreCue.selectLoreCueOccurrence}
                    />
                  )}
              </div>
              <div
                className="review-inspector-section-stack"
                hidden={reviewInspectorTab !== "assistant"}
              >
                <section
                  aria-label="조수 실행"
                  className="character-manager-rail assistant-candidate-actions"
                >
                  <header>
                    <h4>현재 선택으로 실행</h4>
                    <Bot aria-hidden="true" size={15} />
                  </header>
                  <div className="document-quick-actions">
                    <button
                      className="create-event-button"
                      onClick={() => {
                        void assistant.openAssistantContextDialog();
                      }}
                      type="button"
                    >
                      어휘·표기·설정 도구
                    </button>
                    <button
                      className="create-event-button"
                      onClick={assistant.openAssistantChatDialog}
                      type="button"
                    >
                      조수 대화 열기
                    </button>
                  </div>
                </section>
                <section
                  aria-label="인물 후보 만들기"
                  className="character-manager-rail assistant-candidate-actions"
                >
                  <header>
                    <h4>원고에서 인물 후보</h4>
                    <span>
                      {characters.characterExtractionCandidates.reduce(
                        (count, candidate) =>
                          count +
                          candidate.items.filter(
                            (item) => item.status === "pending",
                          ).length,
                        0,
                      )}
                    </span>
                  </header>
                  <button
                    className="create-event-button"
                    disabled={
                      !input.hasManuscriptSelection ||
                      characters.characterExtractionActionState !== "idle"
                    }
                    onClick={() => {
                      void input.commands
                        .captureCharacterWorkspaceSelection()
                        .then((selection) => {
                          if (selection !== null) {
                            void characters.performCharacterExtraction(selection);
                          }
                        });
                    }}
                    type="button"
                  >
                    선택에서 인물 후보 추출
                  </button>
                  {characters.characterWorkspaceSelection !== null && (
                    <p>
                      {characters.characterWorkspaceSelection.documentTitle} ·{
                        " "
                      }
                      {characters.characterWorkspaceSelection.from.toLocaleString()}–
                      {characters.characterWorkspaceSelection.to.toLocaleString()}
                    </p>
                  )}
                  {characters.characterExtractionPermissionRequired && (
                    <button
                      className="create-event-button"
                      disabled={
                        characters.characterExtractionActionState !== "idle"
                      }
                      onClick={() => {
                        void characters.grantCharacterExtractionPermission();
                      }}
                      type="button"
                    >
                      이번 선택 전송 허용
                    </button>
                  )}
                </section>
                <section
                  aria-label="별빛 후보 만들기"
                  className="character-manager-rail lore-candidate-rail"
                >
                  <header>
                    <h4>별빛 후보</h4>
                    <span>
                      {
                        input.projections.activeLoreCandidates.filter(
                          (candidate) => candidate.status === "pending",
                        ).length
                      }
                    </span>
                  </header>
                  <button
                    className="create-event-button lore-candidate-open-button"
                    disabled={lore.loreCandidateActionState !== "idle"}
                    onClick={() => {
                      void lore.openLoreCandidateDialog();
                    }}
                    type="button"
                  >
                    현재 선택으로 후보 만들기
                  </button>
                  <p>
                    {input.hasManuscriptSelection
                      ? "선택 범위를 근거로 승인 전 후보를 만듭니다."
                      : "먼저 원고에서 근거 범위를 선택하세요."}
                  </p>
                </section>
                <section
                  aria-label="조수 접근 권한"
                  className="character-manager-rail assistant-context-rail"
                >
                  <header>
                    <h4>조수 권한</h4>
                    <span>{assistant.activeAssistantGrantCount}</span>
                  </header>
                  <button
                    className="create-event-button assistant-context-open-button"
                    onClick={() => {
                      void assistant.openAssistantContextDialog();
                    }}
                    type="button"
                  >
                    권한·접근 기록 열기
                  </button>
                </section>
                <button
                  className="create-event-button"
                  onClick={input.commands.openCandidateInbox}
                  type="button"
                >
                  후보 검토함 열기
                </button>
                {(characters.characterExtractionActionError ??
                  characters.characterGenerationActionError) !== null && (
                  <p className="event-action-error" role="alert">
                    {characters.characterExtractionActionError ??
                      characters.characterGenerationActionError}
                  </p>
                )}
              </div>
              <div
                className="review-inspector-section-stack"
                hidden={reviewInspectorTab !== "work"}
              >
                <section
                  aria-label="별빛 검토함"
                  className="character-manager-rail lore-candidate-rail"
                >
                  <header>
                    <h4>별빛 검토함</h4>
                    <span>
                      {
                        input.projections.activeLoreCandidates.filter(
                          (candidate) => candidate.status === "pending",
                        ).length
                      }
                    </span>
                  </header>
                  <button
                    className="create-event-button lore-candidate-open-button"
                    disabled={lore.loreCandidateActionState !== "idle"}
                    onClick={() => {
                      void lore.openLoreCandidateDialog();
                    }}
                    type="button"
                  >
                    별빛 후보 검토하기
                  </button>
                  <p>
                    {input.hasManuscriptSelection
                      ? "현재 선택으로 승인 전 후보를 만들 수 있습니다."
                      : "원문 근거와 승인·거절 기록을 확인합니다."}
                  </p>
                </section>
                {lore.loreCandidateActionError !== null &&
                  !lore.loreCandidateDialogOpen && (
                    <p className="event-action-error" role="alert">
                      {lore.loreCandidateActionError}
                    </p>
                  )}
                <section
                  aria-label="조수 접근 권한"
                  className="character-manager-rail assistant-context-rail"
                >
                  <header>
                    <h4>조수 권한</h4>
                    <span>{assistant.activeAssistantGrantCount}</span>
                  </header>
                  <button
                    className="create-event-button assistant-context-open-button"
                    onClick={() => {
                      void assistant.openAssistantContextDialog();
                    }}
                    type="button"
                  >
                    권한·접근 기록 열기
                  </button>
                  <p>기능별 읽기·전송 범위와 기간을 승인하고 철회합니다.</p>
                </section>
                <section aria-label="작품 파편" className="fragment-shelf-rail">
                  <header>
                    <h4>파편</h4>
                    <span>{fragments.fragments.length}</span>
                  </header>
                  <button
                    className="create-event-button fragment-shelf-open-button"
                    onClick={fragments.openFragmentShelf}
                    type="button"
                  >
                    파편 서랍 열기
                  </button>
                  <p>
                    {input.hasManuscriptSelection
                      ? "현재 선택을 그대로 복사할 수 있습니다."
                      : "원고를 선택하면 새 파편으로 복사할 수 있습니다."}
                  </p>
                </section>
                {fragments.fragmentActionError !== null &&
                  !fragments.fragmentDialogOpen && (
                    <p className="event-action-error" role="alert">
                      {fragments.fragmentActionError}
                    </p>
                  )}
                <section
                  aria-label="작품 복선"
                  className="foreshadow-line-rail"
                >
                  <header>
                    <h4>복선</h4>
                    <span>{foreshadow.foreshadowLines.length}</span>
                  </header>
                  <button
                    className="create-event-button foreshadow-line-open-button"
                    onClick={foreshadow.openForeshadowDialog}
                    type="button"
                  >
                    복선 라인 열기
                  </button>
                  <p>
                    {input.hasManuscriptSelection
                      ? "현재 선택을 복선 지점으로 연결할 수 있습니다."
                      : "복선 이름·메모와 연결된 원고 지점을 관리합니다."}
                  </p>
                </section>
                {foreshadow.foreshadowLineActionError !== null &&
                  !foreshadow.foreshadowLineDialogOpen && (
                    <p className="event-action-error" role="alert">
                      {foreshadow.foreshadowLineActionError}
                    </p>
                  )}
                <section aria-label="작품 인물" className="character-manager-rail">
                  <header>
                    <h4>인물</h4>
                    <span>{input.projections.activeCharacters.length}</span>
                  </header>
                  <button
                    className="create-event-button character-manager-open-button"
                    onClick={() => {
                      characters.openCharacterDialog();
                    }}
                    type="button"
                  >
                    인물 관리 열기
                  </button>
                  <p>이름·역할·요약·작가 메모를 관리합니다.</p>
                </section>
                {characters.characterActionError !== null &&
                  !characters.characterDialogOpen && (
                    <p className="event-action-error" role="alert">
                      {characters.characterActionError}
                    </p>
                  )}
                <section
                  aria-label="작품 플롯"
                  className="character-manager-rail plot-manager-rail"
                >
                  <header>
                    <h4>플롯</h4>
                    <span>{input.projections.activePlots.length}</span>
                  </header>
                  <button
                    className="create-event-button plot-manager-open-button"
                    onClick={plotState.openPlotManagementDialog}
                    type="button"
                  >
                    플롯 관리 열기
                  </button>
                  <p>제목·단계·요약·작가 메모를 관리합니다.</p>
                </section>
                {plotState.plotActionError !== null &&
                  !plotState.plotDialogOpen && (
                    <p className="event-action-error" role="alert">
                      {plotState.plotActionError}
                    </p>
                  )}
                <section
                  aria-label="작품 구조"
                  className="character-manager-rail work-structure-rail"
                >
                  <header>
                    <h4>작품 구조</h4>
                    <span>
                      {input.projections.workStructureOverview?.totals.documents ??
                        0}
                    </span>
                  </header>
                  <button
                    className="create-event-button work-structure-open-button"
                    disabled={
                      input.projections.workStructureOverview === null ||
                      workStructure.workStructureActionState !== "idle"
                    }
                    onClick={workStructure.openWorkStructureDialog}
                    type="button"
                  >
                    작품 구조 열기
                  </button>
                  <p>회차·인물·플롯·사건·장면을 한 화면에서 봅니다.</p>
                </section>
              </div>
              <div
                className="review-inspector-section-stack"
                hidden={reviewInspectorTab !== "current"}
              >
                <div className="document-quick-actions">
                  <CreateEventBlockButton
                    busy={eventState.eventActionState !== "idle"}
                    onClick={event.openEventBlockDialog}
                    telemetryStore={input.telemetryStore}
                  />
                  <button
                    className="create-event-button fragment-shelf-open-button"
                    onClick={fragments.openFragmentShelf}
                    type="button"
                  >
                    파편 서랍 열기
                  </button>
                  <button
                    className="create-event-button scene-extraction-open-button"
                    disabled={
                      !input.hasManuscriptSelection ||
                      sceneState.sceneExtractionActionState !== "idle"
                    }
                    onClick={() => {
                      void input.commands
                        .openPlotWorkspace("scenes")
                        .then((selection) => {
                          if (selection !== null) {
                            void scene.performSceneExtraction(selection);
                          }
                        });
                    }}
                    type="button"
                  >
                    선택에서 장면 분석
                  </button>
                  <button
                    className="create-event-button"
                    disabled={
                      eventState.eventActionState !== "idle" ||
                      input.activeWork === null
                    }
                    onClick={event.openAnchorlessEventDialog}
                    type="button"
                  >
                    예정 사건 추가
                  </button>
                  <button
                    className="create-event-button create-scene-button"
                    disabled={sceneState.sceneActionState !== "idle"}
                    onClick={() => {
                      void scene.createSceneBoundary();
                    }}
                    type="button"
                  >
                    {sceneState.sceneActionState === "creating"
                      ? "장면 저장 중"
                      : "장면 추가"}
                  </button>
                </div>
                {eventState.eventActionError !== null && (
                  <p className="event-action-error" role="alert">
                    {eventState.eventActionError}
                  </p>
                )}
                {sceneState.sceneActionError !== null && (
                  <p className="event-action-error" role="alert">
                    {sceneState.sceneActionError}
                  </p>
                )}
                {music.sceneMusicQueueError !== null && (
                  <p className="event-action-error" role="alert">
                    {music.sceneMusicQueueError}
                  </p>
                )}
              </div>
              <div
                className="review-inspector-section-stack"
                hidden={reviewInspectorTab !== "versions"}
              >
                <section
                  aria-label="문서 버전"
                  className="event-block-list version-history-list"
                >
                  <header>
                    <h4>문서 버전</h4>
                    <button
                      className="version-refresh-button"
                      disabled={version.versionActionState !== "idle"}
                      onClick={() => {
                        void version.refreshStoredVersions();
                      }}
                      type="button"
                    >
                      {version.versionActionState === "refreshing"
                        ? "확인 중"
                        : "새로고침"}
                    </button>
                  </header>
                  {version.documentRevisions.length === 0 ? (
                    <p className="empty-event-list">
                      저장된 문서 버전이 없습니다.
                    </p>
                  ) : (
                    <ul>
                      {version.documentRevisions.map((revision) => (
                        <li key={revision.revisionId}>
                          <div className="version-history-entry">
                            <strong>
                              {revision.isCurrent
                                ? "현재 버전"
                                : formatVersionTimestamp(revision.createdAt)}
                            </strong>
                            <span>{revision.length}자</span>
                            {!revision.isCurrent && (
                              <button
                                aria-label={`${formatVersionTimestamp(
                                  revision.createdAt,
                                )} 버전으로 복원`}
                                disabled={version.versionActionState !== "idle"}
                                onClick={() => {
                                  void version.restoreDocumentRevision(
                                    revision.revisionId,
                                  );
                                }}
                                type="button"
                              >
                                복원
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section
                  aria-label="명명된 기준점 슬롯"
                  className="event-block-list work-snapshot-list"
                >
                  <header>
                    <h4>명명된 기준점 슬롯</h4>
                    <span>{version.workSnapshotSlots.length}</span>
                  </header>
                  <form
                    className="work-snapshot-form"
                    onSubmit={version.createWorkSnapshot}
                  >
                    <label>
                      <span className="visually-hidden">기준점 슬롯 이름</span>
                      <input
                        aria-label="기준점 슬롯 이름"
                        disabled={version.versionActionState !== "idle"}
                        onChange={(event) =>
                          version.changeSnapshotLabel(event.currentTarget.value)
                        }
                        type="text"
                        value={version.snapshotLabel}
                      />
                    </label>
                    <button
                      disabled={
                        version.snapshotLabel.trim().length === 0 ||
                        version.versionActionState !== "idle"
                      }
                      type="submit"
                    >
                      {version.versionActionState === "creating-snapshot"
                        ? "생성 중"
                        : "이 슬롯에 기준점 만들기"}
                    </button>
                  </form>
                  {version.workSnapshotSlots.length === 0 ? (
                    <p className="empty-event-list">
                      만든 기준점 슬롯이 없습니다.
                    </p>
                  ) : (
                    <ul>
                      {version.workSnapshotSlots.map((slot) => (
                        <li key={slot.slotName}>
                          <div
                            className="work-snapshot-entry"
                            data-testid="work-snapshot-entry"
                          >
                            <strong>{slot.slotName}</strong>
                            <span>
                              {formatVersionTimestamp(slot.current.createdAt)} · 문서{
                                " "
                              }
                              {slot.current.documentRevisions.length}개
                            </span>
                            <button
                              aria-label={`${slot.slotName} 현재 기준점 비교`}
                              disabled={version.versionActionState !== "idle"}
                              onClick={() => {
                                void version.compareWorkSnapshot(
                                  slot.current.workSnapshotId,
                                );
                              }}
                              type="button"
                            >
                              비교
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {version.versionActionError !== null && (
                  <p className="event-action-error" role="alert">
                    {version.versionActionError}
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}
      {input.ready &&
        activeDocument !== null &&
        showsManuscript &&
        input.rightRail?.reentryVisible && (
          <button
            aria-controls={input.ids.rail}
            aria-label="검토 레일 열기"
            className="rail-reentry rail-reentry-right"
            onClick={input.commands.toggleRightRail}
            title="검토"
            type="button"
          >
            {input.embedded ? (
              <PanelRightOpen aria-hidden="true" size={17} />
            ) : (
              "검토"
            )}
          </button>
        )}
    </>
  );
}
