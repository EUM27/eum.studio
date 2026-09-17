import type { ComponentProps, ReactNode } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { WorkReadthroughEntry } from "../../../application/activity/work-readthrough-calculator";
import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import { CharacterCandidateReviewPanel } from "../../editor/CharacterWorkspace";
import { LoreCandidateContent } from "../../editor/LoreCandidateDialog";
import type { useActivityController } from "../../features/activity/useActivityController";
import type { useCharactersController } from "../../features/characters/useCharactersController";
import type { useEditorToolsController } from "../../features/editor-tools/useEditorToolsController";
import type { useLoreController } from "../../features/lore/useLoreController";
import type { useStructureController } from "../../features/structure/useStructureController";
import type { useVersionController } from "../../features/version/useVersionController";
import type { ReviewTab } from "../../navigation/studio-location";
import { CandidateInboxPanel } from "../../review/CandidateInboxPanel";
import { ManuscriptReviewPanel } from "../../review/ManuscriptReviewPanel";
import { VersionPanel } from "../../review/VersionPanel";
import { WorkRecordsPanel } from "../../review/WorkRecordsPanel";
import { WorkRecordsContent } from "../../records/WorkRecordsDialog";
import { ReviewWorkspace } from "../ReviewWorkspace";
import type { useReadingLayoutController } from "../session/useReadingLayoutController";

export function ReviewWorkspaceHost(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeTab: ReviewTab;
  activeWork: WorkspaceWorkSummary | null;
  commands: Readonly<{
    createLoreCandidate: ComponentProps<
      typeof LoreCandidateContent
    >["onCreate"];
  }>;
  controllers: Readonly<{
    activity: ReturnType<typeof useActivityController>;
    characters: ReturnType<typeof useCharactersController>;
    editorTools: ReturnType<typeof useEditorToolsController>;
    lore: ReturnType<typeof useLoreController>;
    readingLayout: ReturnType<typeof useReadingLayoutController>;
    structure: ReturnType<typeof useStructureController>;
    version: ReturnType<typeof useVersionController>;
  }>;
  documentLabels: Readonly<Record<string, string>>;
  hasManuscriptSelection: boolean;
  navigation: Readonly<{
    activateDocumentById: ComponentProps<
      typeof WorkRecordsContent
    >["onOpenDocument"];
    openLoreCandidateEvidence: ComponentProps<
      typeof LoreCandidateContent
    >["onOpenEvidence"];
    openRecordsDocument: () => void;
  }>;
  onTabChange: (tab: ReviewTab) => void;
  projections: Readonly<{
    activeCharacters: ReturnType<
      typeof useCharactersController
    >["characters"];
    activeLoreCandidates: ReturnType<
      typeof useLoreController
    >["loreCandidates"];
    activeLoreEntries: ReturnType<typeof useLoreController>["loreEntries"];
  }>;
  recordsNowMs: number;
  sceneContent: ReactNode;
}>) {
  const activity = input.controllers.activity;
  const characters = input.controllers.characters;
  const editorTools = input.controllers.editorTools;
  const lore = input.controllers.lore;
  const readingLayout = input.controllers.readingLayout;
  const structure = input.controllers.structure;
  const version = input.controllers.version;
  const workActivity = activity.workActivity;

  if (input.activeWork === null || workActivity === null) return null;

  const pendingCharacterCandidateCount = [
    ...characters.characterExtractionCandidates,
    ...characters.characterGenerationCandidates,
  ].reduce(
    (count, candidate) =>
      count + candidate.items.filter((item) => item.status === "pending").length,
    0,
  );
  const pendingSceneCandidateCount = structure.sceneExtractionCandidates.reduce(
    (count, candidate) =>
      count +
      candidate.boundaries.filter((boundary) => boundary.status === "pending")
        .length +
      candidate.scenes.filter((scene) => scene.annotationStatus === "pending")
        .length,
    0,
  );
  const pendingLoreCandidateCount = input.projections.activeLoreCandidates.filter(
    (candidate) => candidate.status === "pending",
  ).length;

  return (
    <ReviewWorkspace
      activeTab={input.activeTab}
      onTabChange={input.onTabChange}
      panels={{
        records: (
          <WorkRecordsPanel>
            <WorkRecordsContent
              activity={workActivity}
              busy={
                activity.activityActionState !== "idle" ||
                activity.recordsExportActionState !== "idle"
              }
              error={activity.activityActionError}
              exportActionState={activity.recordsExportActionState}
              exportError={activity.recordsExportError}
              exportMessage={activity.recordsExportMessage}
              goalActionState={
                activity.dailyGoals === null
                  ? "loading"
                  : activity.dailyGoalActionState
              }
              goalError={activity.dailyGoalError}
              goalSettings={activity.dailyGoals}
              nowMs={input.recordsNowMs}
              onExport={({ format, fromDate, toDate }) => {
                void activity.exportRecords({
                  format,
                  fromDate,
                  toDate,
                });
              }}
              onOpenDocument={(documentId) => {
                input.navigation.openRecordsDocument();
                input.navigation.activateDocumentById(documentId);
              }}
              onSaveGoals={(goals) => {
                void activity.saveRecordsGoals(goals);
              }}
              onSaveReadthrough={(entries: readonly WorkReadthroughEntry[]) => {
                void activity.saveReadthrough(entries);
              }}
              readthroughActionState={activity.readthroughActionState}
              readthroughError={activity.readthroughError}
              readthroughSettings={activity.readthroughSettings}
              work={input.activeWork}
            />
          </WorkRecordsPanel>
        ),
        manuscript: (
          <ManuscriptReviewPanel
            disabled={input.activeDocument === null}
            error={
              editorTools.preflightActionError ??
              readingLayout.continuousReadingOpenError ??
              editorTools.manuscriptTextImportError
            }
            onOpenAnalysis={editorTools.openManuscriptAnalysis}
            onOpenContinuousReading={() => {
              void readingLayout.openContinuousReading();
            }}
            onOpenPreflight={editorTools.openManuscriptPreflight}
          />
        ),
        candidates: (
          <CandidateInboxPanel
            counts={{
              characters: pendingCharacterCandidateCount,
              scenes: pendingSceneCandidateCount,
              lore: pendingLoreCandidateCount,
            }}
            panels={{
              characters: (
                <CharacterCandidateReviewPanel
                  busy={
                    characters.characterExtractionActionState !== "idle" ||
                    characters.characterGenerationActionState !== "idle"
                  }
                  candidates={characters.characterExtractionCandidates}
                  characters={input.projections.activeCharacters}
                  generationCandidates={characters.characterGenerationCandidates}
                  onDecideCandidate={(candidate, item, decision) => {
                    void characters.decideCharacterExtractionItem(
                      candidate,
                      item,
                      decision,
                    );
                  }}
                  onDecideGenerationCandidate={(candidate, item, decision) => {
                    void characters.decideCharacterGenerationItem(
                      candidate,
                      item,
                      decision,
                    );
                  }}
                />
              ),
              scenes: input.sceneContent,
              lore: (
                <LoreCandidateContent
                  actionState={lore.loreCandidateActionState}
                  canCapture={
                    input.activeDocument !== null &&
                    input.hasManuscriptSelection
                  }
                  candidates={input.projections.activeLoreCandidates}
                  documentLabels={input.documentLabels}
                  entries={input.projections.activeLoreEntries}
                  error={lore.loreCandidateActionError}
                  onApprove={(candidate) => {
                    void lore.approveLoreCandidate(candidate);
                  }}
                  onCreate={(draft) => {
                    void input.commands.createLoreCandidate(draft);
                  }}
                  onOpenEvidence={(candidate) => {
                    void input.navigation.openLoreCandidateEvidence(candidate);
                  }}
                  onReject={(candidate) => {
                    void lore.rejectLoreCandidate(candidate);
                  }}
                />
              ),
            }}
          />
        ),
        versions: (
          <VersionPanel
            actionState={version.versionActionState}
            documentRevisions={version.documentRevisions}
            error={version.versionActionError}
            highlightedRevisionId={version.highlightedDocumentRevisionId}
            onCompareSnapshot={(snapshotId) => {
              void version.compareWorkSnapshot(snapshotId);
            }}
            onCreateSnapshot={version.createWorkSnapshot}
            onRefresh={() => {
              void version.refreshStoredVersions();
            }}
            onRestoreRevision={(revisionId) => {
              void version.restoreDocumentRevision(revisionId);
            }}
            onSnapshotLabelChange={version.changeSnapshotLabel}
            snapshotLabel={version.snapshotLabel}
            workSnapshots={version.workSnapshots}
          />
        ),
      }}
    />
  );
}
