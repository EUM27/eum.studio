import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { ManuscriptPreflightProfile } from "../../../application/editor/manuscript-preflight";
import type { EntityId } from "../../../domain/writing";
import { DailyGoalDialog } from "../../activity/DailyGoalDialog";
import { PomodoroDialog } from "../../activity/PomodoroDialog";
import type { useActivityController } from "../../features/activity/useActivityController";
import type { useManuscriptAnnotationsController } from "../../features/annotations/useManuscriptAnnotationsController";
import type { useEditorToolsController } from "../../features/editor-tools/useEditorToolsController";
import type {
  EventWorkspaceState,
  useEventWorkspaceController,
} from "../../features/structure/useEventWorkspaceController";
import type { useVersionController } from "../../features/version/useVersionController";
import { ContinuousReadingDialog } from "../../editor/ContinuousReadingDialog";
import { ForwardWritingGoalDialog } from "../../editor/ForwardWritingMode";
import { ManuscriptAnalysisDialog } from "../../editor/ManuscriptAnalysisDialog";
import { ManuscriptBulkExportDialog } from "../../editor/ManuscriptBulkExportDialog";
import { ManuscriptPreflightDialog } from "../../editor/ManuscriptPreflightDialog";
import { ManuscriptTextImportDialog } from "../../editor/ManuscriptTextImportDialog";
import { WorkSnapshotComparisonDialog } from "../../editor/WorkSnapshotComparisonDialog";
import { DocumentRevisionPreviewDialog } from "../../review/DocumentRevisionPreviewDialog";
import type { useReadingLayoutController } from "../session/useReadingLayoutController";
import { EventBlockDialog } from "./EventBlockDialog";

export type WorkspaceDialogHostProps = Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  activity: ReturnType<typeof useActivityController>;
  annotations: ReturnType<typeof useManuscriptAnnotationsController>;
  editorTools: ReturnType<typeof useEditorToolsController>;
  eventController: ReturnType<typeof useEventWorkspaceController>;
  eventState: EventWorkspaceState;
  preflightProfile: ManuscriptPreflightProfile | null;
  readingLayout: ReturnType<typeof useReadingLayoutController>;
  version: ReturnType<typeof useVersionController>;
}>;

export function WorkspaceDialogHost(input: WorkspaceDialogHostProps) {
  const { activeDocument } = input;
  const activity = input.activity;
  const editorTools = input.editorTools;
  const eventState = input.eventState;
  const version = input.version;

  return (
    <>
      {eventState.pendingEventDraft !== null && (
        <EventBlockDialog
          draft={eventState.pendingEventDraft}
          error={eventState.eventActionError}
          onCancel={eventState.closeEventDialog}
          onSubmit={(draft) => {
            void input.eventController.createEventBlock(draft);
          }}
          submitting={eventState.eventActionState === "creating"}
        />
      )}
      {version.workSnapshotComparison !== null && (
        <WorkSnapshotComparisonDialog
          onClose={version.closeWorkSnapshotComparison}
          onToggleScene={version.toggleWorkSnapshotSceneSelection}
          projection={version.workSnapshotComparison}
          scenePlan={version.workSnapshotScenePlan}
        />
      )}
      {version.documentRevisionPreview !== null && (
        <DocumentRevisionPreviewDialog
          documentTitle={version.documentRevisionPreview.documentTitle}
          onClose={version.closeDocumentRevisionPreview}
          projection={version.documentRevisionPreview.projection}
        />
      )}
      {editorTools.showForwardWritingDialog && activeDocument !== null && (
        <ForwardWritingGoalDialog
          onCancel={editorTools.closeForwardWritingDialog}
          onStart={editorTools.startForwardWriting}
        />
      )}
      {editorTools.manuscriptAnalysis !== null && (
        <ManuscriptAnalysisDialog
          documentTitle={editorTools.manuscriptAnalysis.documentTitle}
          manuscript={editorTools.manuscriptAnalysis.manuscript}
          onClose={editorTools.closeManuscriptAnalysis}
        />
      )}
      {editorTools.pendingManuscriptBulkExport !== null && (
        <ManuscriptBulkExportDialog
          onClose={editorTools.closeManuscriptBulkExport}
          onExport={editorTools.exportManuscriptBulk}
          orderedDocuments={
            editorTools.pendingManuscriptBulkExport.orderedDocuments
          }
          workTitle={editorTools.pendingManuscriptBulkExport.workTitle}
        />
      )}
      {editorTools.manuscriptTextImport !== null && (
        <ManuscriptTextImportDialog
          applying={editorTools.manuscriptTextImportAction === "applying"}
          candidate={editorTools.manuscriptTextImport.candidate}
          currentText={editorTools.manuscriptTextImport.sourceText}
          error={editorTools.manuscriptTextImportError}
          onApply={editorTools.applyManuscriptTextImport}
          onClose={editorTools.closeManuscriptTextImport}
          stale={
            activeDocument === null ||
            editorTools.manuscriptTextImport.candidate.workId !==
              activeDocument.workId ||
            editorTools.manuscriptTextImport.candidate.documentId !==
              activeDocument.documentId ||
            editorTools.manuscriptTextImport.candidate.documentRevisionId !==
              activeDocument.documentRevisionId
          }
        />
      )}
      {activity.showFocusDialog && (
        <PomodoroDialog
          error={activity.activityActionError}
          onCancel={activity.closeFocusDialog}
          onSubmit={(focus) => {
            void activity.configureAndStartPomodoro(focus);
          }}
          settings={
            input.activeWorkId !== null &&
              activity.pomodoro?.workId === input.activeWorkId
              ? activity.pomodoro.settings
              : null
          }
          submitting={activity.activityActionState === "starting-focus"}
        />
      )}
      {activity.showDailyGoalDialog &&
        activity.workActivity !== null &&
        activity.pomodoro !== null &&
        activity.dailyGoals !== null && (
          <DailyGoalDialog
            activity={activity.workActivity}
            error={activity.dailyGoalError}
            nowMs={activity.activityClock}
            onClose={activity.closeDailyGoalDialog}
            onSave={(goals) => {
              void activity.saveDailyGoals(goals);
            }}
            pomodoro={activity.pomodoro}
            saving={activity.dailyGoalActionState === "saving"}
            settings={activity.dailyGoals}
          />
        )}
      {input.preflightProfile !== null &&
        editorTools.pendingManuscriptPreflight !== null && (
          <ManuscriptPreflightDialog
            documentLabel={
              editorTools.pendingManuscriptPreflight.document.label
            }
            manuscript={editorTools.pendingManuscriptPreflight.manuscript}
            onApply={editorTools.applyManuscriptPreflight}
            onClose={editorTools.closeManuscriptPreflight}
            onExport={editorTools.exportManuscriptPreflight}
            onSaveSettings={editorTools.saveManuscriptPreflightSettings}
            profile={input.preflightProfile}
            selection={editorTools.pendingManuscriptPreflight.selection}
            settingsProjection={
              editorTools.pendingManuscriptPreflight.settingsProjection
            }
          />
        )}
      {input.readingLayout.continuousReadingDialogState.status === "ready" && (
        <ContinuousReadingDialog
          annotations={input.annotations.annotations}
          annotationBusy={input.annotations.annotationActionState !== "idle"}
          annotationError={input.annotations.annotationActionError}
          onCreateAnnotation={input.annotations.createAnnotation}
          onClose={input.readingLayout.closeContinuousReading}
          onProgress={input.readingLayout.persistContinuousReadingLocation}
          onRetireAnnotation={input.annotations.retireAnnotation}
          onUpdateAnnotation={input.annotations.updateAnnotation}
          session={input.readingLayout.continuousReadingDialogState.session}
        />
      )}
    </>
  );
}
