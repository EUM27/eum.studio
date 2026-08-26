import type { ComponentProps, ReactNode } from "react";

import type { ForeshadowPointProfile } from "../../../application/foreshadowing/foreshadow-point-contract";
import type {
  CharacterDrawDraft,
  EventDrawDraft,
} from "../../../application/inspiration/inspiration-draw";
import { isYouTubeMusicTrack } from "../../../application/music/media-track";
import type { WorkStructureOverviewProjection } from "../../../application/structure/work-structure-overview";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import { CharacterWorkspace } from "../../editor/CharacterWorkspace";
import { EventDrawTool } from "../../editor/EventDrawTool";
import { EventRail } from "../../editor/EventRail";
import { ForeshadowLineContent } from "../../editor/ForeshadowLineDialog";
import { LoreManagerContent } from "../../editor/LoreManagerDialog";
import { PlotManagerDialog } from "../../editor/PlotManagerDialog";
import { SceneExtractionPanel } from "../../editor/SceneExtractionPanel";
import { SceneList } from "../../editor/SceneList";
import { WorkStructureContent } from "../../editor/WorkStructureDialog";
import type { useCharactersController } from "../characters/useCharactersController";
import type { useForeshadowController } from "../foreshadow/useForeshadowController";
import type { useInspirationController } from "../inspiration/useInspirationController";
import type { useLoreController } from "../lore/useLoreController";
import type { useLoreForeshadowLinkController } from "../lore/useLoreForeshadowLinkController";
import type { useMusicController } from "../music/useMusicController";
import type {
  useEventWorkspaceController,
  useEventWorkspaceState,
} from "./useEventWorkspaceController";
import type {
  usePlotWorkspaceController,
  usePlotWorkspaceState,
} from "./usePlotWorkspaceController";
import type {
  useSceneWorkspaceController,
  useSceneWorkspaceState,
} from "./useSceneWorkspaceController";
import type { useStructureController } from "./useStructureController";
import { CharacterStructurePanel } from "../../structure/CharacterStructurePanel";
import { EventStructurePanel } from "../../structure/EventStructurePanel";
import { ForeshadowStructurePanel } from "../../structure/ForeshadowStructurePanel";
import { LoreStructurePanel } from "../../structure/LoreStructurePanel";
import { PlotStructurePanel } from "../../structure/PlotStructurePanel";
import { SceneStructurePanel } from "../../structure/SceneStructurePanel";
import { StructureOverviewPanel } from "../../structure/StructureOverviewPanel";
import type { StructureTab } from "../../navigation/studio-location";
import { StructureWorkspace } from "../../workspace/StructureWorkspace";
import type { useWorkStructureState } from "../../workspace/structure/useWorkStructureState";

type RuntimeProfile =
  | Readonly<{ ready: false }>
  | Readonly<{
      ready: true;
      foreshadowPointProfile: ForeshadowPointProfile;
    }>;

type WorkStructureNavigation = Pick<
  ComponentProps<typeof WorkStructureContent>,
  | "onOpenCharacter"
  | "onOpenDocument"
  | "onOpenEvent"
  | "onOpenLore"
  | "onOpenPlot"
  | "onOpenPlotSource"
  | "onOpenScene"
>;

export type SceneStructureContentProps = Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWork: WorkspaceWorkSummary | null;
  controllers: Readonly<{
    music: ReturnType<typeof useMusicController>;
    scene: ReturnType<typeof useSceneWorkspaceController>;
    sceneState: ReturnType<typeof useSceneWorkspaceState>;
    structure: ReturnType<typeof useStructureController>;
  }>;
  musicConnected: boolean;
  navigation: Readonly<{
    focusScene: ComponentProps<typeof SceneList>["onOpenScene"];
    previewSceneExtractionCandidate: ComponentProps<
      typeof SceneExtractionPanel
    >["onPreviewCandidate"];
  }>;
  oauthStatus: ComponentProps<typeof SceneExtractionPanel>["oauthStatus"];
  onOpenSettings: (() => void) | undefined;
  projections: Readonly<{
    activeCharacters: ReturnType<
      typeof useCharactersController
    >["characters"];
  }>;
}>;

export function SceneStructureContent(input: SceneStructureContentProps) {
  if (input.activeWork === null) return null;

  const activeWorkId = input.activeWork.workId;
  const music = input.controllers.music;
  const scene = input.controllers.scene;
  const sceneState = input.controllers.sceneState;
  const structure = input.controllers.structure;

  return (
    <div className="plot-workspace-structure-pane">
      <SceneExtractionPanel
        actionState={sceneState.sceneExtractionActionState}
        annotations={structure.sceneAnnotations.filter(
          (annotation) => annotation.workId === activeWorkId,
        )}
        candidates={structure.sceneExtractionCandidates}
        characters={input.projections.activeCharacters}
        error={sceneState.sceneExtractionActionError}
        oauthStatus={input.oauthStatus}
        onDecide={(candidate, boundary, decision) => {
          void scene.decideSceneExtractionBoundary(
            candidate,
            boundary,
            decision,
          );
        }}
        onDecideAnnotation={(candidate, sceneCandidate, decision) => {
          void scene.decideSceneExtractionAnnotation(
            candidate,
            sceneCandidate,
            decision,
          );
        }}
        onOpenSettings={() => input.onOpenSettings?.()}
        onPreviewCandidate={(candidate) => {
          void input.navigation.previewSceneExtractionCandidate(candidate);
        }}
        onRequestPermission={() => {
          void scene.grantSceneExtractionPermission();
        }}
        onRun={() => {
          void scene.performSceneExtraction();
        }}
        permissionRequired={sceneState.sceneExtractionPermissionRequired}
        projection={
          structure.sceneProjection?.workId === activeWorkId
            ? structure.sceneProjection
            : null
        }
        selection={sceneState.sceneExtractionSelection}
      />
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
      <SceneList
        activeDocumentId={input.activeDocument?.documentId ?? null}
        documentTitles={Object.fromEntries(
          input.activeWork.documents.map((document) => [
            document.documentId,
            document.title,
          ]),
        )}
        annotations={structure.sceneAnnotations.filter(
          (annotation) => annotation.workId === activeWorkId,
        )}
        busy={
          sceneState.sceneActionState !== "idle" ||
          sceneState.sceneExtractionActionState !== "idle"
        }
        favoriteMusicVideos={(
          music.workMusicSettings?.settings.favoriteTracks ?? []
        ).filter(isYouTubeMusicTrack)}
        musicConnected={input.musicConnected}
        musicPlaybackAvailable={music.youtubeMusicProfile !== null}
        musicQueueBusy={music.sceneMusicQueueActionState !== "idle"}
        musicQueueCandidates={music.sceneMusicQueueCandidates}
        onMergeWithPrevious={(sceneProjection, previousScene) => {
          void scene.mergeSceneWithPrevious(sceneProjection, previousScene);
        }}
        onDeleteScene={(sceneProjection) => {
          void scene.deleteScene(sceneProjection);
        }}
        onOpenMusicSettings={() => input.onOpenSettings?.()}
        onOpenScene={input.navigation.focusScene}
        onPlayFavoriteMusicVideo={(video) => music.playMusicQueue([video])}
        onPlaySceneMusicQueue={(candidate) => {
          void music.playSelectedSceneMusicQueue(candidate);
        }}
        onSearchSceneMusic={(annotation, query) => {
          void music.searchSceneMusicQueues(annotation, query);
        }}
        onSelectSceneMusicQueue={(candidate, option) => {
          void music.selectSceneMusicQueue(candidate, option);
        }}
        onSetEventOverride={(
          sceneProjection,
          eventBlockId,
          operation,
          expectedRevision,
        ) => {
          void scene.setSceneEventOverride(
            sceneProjection,
            eventBlockId,
            operation,
            expectedRevision,
          );
        }}
        onSplitScene={() => {
          void scene.createSceneBoundary("split");
        }}
        onToggleFavoriteMusicVideo={(video) => {
          void music.toggleFavoriteMusicTrack(video);
        }}
        onUpdateRuleSet={(draft) => {
          void scene.updateSceneRuleSet(draft);
        }}
        projection={
          structure.sceneProjection?.workId === activeWorkId
            ? structure.sceneProjection
            : null
        }
      />
    </div>
  );
}

export function StructureWorkspaceHost(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeTab: StructureTab;
  activeWork: WorkspaceWorkSummary | null;
  controllers: Readonly<{
    characters: ReturnType<typeof useCharactersController>;
    event: ReturnType<typeof useEventWorkspaceController>;
    eventState: ReturnType<typeof useEventWorkspaceState>;
    foreshadow: ReturnType<typeof useForeshadowController>;
    inspiration: ReturnType<typeof useInspirationController>;
    lore: ReturnType<typeof useLoreController>;
    loreForeshadowLinks: ReturnType<
      typeof useLoreForeshadowLinkController
    >;
    plot: ReturnType<typeof usePlotWorkspaceController>;
    plotState: ReturnType<typeof usePlotWorkspaceState>;
    structure: ReturnType<typeof useStructureController>;
    workStructure: ReturnType<typeof useWorkStructureState>;
  }>;
  commands: Readonly<{
    addLoreEntryEvidence: ComponentProps<
      typeof LoreManagerContent
    >["onAddEvidence"];
    captureForeshadowPoint: ComponentProps<
      typeof ForeshadowLineContent
    >["onCapture"];
    createLoreEntry: ComponentProps<typeof LoreManagerContent>["onCreate"];
  }>;
  documentLabels: Readonly<Record<string, string>>;
  eventRail: Readonly<{
    mode: ComponentProps<typeof EventRail>["mode"];
    onModeChange: ComponentProps<typeof EventRail>["onModeChange"];
  }>;
  hasManuscriptSelection: boolean;
  navigation: Readonly<{
    openCharacterEvidence: ComponentProps<
      typeof CharacterWorkspace
    >["onOpenEvidence"];
    openEventRailSource: ComponentProps<typeof EventRail>["onOpenSource"];
    openForeshadowPointSource: ComponentProps<
      typeof ForeshadowLineContent
    >["onOpenPoint"];
    openLoreEntryEvidence: ComponentProps<
      typeof LoreManagerContent
    >["onOpenEvidence"];
    openPlotThreadSource: ComponentProps<
      typeof PlotManagerDialog
    >["onOpenSource"];
    workStructure: WorkStructureNavigation;
  }>;
  oauthStatus: ComponentProps<typeof CharacterWorkspace>["oauthStatus"];
  onOpenSettings: (() => void) | undefined;
  onTabChange: (tab: StructureTab) => void;
  projections: Readonly<{
    activeCharacters: ReturnType<
      typeof useCharactersController
    >["characters"];
    activeCharacterRelations: ReturnType<
      typeof useCharactersController
    >["characterRelations"];
    activeLoreEntries: ReturnType<typeof useLoreController>["loreEntries"];
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
    activeSelectedLoreEntryId: string | null;
    activeSelectedPlotThreadId: string | null;
    workStructureOverview: WorkStructureOverviewProjection | null;
  }>;
  runtime: RuntimeProfile;
  sceneContent: ReactNode;
  sceneDraft: ReactNode;
}>) {
  if (input.activeWork === null || !input.runtime.ready) return null;

  const activeWorkId = input.activeWork.workId;
  const controllers = input.controllers;
  const characters = controllers.characters;
  const event = controllers.event;
  const eventState = controllers.eventState;
  const foreshadow = controllers.foreshadow;
  const inspiration = controllers.inspiration;
  const lore = controllers.lore;
  const loreForeshadowLinks = controllers.loreForeshadowLinks;
  const plot = controllers.plot;
  const plotState = controllers.plotState;
  const structure = controllers.structure;
  const workStructure = controllers.workStructure;
  const projections = input.projections;
  const canUseSelection =
    input.activeDocument !== null && input.hasManuscriptSelection;

  const characterStructureContent = (
    <CharacterWorkspace
      actionState={characters.characterActionState}
      candidates={characters.characterExtractionCandidates}
      characters={projections.activeCharacters}
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
      relations={projections.activeCharacterRelations}
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
      onDeleteInspirationKeyword={inspiration.deleteCharacterInspirationKeyword}
      onOpenEvidence={(character, evidence) => {
        void input.navigation.openCharacterEvidence(character, evidence);
      }}
      onOpenSettings={() => input.onOpenSettings?.()}
      onRequestExtractionPermission={() => {
        void characters.grantCharacterExtractionPermission();
      }}
      onRetire={(character) => {
        void characters.retireCharacter(character);
      }}
      onRetireRelation={(relation) => {
        void characters.retireCharacterRelation(relation);
      }}
      onRunExtraction={() => {
        void characters.performCharacterExtraction();
      }}
      onRunGeneration={(brief) => {
        void characters.performCharacterGeneration(brief);
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
      selectedCharacterId={projections.activeSelectedCharacterId}
      selection={characters.characterWorkspaceSelection}
    />
  );

  const plotStructureContent = (
    <PlotManagerDialog
      actionState={plotState.plotActionState}
      board={structure.plotBoard}
      canCreateEventFromSelection={canUseSelection}
      canLinkSource={canUseSelection}
      documentLabels={input.documentLabels}
      embedded
      error={plotState.plotActionError ?? inspiration.inspirationActionError}
      eventBlocks={projections.activeEventBlocks}
      eventLinks={projections.activePlotEventLinks}
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
      plots={projections.activePlots}
      sceneDraft={input.sceneDraft}
      selectedPlotThreadId={projections.activeSelectedPlotThreadId}
      sources={projections.activePlotSources}
      utility={(
        <EventDrawTool
          busy={
            plotState.plotActionState !== "idle" ||
            inspiration.inspirationActionState !== "idle" ||
            inspiration.workInspirationSettings === null
          }
          keywords={
            inspiration.workInspirationSettings?.settings.eventKeywords ?? []
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
  );

  return (
    <StructureWorkspace
      activeTab={input.activeTab}
      onTabChange={input.onTabChange}
      panels={{
        overview: (
          <StructureOverviewPanel>
            {projections.workStructureOverview === null ? (
              <p className="work-structure-empty">작품 구조를 불러오는 중입니다.</p>
            ) : (
              <WorkStructureContent
                busy={workStructure.workStructureActionState !== "idle"}
                error={workStructure.workStructureActionError}
                loreEntryCount={projections.activeLoreEntries.length}
                onOpenCharacter={
                  input.navigation.workStructure.onOpenCharacter
                }
                onOpenDocument={input.navigation.workStructure.onOpenDocument}
                onOpenEvent={input.navigation.workStructure.onOpenEvent}
                onOpenLore={input.navigation.workStructure.onOpenLore}
                onOpenPlot={input.navigation.workStructure.onOpenPlot}
                onOpenPlotSource={
                  input.navigation.workStructure.onOpenPlotSource
                }
                onOpenScene={input.navigation.workStructure.onOpenScene}
                projection={projections.workStructureOverview}
              />
            )}
          </StructureOverviewPanel>
        ),
        plots: <PlotStructurePanel>{plotStructureContent}</PlotStructurePanel>,
        events: (
          <EventStructurePanel>
            <EventRail
              eventBusy={eventState.eventActionState !== "idle"}
              mode={input.eventRail.mode}
              onCreatePlot={(eventBlock) => {
                void plot.createPlotFromEvent(eventBlock);
              }}
              onLinkSource={(eventBlock) => {
                void event.linkEventSource(eventBlock);
              }}
              onModeChange={input.eventRail.onModeChange}
              onMovePlacement={plot.movePlotPlacement}
              onOpenSource={(location) => {
                void input.navigation.openEventRailSource(location);
              }}
              onReplaceSource={(source) => {
                void event.replaceEventSource(source);
              }}
              onRetireSource={(source) => {
                void event.retireEventSource(source);
              }}
              plotBusy={plotState.plotActionState !== "idle"}
              projection={
                structure.eventRail?.workId === activeWorkId
                  ? structure.eventRail
                  : null
              }
            />
          </EventStructurePanel>
        ),
        scenes: (
          <SceneStructurePanel>{input.sceneContent}</SceneStructurePanel>
        ),
        characters: (
          <CharacterStructurePanel>
            {characterStructureContent}
          </CharacterStructurePanel>
        ),
        foreshadow: (
          <ForeshadowStructurePanel>
            <ForeshadowLineContent
              actionState={foreshadow.foreshadowLineActionState}
              canCapture={canUseSelection}
              documentLabels={input.documentLabels}
              error={foreshadow.foreshadowLineActionError}
              lines={foreshadow.foreshadowLines}
              loreEntries={projections.activeLoreEntries}
              loreForeshadowLinks={loreForeshadowLinks.activeLinks}
              onCapture={(lineId, roleId, note) => {
                void input.commands.captureForeshadowPoint(
                  lineId,
                  roleId,
                  note,
                );
              }}
              onCreate={(title, note) => {
                void foreshadow.createForeshadowLine(title, note);
              }}
              onLinkLore={(line, loreEntryId) => {
                const entry = projections.activeLoreEntries.find(
                  (candidate) => candidate.loreEntryId === loreEntryId,
                );
                if (entry !== undefined) {
                  void loreForeshadowLinks.linkLoreForeshadow(
                    entry,
                    line,
                    "foreshadow",
                  );
                }
              }}
              onOpenPoint={(point) => {
                void input.navigation.openForeshadowPointSource(point);
              }}
              onRetire={(line) => {
                void foreshadow.retireForeshadowLine(line);
              }}
              onUnlinkLore={(link) => {
                void loreForeshadowLinks.unlinkLoreForeshadow(
                  link,
                  "foreshadow",
                );
              }}
              onUpdate={(line, changes) => {
                void foreshadow.updateForeshadowLine(line, changes);
              }}
              points={foreshadow.foreshadowPoints}
              profile={input.runtime.foreshadowPointProfile}
              selectedLineId={foreshadow.selectedForeshadowLineId}
            />
          </ForeshadowStructurePanel>
        ),
        lore: (
          <LoreStructurePanel>
            <LoreManagerContent
              actionState={lore.loreActionState}
              canCaptureEvidence={canUseSelection}
              documentLabels={input.documentLabels}
              entries={projections.activeLoreEntries}
              error={lore.loreActionError}
              foreshadowLines={foreshadow.foreshadowLines}
              loreForeshadowLinks={loreForeshadowLinks.activeLinks}
              onAddEvidence={(entry) => {
                void input.commands.addLoreEntryEvidence(entry);
              }}
              onCreate={(draft) => {
                void input.commands.createLoreEntry(draft);
              }}
              onLinkForeshadow={(entry, lineId) => {
                const line = foreshadow.foreshadowLines.find(
                  (candidate) => candidate.lineId === lineId,
                );
                if (line !== undefined) {
                  void loreForeshadowLinks.linkLoreForeshadow(
                    entry,
                    line,
                    "lore",
                  );
                }
              }}
              onOpenEvidence={(evidence) => {
                void input.navigation.openLoreEntryEvidence(evidence);
              }}
              onRetire={(entry) => {
                void lore.retireLoreEntry(entry);
              }}
              onSelect={lore.selectLoreEntry}
              onUnlinkForeshadow={(link) => {
                void loreForeshadowLinks.unlinkLoreForeshadow(link, "lore");
              }}
              onUpdate={(entry, changes) => {
                void lore.updateLoreEntry(entry, changes);
              }}
              selectedLoreEntryId={projections.activeSelectedLoreEntryId}
            />
          </LoreStructurePanel>
        ),
      }}
    />
  );
}
