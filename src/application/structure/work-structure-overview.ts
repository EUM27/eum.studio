import type { CharacterProjection } from "../characters/character-contract";
import type { ManuscriptDocumentSource } from "../editor/manuscript-document-profile";
import type { PlotThreadProjection } from "../plots/plot-contract";
import type { PlotThreadSourceProjection } from "../plots/plot-source-contract";
import {
  deriveEventBlockSourceState,
  type EventBlockProjection,
  type EventBlockSourceState,
  type EventSourceProjection,
} from "./event-block-contract";
import type { SceneProjection } from "./scene-projection";
import type { EntityId } from "../../domain/writing";

export type WorkStructureOverviewDocument = {
  readonly documentId: EntityId<"Document">;
  readonly label: string;
  readonly eventCount: number;
  readonly sceneCount: number;
  readonly plotSourceCount: number;
};

export type WorkStructureOverviewCharacter = Pick<
  CharacterProjection,
  "characterId" | "name" | "role"
>;

export type WorkStructureOverviewPlotSource = Pick<
  PlotThreadSourceProjection,
  | "sourceId"
  | "sourceDocumentId"
  | "exactText"
  | "integrity"
  | "range"
>;

export type WorkStructureOverviewPlot = Pick<
  PlotThreadProjection,
  "plotThreadId" | "title" | "stage"
> & {
  readonly source: WorkStructureOverviewPlotSource | null;
};

export type WorkStructureOverviewEventSource = {
  readonly eventSourceId: EntityId<"EventSource">;
  readonly documentId: EntityId<"Document">;
  readonly exactQuote: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: { readonly from: number; readonly to: number } | null;
};

export type WorkStructureOverviewEvent = Pick<
  EventBlockProjection,
  "eventBlockId" | "title"
> & {
  readonly sourceState: EventBlockSourceState;
  readonly source: WorkStructureOverviewEventSource | null;
};

export type WorkStructureOverviewScene = Pick<
  SceneProjection,
  | "sceneKey"
  | "documentId"
  | "documentRevisionId"
  | "sceneIndex"
  | "range"
  | "integrity"
  | "source"
  | "events"
>;

export type WorkStructureOverviewProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly workTitle: string;
  readonly totals: {
    readonly documents: number;
    readonly characters: number;
    readonly plots: number;
    readonly plotSources: number;
    readonly events: number;
    readonly scenes: number;
  };
  readonly documents: readonly WorkStructureOverviewDocument[];
  readonly characters: readonly WorkStructureOverviewCharacter[];
  readonly plots: readonly WorkStructureOverviewPlot[];
  readonly events: readonly WorkStructureOverviewEvent[];
  readonly scenes: readonly WorkStructureOverviewScene[];
};

export type DeriveWorkStructureOverviewInput = {
  readonly workId: EntityId<"Work">;
  readonly workTitle: string;
  readonly documents: readonly ManuscriptDocumentSource[];
  readonly characters: readonly CharacterProjection[];
  readonly plots: readonly PlotThreadProjection[];
  readonly plotSources: readonly PlotThreadSourceProjection[];
  readonly eventBlocks: readonly EventBlockProjection[];
  readonly eventSources: readonly EventSourceProjection[];
  readonly scenes: readonly SceneProjection[];
};

function assertWorkOwned(
  values: readonly { readonly workId: EntityId<"Work"> }[],
  workId: EntityId<"Work">,
  label: string,
): void {
  values.forEach((value, index) => {
    if (value.workId !== workId) {
      throw new Error(`${label}[${index}] is outside Work ${workId}`);
    }
  });
}

function preferredEventSource(
  eventBlockId: EntityId<"EventBlock">,
  eventSources: readonly EventSourceProjection[],
): EventSourceProjection | undefined {
  const sources = eventSources.filter(
    (source) =>
      source.eventBlockId === eventBlockId && source.retiredAt === null,
  );
  return sources.find((source) => source.role === "primary") ?? sources[0];
}

export function deriveWorkStructureOverview(
  input: DeriveWorkStructureOverviewInput,
): WorkStructureOverviewProjection {
  assertWorkOwned(input.documents, input.workId, "documents");
  assertWorkOwned(input.characters, input.workId, "characters");
  assertWorkOwned(input.plots, input.workId, "plots");
  assertWorkOwned(input.plotSources, input.workId, "plotSources");
  assertWorkOwned(input.eventBlocks, input.workId, "eventBlocks");
  assertWorkOwned(input.eventSources, input.workId, "eventSources");
  assertWorkOwned(input.scenes, input.workId, "scenes");

  const documentsById = new Map(
    input.documents.map((document) => [document.documentId, document] as const),
  );
  const plotsById = new Map(
    input.plots.map((plot) => [plot.plotThreadId, plot] as const),
  );
  const eventBlocksById = new Map(
    input.eventBlocks.map((eventBlock) => [
      eventBlock.eventBlockId,
      eventBlock,
    ] as const),
  );
  const sourceByPlotId = new Map<
    EntityId<"PlotThread">,
    PlotThreadSourceProjection
  >();
  input.plotSources.forEach((source) => {
    if (!plotsById.has(source.plotThreadId)) {
      throw new Error(
        `plotSources references unknown Plot ${source.plotThreadId}`,
      );
    }
    if (!documentsById.has(source.sourceDocumentId)) {
      throw new Error(
        `plotSources references unknown Document ${source.sourceDocumentId}`,
      );
    }
    if (sourceByPlotId.has(source.plotThreadId)) {
      throw new Error(`Plot ${source.plotThreadId} has more than one active source`);
    }
    sourceByPlotId.set(source.plotThreadId, source);
  });
  input.eventSources.forEach((source) => {
    if (!eventBlocksById.has(source.eventBlockId)) {
      throw new Error(
        `eventSources references unknown EventBlock ${source.eventBlockId}`,
      );
    }
    source.anchors.forEach((anchor) => {
      if (!documentsById.has(anchor.documentId)) {
        throw new Error(
          `eventSources references unknown Document ${anchor.documentId}`,
        );
      }
    });
  });
  input.scenes.forEach((scene) => {
    if (!documentsById.has(scene.documentId)) {
      throw new Error(
        `scenes references unknown Document ${scene.documentId}`,
      );
    }
  });

  const scenes = Object.freeze(input.scenes.map((scene) => Object.freeze({
    sceneKey: scene.sceneKey,
    documentId: scene.documentId,
    documentRevisionId: scene.documentRevisionId,
    sceneIndex: scene.sceneIndex,
    range: scene.range,
    integrity: scene.integrity,
    source: scene.source,
    events: scene.events,
  })));
  const documents = Object.freeze(input.documents.map((document) => {
    const documentEventIds = new Set(
      input.eventSources.flatMap((source) =>
        source.anchors.some((anchor) => anchor.documentId === document.documentId)
          ? [source.eventBlockId]
          : [],
      ),
    );
    return Object.freeze({
      documentId: document.documentId,
      label: document.label,
      eventCount: documentEventIds.size,
      sceneCount: scenes.filter(
        (scene) => scene.documentId === document.documentId,
      ).length,
      plotSourceCount: input.plotSources.filter(
        (source) => source.sourceDocumentId === document.documentId,
      ).length,
    });
  }));
  const characters = Object.freeze(input.characters.map((character) =>
    Object.freeze({
      characterId: character.characterId,
      name: character.name,
      role: character.role,
    }),
  ));
  const plots = Object.freeze(input.plots.map((plot) => {
    const source = sourceByPlotId.get(plot.plotThreadId);
    return Object.freeze({
      plotThreadId: plot.plotThreadId,
      title: plot.title,
      stage: plot.stage,
      source: source === undefined
        ? null
        : Object.freeze({
            sourceId: source.sourceId,
            sourceDocumentId: source.sourceDocumentId,
            exactText: source.exactText,
            integrity: source.integrity,
            range: source.range,
          }),
    });
  }));
  const events = Object.freeze(input.eventBlocks.map((eventBlock) => {
    const eventSource = preferredEventSource(
      eventBlock.eventBlockId,
      input.eventSources,
    );
    const anchor = eventSource?.anchors[0];
    return Object.freeze({
      eventBlockId: eventBlock.eventBlockId,
      title: eventBlock.title,
      sourceState: deriveEventBlockSourceState(
        eventBlock.eventBlockId,
        input.eventSources,
      ),
      source:
        eventSource === undefined || anchor === undefined
          ? null
          : Object.freeze({
              eventSourceId: eventSource.eventSourceId,
              documentId: anchor.documentId,
              exactQuote: anchor.exactQuote,
              integrity: anchor.integrity,
              range: anchor.range,
            }),
    });
  }));

  return Object.freeze({
    schemaVersion: 1,
    workId: input.workId,
    workTitle: input.workTitle,
    totals: Object.freeze({
      documents: documents.length,
      characters: characters.length,
      plots: plots.length,
      plotSources: input.plotSources.length,
      events: events.length,
      scenes: scenes.length,
    }),
    documents,
    characters,
    plots,
    events,
    scenes,
  });
}
