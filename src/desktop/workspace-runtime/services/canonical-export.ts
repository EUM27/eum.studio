import { createHash } from "node:crypto";
import type { PreparedCanonicalMarkdownExport } from "../../../application/export/canonical-markdown-export";
import { createCanonicalMarkdownExportBundle,parseExportCanonicalMarkdownCommand } from "../../../application/export/canonical-markdown-export";
import { projectCanonicalMarkdownExportSource } from "../../../application/export/canonical-markdown-source";
import type { LocalCharacterKnowledgeService } from "../../continuity/local-character-knowledge-runtime";
import type { LocalContinuityService } from "../../continuity/local-continuity-runtime";
import { LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { CharacterLoreService } from "./character-lore";
import type { EventsService } from "./events";
import type { ForeshadowingService } from "./foreshadowing";
import type { InfrastructureService } from "./infrastructure";
import type { PlotsService } from "./plots";
import type { SceneAnnotationsService } from "./scene-annotations";
import type { SceneGeometryService } from "./scene-geometry";
import type { WorkspaceService } from "./workspace";

/** Owns canonical export commands and their existing transaction boundaries. */
export class CanonicalExportService {
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #continuityService: LocalContinuityService;
  readonly #characterKnowledgeService: LocalCharacterKnowledgeService;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;
  readonly #workspace: Pick<WorkspaceService, "getWorkspaceCatalog">;
  readonly #character_lore: Pick<CharacterLoreService, "listCharactersSerially" | "listCharacterRelationsSerially" | "listLoreEntriesSerially" | "listLoreForeshadowLinksSerially">;
  readonly #events: Pick<EventsService, "listEventBlocksSerially">;
  readonly #plots: Pick<PlotsService, "listPlotThreadsSerially" | "listPlotEventLinksSerially">;
  readonly #foreshadowing: Pick<ForeshadowingService, "listForeshadowLinesSerially" | "listForeshadowPointsSerially">;
  readonly #scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially">;
  readonly #scene_annotations: Pick<SceneAnnotationsService, "listSceneAnnotationsSerially">;

  constructor(input: {
    readonly operations: WorkspaceOperationCoordinator;
    readonly continuityService: LocalContinuityService;
    readonly characterKnowledgeService: LocalCharacterKnowledgeService;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
    readonly workspace: Pick<WorkspaceService, "getWorkspaceCatalog">;
    readonly character_lore: Pick<CharacterLoreService, "listCharactersSerially" | "listCharacterRelationsSerially" | "listLoreEntriesSerially" | "listLoreForeshadowLinksSerially">;
    readonly events: Pick<EventsService, "listEventBlocksSerially">;
    readonly plots: Pick<PlotsService, "listPlotThreadsSerially" | "listPlotEventLinksSerially">;
    readonly foreshadowing: Pick<ForeshadowingService, "listForeshadowLinesSerially" | "listForeshadowPointsSerially">;
    readonly scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially">;
    readonly scene_annotations: Pick<SceneAnnotationsService, "listSceneAnnotationsSerially">;
  }) {
    this.#operations = input.operations;
    this.#continuityService = input.continuityService;
    this.#characterKnowledgeService = input.characterKnowledgeService;
    this.#infrastructure = input.infrastructure;
    this.#workspace = input.workspace;
    this.#character_lore = input.character_lore;
    this.#events = input.events;
    this.#plots = input.plots;
    this.#foreshadowing = input.foreshadowing;
    this.#scene_geometry = input.scene_geometry;
    this.#scene_annotations = input.scene_annotations;
  }

  prepareCanonicalMarkdownExport(
    value: unknown,
  ): Promise<PreparedCanonicalMarkdownExport> {
    this.#infrastructure.assertOpen();
    const command = parseExportCanonicalMarkdownCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      const work = this.#workspace.getWorkspaceCatalog().works.find(
        (candidate) => candidate.workId === command.workId,
      );
      if (work === undefined) throw new Error(`Unknown Work: ${command.workId}`);
      const listCommand = { schemaVersion: 1 as const, workId: command.workId };
      const [
        characters,
        relations,
        lore,
        loreForeshadow,
        events,
        plots,
        plotEvents,
        foreshadow,
        foreshadowPoints,
        sceneProjection,
        sceneAnnotations,
        continuity,
        knowledge,
      ] = await Promise.all([
        this.#character_lore.listCharactersSerially(listCommand),
        this.#character_lore.listCharacterRelationsSerially(listCommand),
        this.#character_lore.listLoreEntriesSerially(listCommand),
        this.#character_lore.listLoreForeshadowLinksSerially(listCommand),
        this.#events.listEventBlocksSerially(listCommand),
        this.#plots.listPlotThreadsSerially(listCommand),
        this.#plots.listPlotEventLinksSerially(listCommand),
        this.#foreshadowing.listForeshadowLinesSerially(listCommand),
        this.#foreshadowing.listForeshadowPointsSerially(listCommand),
        this.#scene_geometry.listSceneProjectionSerially(listCommand),
        this.#scene_annotations.listSceneAnnotationsSerially(listCommand),
        this.#continuityService.list({ ...listCommand, status: "all" }),
        this.#characterKnowledgeService.list({
          ...listCommand,
          characterId: null,
          status: "all",
        }),
      ]);
      return createCanonicalMarkdownExportBundle(
        projectCanonicalMarkdownExportSource({
          work,
          documents: work.documents,
          characters: characters.characters,
          characterRelations: relations.relations,
          loreEntries: lore.entries,
          loreForeshadowLinks: loreForeshadow.links,
          eventBlocks: events.eventBlocks,
          eventSources: events.eventSources,
          plotThreads: plots.plots,
          plotEventLinks: plotEvents.links,
          foreshadowLines: foreshadow.lines,
          foreshadowPoints: foreshadowPoints.points,
          scenes: sceneProjection.scenes,
          sceneAnnotations: sceneAnnotations.annotations,
          continuityThreads: continuity.threads,
          characterKnowledge: knowledge.entries,
        }),
        (canonical) => createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
          .update(canonical, "utf8")
          .digest("hex"),
      );
    });

    return execution;
  }
}

