import { useSyncExternalStore } from "react";

import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import { PomodoroPhaseAlert } from "../../activity/PomodoroPhaseAlert";
import type { useActivityController } from "../../features/activity/useActivityController";
import { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";
import { DocumentCompletionControl } from "../DocumentCompletionControl";
import { WorkHeader } from "../WorkHeader";
import { RenameTitleForm } from "../documents/DocumentControls";
import type { useDocumentCompletionController } from "../documents/useDocumentCompletionController";
import type { WorkspaceRecoveryApplyState } from "../session/workspace-session-state";
import type { WorkspaceRuntimeState } from "../session/workspace-session-state";
import type { useWorkspaceNavigationState } from "../navigation/useWorkspaceNavigationController";
import type { useScheduleController } from "../../features/schedule/useScheduleController";
import type { WorkSection } from "../../navigation/studio-location";

function ManuscriptCount(input: {
  readonly telemetryStore: ManuscriptTelemetryStore;
}) {
  const statistics = useSyncExternalStore(
    input.telemetryStore.subscribeStatistics,
    input.telemetryStore.getStatisticsSnapshot,
  );
  const hasSelection = useSyncExternalStore(
    input.telemetryStore.subscribeSelection,
    input.telemetryStore.getSelectionSnapshot,
  );
  return (
    <p aria-live="polite" className="manuscript-count">
      <span className="character-count">
        <span>공백 포함 </span>
        <output data-testid="manuscript-character-count">
          {statistics.characterCount}
        </output>
        <span>자</span>
      </span>
      <span aria-hidden="true">·</span>
      <span className="character-count">
        <span>공백 제외 </span>
        <output data-testid="manuscript-character-count-without-whitespace">
          {statistics.characterCountWithoutWhitespace}
        </output>
        <span>자</span>
      </span>
      {hasSelection && (
        <span
          className="selection-count"
          data-testid="manuscript-selection-active"
        >
          <span aria-hidden="true">·</span>
          <span>선택됨</span>
        </span>
      )}
    </p>
  );
}

export function WorkspaceHeaderRecoveryHost(input: Readonly<{
  activeDocumentLabel: string | null;
  activeDocumentSummary: WorkspaceWorkSummary["documents"][number] | null;
  activeWork: WorkspaceWorkSummary | null;
  activeWorkId: WorkspaceWorkSummary["workId"] | null;
  commands: Readonly<{
    cancelWorkTitleEdit: () => void;
    changeSection: (section: WorkSection) => void;
    changeTitleEditValue: (value: string) => void;
    onReturnToWorks: (() => void) | undefined;
    renameActiveWork: () => Promise<unknown>;
    returnToPreviousWorkLocation: () => void;
  }>;
  controllers: Readonly<{
    activity: ReturnType<typeof useActivityController>;
    completion: ReturnType<typeof useDocumentCompletionController>;
    schedule: ReturnType<typeof useScheduleController>;
  }>;
  embedded: boolean;
  navigationDisabled: boolean;
  recovery: Readonly<{
    apply: () => unknown;
    applyState: WorkspaceRecoveryApplyState;
    headingId: string;
  }>;
  runtime: WorkspaceRuntimeState;
  schedule: Parameters<typeof WorkHeader>[0]["schedule"];
  telemetryStore: ManuscriptTelemetryStore;
  titleEdit: Readonly<{
    target: string | null;
    value: string;
  }>;
  workReturnLocation: ReturnType<
    typeof useWorkspaceNavigationState
  >["workReturnLocation"];
  workSection: WorkSection;
  workspaceActionState: string;
}>) {
  const activity = input.controllers.activity;
  const completion = input.controllers.completion;
  const scheduleController = input.controllers.schedule;
  const readyRuntime = input.runtime.status === "ready" ? input.runtime : null;

  return (
    <>
      {activity.pomodoroPhaseAlert !== null &&
        activity.pomodoroPhaseAlert.workId === input.activeWorkId && (
          <PomodoroPhaseAlert
            alert={activity.pomodoroPhaseAlert}
            key={activity.pomodoroPhaseAlert.alertId}
            onDismiss={activity.dismissPomodoroPhaseAlert}
          />
        )}
      {input.embedded ? (
        <WorkHeader
          actions={(
            <>
              {input.workSection === "write" && (
                <>
                  {input.activeDocumentSummary !== null && (
                    <DocumentCompletionControl
                      busy={input.workspaceActionState !== "idle"}
                      completion={input.activeDocumentSummary.completion}
                      onClear={() => {
                        void completion.clearActiveDocumentCompletion();
                      }}
                      onComplete={() => {
                        void completion.completeActiveDocument();
                      }}
                      onOpenCompletedRevision={
                        completion.openActiveDocumentCompletedRevision
                      }
                    />
                  )}
                  <ManuscriptCount telemetryStore={input.telemetryStore} />
                </>
              )}
              <p
                aria-label="작업공간 상태"
                className="runtime-status runtime-status-embedded"
                data-runtime-status={input.runtime.status}
                data-testid="runtime-status"
              >
                <span aria-hidden="true" className="runtime-dot" />
              </p>
            </>
          )}
          activeSection={input.workSection}
          heading={
            input.workSection === "write"
              ? (input.activeDocumentLabel ?? "원고")
              : input.workSection === "structure"
                ? "구조"
                : input.workSection === "canon"
                  ? "별빛"
                  : input.workSection === "review"
                    ? "검토"
                    : "운영"
          }
          headingTestId={
            input.workSection === "write" ? "manuscript-title" : undefined
          }
          navigationDisabled={input.navigationDisabled}
          onBack={() => input.commands.onReturnToWorks?.()}
          onOpenSchedule={scheduleController.openSchedule}
          onSectionChange={input.commands.changeSection}
          returnAction={
            input.workSection === "write" && input.workReturnLocation !== null
              ? {
                  label:
                    input.workReturnLocation.section === "review"
                      ? "검토로 돌아가기"
                      : input.workReturnLocation.section === "canon"
                        ? "별빛으로 돌아가기"
                        : "구조로 돌아가기",
                  onClick: input.commands.returnToPreviousWorkLocation,
                }
              : undefined
          }
          schedule={input.schedule}
          titleEditor={
            input.titleEdit.target === "work" ? (
              <RenameTitleForm
                itemLabel="작품"
                onCancel={input.commands.cancelWorkTitleEdit}
                onChange={input.commands.changeTitleEditValue}
                onSubmit={() => {
                  void input.commands.renameActiveWork().catch(() => undefined);
                }}
                submitting={input.workspaceActionState === "renaming-work"}
                value={input.titleEdit.value}
              />
            ) : undefined
          }
          workTitle={input.activeWork?.title ?? "쓰기"}
        />
      ) : (
        <header className="manuscript-header">
          <div className="manuscript-title-block">
            <p className="manuscript-context">로컬 편집 표면</p>
            <h2 id="manuscript-heading">원고</h2>
          </div>
          <div className="manuscript-tools">
            <ManuscriptCount telemetryStore={input.telemetryStore} />
          </div>
        </header>
      )}
      {readyRuntime !== null &&
        readyRuntime.startupRecovery.status !== "clean" && (
          <section
            aria-labelledby={input.recovery.headingId}
            className="startup-recovery"
            data-recovery-status={readyRuntime.startupRecovery.status}
          >
            <header>
              <h3 id={input.recovery.headingId}>
                {readyRuntime.startupRecovery.status === "recovery-pending"
                  ? "복구 미리보기"
                  : "복구 확인 필요"}
              </h3>
            </header>
            {readyRuntime.startupRecovery.status === "recovery-pending" && (
              <div className="startup-recovery-documents">
                {readyRuntime.startupRecovery.candidate.affectedDocuments.map(
                  (document) => {
                    const source = readyRuntime.documentProfile.documents.find(
                      (candidate) =>
                        candidate.documentId === document.documentId,
                    );
                    return (
                      <label key={document.documentId}>
                        <span>
                          {source?.label}
                          <code>{document.documentId}</code>
                        </span>
                        <textarea
                          data-testid="recovery-preview"
                          readOnly
                          value={document.recoveredText}
                        />
                      </label>
                    );
                  },
                )}
              </div>
            )}
            {readyRuntime.startupRecovery.issues.length > 0 && (
              <ul className="startup-recovery-issues">
                {readyRuntime.startupRecovery.issues.map((issue, index) => (
                  <li key={`${issue.source}:${index}`}>
                    <code>{issue.source}</code>
                    <span>{issue.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            {readyRuntime.startupRecovery.status === "recovery-pending" &&
              readyRuntime.startupRecovery.applyAvailable && (
                <button
                  disabled={input.recovery.applyState === "applying"}
                  onClick={() => {
                    void input.recovery.apply();
                  }}
                  type="button"
                >
                  {input.recovery.applyState === "applying"
                    ? "복구 적용 중"
                    : "복구 적용"}
                </button>
              )}
            {input.recovery.applyState === "failed" && (
              <p role="alert">복구 적용 실패</p>
            )}
          </section>
        )}
    </>
  );
}
