import type { ComponentProps, ReactNode } from "react";

import type { CharacterProjection } from "../../../application/characters/character-contract";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { ForeshadowLineProjection } from "../../../application/foreshadowing/foreshadow-line-contract";
import type { ForeshadowPointProfile } from "../../../application/foreshadowing/foreshadow-point-contract";
import type { FragmentShelfProfile } from "../../../application/fragments/fragment-contract";
import type { LoreCandidateProjection } from "../../../application/lore/lore-candidate-contract";
import type { LoreEntryProjection } from "../../../application/lore/lore-entry-contract";
import type { LoreForeshadowLinkProjection } from "../../../application/lore/lore-foreshadow-link-contract";
import type { PlotBoardProjection } from "../../../application/plots/plot-board-contract";
import type { PlotEventLinkProjection } from "../../../application/plots/plot-event-link-contract";
import type { PlotThreadProjection } from "../../../application/plots/plot-contract";
import type { PlotThreadSourceProjection } from "../../../application/plots/plot-source-contract";
import type { EventBlockProjection } from "../../../application/structure/event-block-contract";
import type { WorkStructureOverviewProjection } from "../../../application/structure/work-structure-overview";
import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import { CharacterManagerDialog } from "../../editor/CharacterManagerDialog";
import { ForeshadowLineDialog } from "../../editor/ForeshadowLineDialog";
import { FragmentShelfDialog } from "../../editor/FragmentShelfDialog";
import { LoreCandidateDialog } from "../../editor/LoreCandidateDialog";
import { LoreManagerDialog } from "../../editor/LoreManagerDialog";
import { PlotManagerDialog } from "../../editor/PlotManagerDialog";
import { WorkStructureDialog } from "../../editor/WorkStructureDialog";
import type { useCharactersController } from "../../features/characters/useCharactersController";
import type { useForeshadowController } from "../../features/foreshadow/useForeshadowController";
import type { useFragmentsController } from "../../features/fragments/useFragmentsController";
import type {
  LoreCandidateDraftInput,
  LoreEntryDraftInput,
} from "../../features/lore/lore-client";
import type { useLoreController } from "../../features/lore/useLoreController";
import type { usePlotWorkspaceController } from "../../features/structure/usePlotWorkspaceController";
import type { PlotWorkspaceState } from "../../features/structure/usePlotWorkspaceController";
import type { useWorkStructureState } from "../structure/useWorkStructureState";

type SourceAvailability = Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  hasManuscriptSelection: boolean;
}>;

type RuntimeProfiles =
  | Readonly<{ ready: false }>
  | Readonly<{
      ready: true;
      foreshadowPointProfile: ForeshadowPointProfile;
      fragmentProfile: FragmentShelfProfile;
    }>;

export function WorkspaceFeatureDialogHost(input: Readonly<{
  activeWork: WorkspaceWorkSummary | null;
  characters: Readonly<{
    activeCharacters: readonly CharacterProjection[];
    controller: ReturnType<typeof useCharactersController>;
    selectedCharacterId: string | null;
  }>;
  documentLabels: Readonly<Record<string, string>>;
  foreshadow: Readonly<{
    capturePoint: (lineId: string, roleId: string, note: string) => unknown;
    controller: ReturnType<typeof useForeshadowController>;
    linkLore: (
      line: ForeshadowLineProjection,
      loreEntryId: string,
    ) => unknown;
    loreEntries: readonly LoreEntryProjection[];
    loreLinks: readonly LoreForeshadowLinkProjection[];
    openPoint: (
      point: ReturnType<
        typeof useForeshadowController
      >["foreshadowPoints"][number],
    ) => unknown;
    unlinkLore: (link: LoreForeshadowLinkProjection) => unknown;
  }>;
  fragments: Readonly<{
    capture: (kindId: string) => unknown;
    controller: ReturnType<typeof useFragmentsController>;
    insert: (fragment: ReturnType<typeof useFragmentsController>["fragments"][number]) => unknown;
    move: (kindId: string) => unknown;
    openSource: (fragment: ReturnType<typeof useFragmentsController>["fragments"][number]) => unknown;
  }>;
  lore: Readonly<{
    activeCandidates: readonly LoreCandidateProjection[];
    activeEntries: readonly LoreEntryProjection[];
    activeLinks: readonly LoreForeshadowLinkProjection[];
    addEvidence: (entry: LoreEntryProjection) => unknown;
    controller: ReturnType<typeof useLoreController>;
    createCandidate: (draft: LoreCandidateDraftInput) => unknown;
    createEntry: (draft: LoreEntryDraftInput) => unknown;
    foreshadowLines: readonly ForeshadowLineProjection[];
    linkForeshadow: (
      entry: LoreEntryProjection,
      line: ForeshadowLineProjection,
    ) => unknown;
    openCandidateEvidence: (candidate: LoreCandidateProjection) => unknown;
    openEvidence: (evidence: LoreEntryProjection["evidences"][number]) => unknown;
    selectedLoreEntryId: string | null;
    unlinkForeshadow: (link: LoreForeshadowLinkProjection) => unknown;
  }>;
  plot: Readonly<{
    activeEventBlocks: readonly EventBlockProjection[];
    activeEventLinks: readonly PlotEventLinkProjection[];
    activePlots: readonly PlotThreadProjection[];
    activeSources: readonly PlotThreadSourceProjection[];
    controller: ReturnType<typeof usePlotWorkspaceController>;
    openSource: (source: PlotThreadSourceProjection) => unknown;
    plotBoard: PlotBoardProjection | null;
    sceneDraft: ReactNode;
    state: PlotWorkspaceState;
  }>;
  runtime: RuntimeProfiles;
  source: SourceAvailability;
  workStructure: Readonly<{
    loreEntryCount: number;
    navigation: Pick<
      ComponentProps<typeof WorkStructureDialog>,
      | "onOpenCharacter"
      | "onOpenDocument"
      | "onOpenEvent"
      | "onOpenLore"
      | "onOpenPlot"
      | "onOpenPlotSource"
      | "onOpenScene"
    >;
    projection: WorkStructureOverviewProjection | null;
    state: ReturnType<typeof useWorkStructureState>;
  }>;
}>) {
  const activeWork = input.activeWork;
  const source = input.source;

  return (
    <>
      {input.runtime.ready &&
        input.workStructure.projection !== null &&
        input.workStructure.state.workStructureDialogOpen && (
          <WorkStructureDialog
            busy={
              input.workStructure.state.workStructureActionState !== "idle"
            }
            error={input.workStructure.state.workStructureActionError}
            loreEntryCount={input.workStructure.loreEntryCount}
            onClose={input.workStructure.state.closeWorkStructureDialog}
            {...input.workStructure.navigation}
            projection={input.workStructure.projection}
          />
        )}
      {input.runtime.ready &&
        activeWork !== null &&
        input.lore.controller.loreCandidateDialogOpen && (
          <LoreCandidateDialog
            actionState={input.lore.controller.loreCandidateActionState}
            canCapture={
              source.activeDocument !== null && source.hasManuscriptSelection
            }
            candidates={input.lore.activeCandidates}
            documentLabels={input.documentLabels}
            entries={input.lore.activeEntries}
            error={input.lore.controller.loreCandidateActionError}
            onApprove={(candidate) => {
              void input.lore.controller.approveLoreCandidate(candidate);
            }}
            onClose={input.lore.controller.closeLoreCandidateDialog}
            onCreate={(draft) => {
              void input.lore.createCandidate(draft);
            }}
            onOpenEvidence={(candidate) => {
              void input.lore.openCandidateEvidence(candidate);
            }}
            onReject={(candidate) => {
              void input.lore.controller.rejectLoreCandidate(candidate);
            }}
          />
        )}
      {input.runtime.ready &&
        activeWork !== null &&
        input.lore.controller.loreDialogOpen && (
          <LoreManagerDialog
            actionState={input.lore.controller.loreActionState}
            canCaptureEvidence={
              source.activeDocument !== null && source.hasManuscriptSelection
            }
            documentLabels={input.documentLabels}
            entries={input.lore.activeEntries}
            error={input.lore.controller.loreActionError}
            foreshadowLines={input.lore.foreshadowLines}
            loreForeshadowLinks={input.lore.activeLinks}
            onAddEvidence={(entry) => {
              void input.lore.addEvidence(entry);
            }}
            onClose={input.lore.controller.closeLoreDialog}
            onCreate={(draft) => {
              void input.lore.createEntry(draft);
            }}
            onOpenEvidence={(evidence) => {
              void input.lore.openEvidence(evidence);
            }}
            onLinkForeshadow={(entry, lineId) => {
              const line = input.lore.foreshadowLines.find(
                (candidate) => candidate.lineId === lineId,
              );
              if (line !== undefined) {
                void input.lore.linkForeshadow(entry, line);
              }
            }}
            onRetire={(entry) => {
              void input.lore.controller.retireLoreEntry(entry);
            }}
            onSelect={input.lore.controller.selectLoreEntry}
            onUpdate={(entry, changes) => {
              void input.lore.controller.updateLoreEntry(entry, changes);
            }}
            onUnlinkForeshadow={(link) => {
              void input.lore.unlinkForeshadow(link);
            }}
            selectedLoreEntryId={input.lore.selectedLoreEntryId}
          />
        )}
      {input.runtime.ready &&
        activeWork !== null &&
        input.characters.controller.characterDialogOpen && (
          <CharacterManagerDialog
            actionState={input.characters.controller.characterActionState}
            characters={input.characters.activeCharacters}
            error={input.characters.controller.characterActionError}
            onClose={input.characters.controller.closeCharacterDialog}
            onCreate={(draft) => {
              void input.characters.controller.createCharacter(draft);
            }}
            onRetire={(character) => {
              void input.characters.controller.retireCharacter(character);
            }}
            onSelect={input.characters.controller.selectCharacter}
            onUpdate={(character, changes) => {
              void input.characters.controller.updateCharacter(
                character,
                changes,
              );
            }}
            selectedCharacterId={input.characters.selectedCharacterId}
          />
        )}
      {input.runtime.ready &&
        activeWork !== null &&
        input.plot.state.plotDialogOpen && (
          <PlotManagerDialog
            actionState={input.plot.state.plotActionState}
            board={input.plot.plotBoard}
            canCreateEventFromSelection={
              source.activeDocument !== null && source.hasManuscriptSelection
            }
            canLinkSource={
              source.activeDocument !== null && source.hasManuscriptSelection
            }
            documentLabels={input.documentLabels}
            error={input.plot.state.plotActionError}
            eventBlocks={input.plot.activeEventBlocks}
            eventLinks={input.plot.activeEventLinks}
            onClose={input.plot.state.closePlotManagementDialog}
            onCreate={(draft) => {
              void input.plot.controller.createPlotThread(draft);
            }}
            onCreateEvent={(plot, exactSelection) => {
              void input.plot.controller.createEventFromPlot(
                plot,
                exactSelection,
              );
            }}
            onLinkEvent={(plot, eventBlockId, role) => {
              void input.plot.controller.linkPlotEvent(
                plot,
                eventBlockId,
                role,
              );
            }}
            onRetire={(plot) => {
              void input.plot.controller.retirePlotThread(plot);
            }}
            onLinkSource={(plot) => {
              void input.plot.controller.linkPlotThreadSource(plot);
            }}
            onMovePlacement={input.plot.controller.movePlotPlacement}
            onSetStoryTime={input.plot.controller.setPlotPlacementStoryTime}
            onOpenSource={(plotSource) => {
              void input.plot.openSource(plotSource);
            }}
            onSelect={input.plot.state.selectPlot}
            onUpdate={(plot, changes) => {
              void input.plot.controller.updatePlotThread(plot, changes);
            }}
            onUnlinkEvent={(link) => {
              void input.plot.controller.unlinkPlotEvent(link);
            }}
            plots={input.plot.activePlots}
            sceneDraft={input.plot.sceneDraft}
            sources={input.plot.activeSources}
            selectedPlotThreadId={
              input.plot.controller.activeSelectedPlotThreadId
            }
          />
        )}
      {input.runtime.ready &&
        activeWork !== null &&
        input.fragments.controller.fragmentDialogOpen && (
          <FragmentShelfDialog
            actionState={input.fragments.controller.fragmentActionState}
            canCapture={
              source.activeDocument !== null && source.hasManuscriptSelection
            }
            canInsert={
              source.activeDocument !== null && !source.hasManuscriptSelection
            }
            documentLabels={input.documentLabels}
            error={input.fragments.controller.fragmentActionError}
            fragments={input.fragments.controller.fragments}
            onCapture={(kindId) => {
              void input.fragments.capture(kindId);
            }}
            onClose={input.fragments.controller.closeFragmentShelf}
            onInsert={(fragment) => {
              void input.fragments.insert(fragment);
            }}
            onMove={(kindId) => {
              void input.fragments.move(kindId);
            }}
            onOpenSource={(fragment) => {
              void input.fragments.openSource(fragment);
            }}
            onRetire={(fragment) => {
              void input.fragments.controller.retireFragment(fragment);
            }}
            onUpdate={(fragment, changes) => {
              void input.fragments.controller.updateFragment(fragment, changes);
            }}
            profile={input.runtime.fragmentProfile}
          />
        )}
      {input.runtime.ready &&
        activeWork !== null &&
        input.foreshadow.controller.foreshadowLineDialogOpen && (
          <ForeshadowLineDialog
            actionState={input.foreshadow.controller.foreshadowLineActionState}
            canCapture={
              source.activeDocument !== null && source.hasManuscriptSelection
            }
            documentLabels={input.documentLabels}
            error={input.foreshadow.controller.foreshadowLineActionError}
            lines={input.foreshadow.controller.foreshadowLines}
            loreEntries={input.foreshadow.loreEntries}
            loreForeshadowLinks={input.foreshadow.loreLinks}
            onClose={input.foreshadow.controller.closeForeshadowDialog}
            onCreate={(title, note) => {
              void input.foreshadow.controller.createForeshadowLine(
                title,
                note,
              );
            }}
            onCapture={(lineId, roleId, note) => {
              void input.foreshadow.capturePoint(lineId, roleId, note);
            }}
            onOpenPoint={(point) => {
              void input.foreshadow.openPoint(point);
            }}
            onLinkLore={(line, loreEntryId) => {
              void input.foreshadow.linkLore(line, loreEntryId);
            }}
            onRetire={(line) => {
              void input.foreshadow.controller.retireForeshadowLine(line);
            }}
            onUpdate={(line, changes) => {
              void input.foreshadow.controller.updateForeshadowLine(
                line,
                changes,
              );
            }}
            onUnlinkLore={(link) => {
              void input.foreshadow.unlinkLore(link);
            }}
            points={input.foreshadow.controller.foreshadowPoints}
            profile={input.runtime.foreshadowPointProfile}
            selectedLineId={
              input.foreshadow.controller.selectedForeshadowLineId
            }
          />
        )}
    </>
  );
}
