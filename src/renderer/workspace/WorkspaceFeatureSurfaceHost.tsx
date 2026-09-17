import type { ComponentProps, ReactNode } from "react";

import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import type {
  CharacterDrawDraft,
  EventDrawDraft,
} from "../../application/inspiration/inspiration-draw";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import { CharacterWorkspace } from "../editor/CharacterWorkspace";
import { EventDrawTool } from "../editor/EventDrawTool";
import { PlotManagerDialog } from "../editor/PlotManagerDialog";
import { PlotWorkspace } from "../editor/PlotWorkspace";
import type { useCharactersController } from "../features/characters/useCharactersController";
import type { useInspirationController } from "../features/inspiration/useInspirationController";
import type { useMusicController } from "../features/music/useMusicController";
import type {
  usePlotWorkspaceController,
  usePlotWorkspaceState,
} from "../features/structure/usePlotWorkspaceController";
import type {
  useSceneWorkspaceController,
  useSceneWorkspaceState,
} from "../features/structure/useSceneWorkspaceController";
import type { useStructureController } from "../features/structure/useStructureController";
import {
  SceneStructureContent,
  type SceneStructureContentProps,
} from "../features/structure/StructureWorkspaceHost";

export function WorkspaceFeatureSurfaceHost(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWork: WorkspaceWorkSummary | null;
  controllers: Readonly<{
    characters: ReturnType<typeof useCharactersController>;
    inspiration: ReturnType<typeof useInspirationController>;
    music: ReturnType<typeof useMusicController>;
    plot: ReturnType<typeof usePlotWorkspaceController>;
    plotState: ReturnType<typeof usePlotWorkspaceState>;
    scene: ReturnType<typeof useSceneWorkspaceController>;
    sceneState: ReturnType<typeof useSceneWorkspaceState>;
    structure: ReturnType<typeof useStructureController>;
  }>;
  documentLabels: Readonly<Record<string, string>>;
  hasManuscriptSelection: boolean;
  musicConnected: boolean;
  navigation: Readonly<{
    focusScene: SceneStructureContentProps["navigation"]["focusScene"];
    openCharacterEvidence: ComponentProps<
      typeof CharacterWorkspace
    >["onOpenEvidence"];
    openPlotThreadSource: ComponentProps<
      typeof PlotManagerDialog
    >["onOpenSource"];
    previewSceneExtractionCandidate: SceneStructureContentProps["navigation"]["previewSceneExtractionCandidate"];
  }>;
  oauthStatus: ComponentProps<typeof CharacterWorkspace>["oauthStatus"];
  onOpenSettings: (() => void) | undefined;
  projections: Readonly<{
    activeCharacterRelations: ReturnType<
      typeof useCharactersController
    >["characterRelations"];
    activeCharacters: ReturnType<
      typeof useCharactersController
    >["characters"];
    activeEventBlocks: ReturnType<
      typeof useStructureController
    >["eventBlocks"];
    activePlotEventLinks: ReturnType<
      typeof useStructureController
    >["plotEventLinks"];
    activePlots: ReturnType<typeof useStructureController>["plots"];
    activePlotSources: ReturnType<
      typeof useStructureController
    >["plotSources"];
    activeSelectedCharacterId: string | null;
    activeSelectedPlotThreadId: string | null;
  }>;
  ready: boolean;
  sceneDraft: ReactNode;
  workSection: string;
  workspaceSurface: string;
}>) {
  if (!input.ready || input.activeWork === null) return null;

  const characters = input.controllers.characters;
  const inspiration = input.controllers.inspiration;
  const plot = input.controllers.plot;
  const plotState = input.controllers.plotState;
  const structure = input.controllers.structure;
  const canUseSelection =
    input.activeDocument !== null && input.hasManuscriptSelection;

  const characterSurface =
    input.workspaceSurface === "characters" && input.workSection !== "structure" ? (
      <CharacterWorkspace
        actionState={characters.characterActionState}
        candidates={characters.characterExtractionCandidates}
        characters={input.projections.activeCharacters}
        error={characters.characterActionError ?? inspiration.inspirationActionError}
        extractionActionState={characters.characterExtractionActionState}
        extractionError={characters.characterExtractionActionError}
        generationActionState={characters.characterGenerationActionState}
        generationCandidates={characters.characterGenerationCandidates}
        generationError={characters.characterGenerationActionError}
        inspirationBusy={
          inspiration.inspirationActionState !== "idle" ||
          inspiration.workInspirationSettings === null
        }
        inspirationKeywords={
          inspiration.workInspirationSettings?.settings.characterKeywords ?? []
        }
        oauthStatus={input.oauthStatus}
        relationActionState={characters.characterRelationActionState}
        relations={input.projections.activeCharacterRelations}
        onAddEvidence={(character) => {
          void characters.addCharacterEvidence(character);
        }}
        onAddInspirationKeywords={inspiration.addCharacterInspirationKeywords}
        onCreate={(draft) => {
          void characters.createCharacter(draft);
        }}
        onCreateRelation={(character, draft) => {
          void characters.createCharacterRelation(character, draft);
        }}
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
        onOpenEvidence={(character, evidence) => {
          void input.navigation.openCharacterEvidence(character, evidence);
        }}
        onOpenSettings={() => input.onOpenSettings?.()}
        onDeleteInspirationKeyword={inspiration.deleteCharacterInspirationKeyword}
        onRequestExtractionPermission={() => {
          void characters.grantCharacterExtractionPermission();
        }}
        onRetire={(character) => {
          void characters.retireCharacter(character);
        }}
        onRetireRelation={(relation) => {
          void characters.retireCharacterRelation(relation);
        }}
        onRunGeneration={(brief) => {
          void characters.performCharacterGeneration(brief);
        }}
        onRunExtraction={() => {
          void characters.performCharacterExtraction();
        }}
        onSaveDraw={(draft: CharacterDrawDraft) => {
          const valuesFor = (...categories: readonly string[]) =>
            draft.traits
              .filter((trait) => categories.includes(trait.category))
              .map((trait) => trait.value)
              .join("\n");
          void characters.createCharacter({
            name: draft.name.trim(),
            aliases: Object.freeze([]),
            role: valuesFor("역할"),
            summary: draft.traits
              .map((trait) => `${trait.category}: ${trait.value}`)
              .join("\n"),
            appearance: valuesFor("의상"),
            personality: valuesFor("성격", "버릇", "비밀"),
            speech: valuesFor("말투"),
            goal: "",
            conflict: "",
            note: "",
          });
        }}
        onSelect={characters.selectCharacter}
        onUpdate={(character, changes) => {
          void characters.updateCharacter(character, changes);
        }}
        onUpdateRelation={(relation, changes) => {
          void characters.updateCharacterRelation(relation, changes);
        }}
        permissionRequired={characters.characterExtractionPermissionRequired}
        selectedCharacterId={input.projections.activeSelectedCharacterId}
        selection={characters.characterWorkspaceSelection}
      />
    ) : null;

  const plotSurface =
    input.workspaceSurface === "plots" && input.workSection !== "structure" ? (
      <PlotWorkspace
        board={(
          <PlotManagerDialog
            actionState={plotState.plotActionState}
            board={structure.plotBoard}
            canCreateEventFromSelection={canUseSelection}
            canLinkSource={canUseSelection}
            documentLabels={input.documentLabels}
            embedded
            error={plotState.plotActionError ?? inspiration.inspirationActionError}
            eventBlocks={input.projections.activeEventBlocks}
            eventLinks={input.projections.activePlotEventLinks}
            onCreate={(draft) => {
              void plot.createPlotThread(draft);
            }}
            onCreateEvent={(plotThread, exactSelection) => {
              void plot.createEventFromPlot(plotThread, exactSelection);
            }}
            onLinkEvent={(plotThread, eventBlockId, role) => {
              void plot.linkPlotEvent(plotThread, eventBlockId, role);
            }}
            onLinkSource={(plotThread) => {
              void plot.linkPlotThreadSource(plotThread);
            }}
            onMovePlacement={plot.movePlotPlacement}
            onOpenSource={(source) => {
              void input.navigation.openPlotThreadSource(source);
            }}
            onRetire={(plotThread) => {
              void plot.retirePlotThread(plotThread);
            }}
            onSelect={plotState.selectPlot}
            onSetStoryTime={plot.setPlotPlacementStoryTime}
            onUnlinkEvent={(link) => {
              void plot.unlinkPlotEvent(link);
            }}
            onUpdate={(plotThread, changes) => {
              void plot.updatePlotThread(plotThread, changes);
            }}
            plots={input.projections.activePlots}
            sceneDraft={input.sceneDraft}
            selectedPlotThreadId={input.projections.activeSelectedPlotThreadId}
            sources={input.projections.activePlotSources}
            utility={(
              <EventDrawTool
                busy={
                  plotState.plotActionState !== "idle" ||
                  inspiration.inspirationActionState !== "idle" ||
                  inspiration.workInspirationSettings === null
                }
                keywords={
                  inspiration.workInspirationSettings?.settings.eventKeywords ??
                  []
                }
                onAddKeywords={inspiration.addEventInspirationKeywords}
                onDeleteKeyword={inspiration.deleteEventInspirationKeyword}
                onSave={(draft: EventDrawDraft) => {
                  void plot.createPlotThread({
                    title: draft.cards.map((card) => card.title).join(" · "),
                    stage: "",
                    summary: draft.cards
                      .map((card) => `${card.title}: ${card.description}`)
                      .join("\n"),
                    note: "",
                  });
                }}
              />
            )}
          />
        )}
        initialTab={plotState.plotWorkspaceInitialTab}
        scenes={(
          <SceneStructureContent
            activeDocument={input.activeDocument}
            activeWork={input.activeWork}
            controllers={{
              music: input.controllers.music,
              scene: input.controllers.scene,
              sceneState: input.controllers.sceneState,
              structure: input.controllers.structure,
            }}
            musicConnected={input.musicConnected}
            navigation={{
              focusScene: input.navigation.focusScene,
              previewSceneExtractionCandidate:
                input.navigation.previewSceneExtractionCandidate,
            }}
            oauthStatus={input.oauthStatus}
            onOpenSettings={input.onOpenSettings}
            projections={{
              activeCharacters: input.projections.activeCharacters,
            }}
          />
        )}
      />
    ) : null;

  return (
    <>
      {characterSurface}
      {plotSurface}
    </>
  );
}
