import type { CharacterProjection } from "../characters/character-contract";
import type { ManuscriptDocumentSource } from "../editor/manuscript-document-profile";
import type { PlotThreadProjection } from "../plots/plot-contract";
import type { PlotThreadSourceProjection } from "../plots/plot-source-contract";
import type { EventBlockProjection } from "./event-block-contract";
import type {
  SceneOverrideOperation,
  SceneOverrideProjection,
} from "./scene-override-contract";
import type { EntityId } from "../../domain/writing";

export type WorkStructureOverviewDocument = {
  readonly documentId: EntityId<"Document">;
  readonly label: string;
  readonly eventCount: number;
  readonly sceneBoundaryCount: number;
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

export type WorkStructureOverviewEvent = Pick<
  EventBlockProjection,
  | "eventBlockId"
  | "documentId"
  | "title"
  | "exactQuote"
  | "integrity"
  | "range"
>;

export type WorkStructureOverviewSceneBoundary = {
  readonly sceneOverrideId: EntityId<"SceneOverride">;
  readonly anchorId: EntityId<"Anchor">;
  readonly documentId: EntityId<"Document">;
  readonly operation: SceneOverrideOperation;
  readonly exactQuote: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: { readonly from: number; readonly to: number } | null;
};

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
    readonly sceneBoundaries: number;
  };
  readonly documents: readonly WorkStructureOverviewDocument[];
  readonly characters: readonly WorkStructureOverviewCharacter[];
  readonly plots: readonly WorkStructureOverviewPlot[];
  readonly events: readonly WorkStructureOverviewEvent[];
  readonly sceneBoundaries: readonly WorkStructureOverviewSceneBoundary[];
};

export type DeriveWorkStructureOverviewInput = {
  readonly workId: EntityId<"Work">;
  readonly workTitle: string;
  readonly documents: readonly ManuscriptDocumentSource[];
  readonly characters: readonly CharacterProjection[];
  readonly plots: readonly PlotThreadProjection[];
  readonly plotSources: readonly PlotThreadSourceProjection[];
  readonly eventBlocks: readonly EventBlockProjection[];
  readonly sceneOverrides: readonly SceneOverrideProjection[];
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

export function deriveWorkStructureOverview(
  input: DeriveWorkStructureOverviewInput,
): WorkStructureOverviewProjection {
  assertWorkOwned(input.documents, input.workId, "documents");
  assertWorkOwned(input.characters, input.workId, "characters");
  assertWorkOwned(input.plots, input.workId, "plots");
  assertWorkOwned(input.plotSources, input.workId, "plotSources");
  assertWorkOwned(input.eventBlocks, input.workId, "eventBlocks");
  assertWorkOwned(input.sceneOverrides, input.workId, "sceneOverrides");

  const documentsById = new Map(
    input.documents.map((document) => [document.documentId, document] as const),
  );
  const plotsById = new Map(
    input.plots.map((plot) => [plot.plotThreadId, plot] as const),
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
  input.eventBlocks.forEach((eventBlock) => {
    if (!documentsById.has(eventBlock.documentId)) {
      throw new Error(
        `eventBlocks references unknown Document ${eventBlock.documentId}`,
      );
    }
  });
  input.sceneOverrides.forEach((sceneOverride) => {
    if (!documentsById.has(sceneOverride.documentId)) {
      throw new Error(
        `sceneOverrides references unknown Document ${sceneOverride.documentId}`,
      );
    }
  });

  const sceneBoundaries = Object.freeze(input.sceneOverrides.flatMap(
    (sceneOverride) => sceneOverride.boundaries.map((boundary) => Object.freeze({
      sceneOverrideId: sceneOverride.sceneOverrideId,
      anchorId: boundary.anchorId,
      documentId: sceneOverride.documentId,
      operation: sceneOverride.operation,
      exactQuote: boundary.exactQuote,
      integrity: boundary.integrity,
      range: boundary.range,
    })),
  ));
  const documents = Object.freeze(input.documents.map((document) =>
    Object.freeze({
      documentId: document.documentId,
      label: document.label,
      eventCount: input.eventBlocks.filter(
        (eventBlock) => eventBlock.documentId === document.documentId,
      ).length,
      sceneBoundaryCount: sceneBoundaries.filter(
        (boundary) => boundary.documentId === document.documentId,
      ).length,
      plotSourceCount: input.plotSources.filter(
        (source) => source.sourceDocumentId === document.documentId,
      ).length,
    }),
  ));
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
  const events = Object.freeze(input.eventBlocks.map((eventBlock) =>
    Object.freeze({
      eventBlockId: eventBlock.eventBlockId,
      documentId: eventBlock.documentId,
      title: eventBlock.title,
      exactQuote: eventBlock.exactQuote,
      integrity: eventBlock.integrity,
      range: eventBlock.range,
    }),
  ));

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
      sceneBoundaries: sceneBoundaries.length,
    }),
    documents,
    characters,
    plots,
    events,
    sceneBoundaries,
  });
}
