import {
  RangeSet,
  StateEffect,
  StateField,
  type Extension,
  type Text,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  type DecorationSet,
} from "@codemirror/view";

import {
  deriveLoreCueProjection,
  type LoreCue,
} from "../../application/lore/lore-cue-projection";
import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import type { EntityId } from "../../domain/writing";

export type LoreCueContext = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly entries: readonly LoreEntryProjection[];
};

export type LoreCueAnchor = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

export type LoreCueInteraction = {
  readonly cue: LoreCue;
  readonly anchor: LoreCueAnchor;
};

export type LoreCueCallbacks = {
  readonly onHover: (interaction: LoreCueInteraction | null) => void;
  readonly onOpen: (cue: LoreCue) => void;
};

export const setLoreCueContextEffect =
  StateEffect.define<LoreCueContext>();

const setHoveredLoreCueEffect = StateEffect.define<string | null>();

export function resolveLoreCueLine(
  document: Text,
  cue: Pick<LoreCue, "lineFrom">,
): number {
  return document.lineAt(cue.lineFrom).number;
}

function anchorFromElement(element: HTMLElement): LoreCueAnchor {
  const bounds = element.getBoundingClientRect();
  return Object.freeze({
    left: bounds.left,
    right: bounds.right,
    top: bounds.top,
    bottom: bounds.bottom,
  });
}

class LoreCueMarker extends GutterMarker {
  constructor(
    readonly cue: LoreCue,
    private readonly callbacks: LoreCueCallbacks,
  ) {
    super();
  }

  override eq(other: LoreCueMarker): boolean {
    return other.cue.cueId === this.cue.cueId;
  }

  override toDOM(view: EditorView): HTMLElement {
    const button = document.createElement("button");
    button.className = "cm-lore-cue";
    button.type = "button";
    button.title = "별빛 보기";
    button.setAttribute(
      "aria-label",
      `별빛 ${this.cue.loreEntryIds.length}개 보기`,
    );
    button.textContent = "✦";

    const show = () => {
      view.dispatch({
        effects: setHoveredLoreCueEffect.of(this.cue.cueId),
      });
      this.callbacks.onHover(Object.freeze({
        cue: this.cue,
        anchor: anchorFromElement(button),
      }));
    };
    const hide = () => {
      view.dispatch({ effects: setHoveredLoreCueEffect.of(null) });
      this.callbacks.onHover(null);
    };

    button.addEventListener("mouseenter", show);
    button.addEventListener("mouseleave", hide);
    button.addEventListener("focus", show);
    button.addEventListener("blur", hide);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.onOpen(this.cue);
    });
    queueMicrotask(() => {
      button.closest(".cm-gutters")?.removeAttribute("aria-hidden");
    });
    return button;
  }
}

type LoreCueFieldValue = {
  readonly context: LoreCueContext;
  readonly cues: readonly LoreCue[];
  readonly hoveredCueId: string | null;
  readonly markers: RangeSet<GutterMarker>;
  readonly decorations: DecorationSet;
};

function buildMarkers(
  cues: readonly LoreCue[],
  callbacks: LoreCueCallbacks,
): RangeSet<GutterMarker> {
  return RangeSet.of(
    cues.map((cue) => new LoreCueMarker(cue, callbacks).range(cue.lineFrom)),
    true,
  );
}

function buildDecorations(
  cues: readonly LoreCue[],
  hoveredCueId: string | null,
): DecorationSet {
  const cue = cues.find((candidate) => candidate.cueId === hoveredCueId);
  if (cue === undefined) return Decoration.none;
  return Decoration.set(
    cue.occurrences.map((occurrence) =>
      Decoration.mark({ class: "cm-lore-cue-highlight" }).range(
        occurrence.from,
        occurrence.to,
      ),
    ),
    true,
  );
}

function projectState(
  context: LoreCueContext,
  document: Text,
  callbacks: LoreCueCallbacks,
  hoveredCueId: string | null,
): LoreCueFieldValue {
  const projection = deriveLoreCueProjection({
    ...context,
    text: document.toString(),
  });
  const nextHoveredCueId = projection.cues.some(
    (cue) => cue.cueId === hoveredCueId,
  )
    ? hoveredCueId
    : null;
  return Object.freeze({
    context,
    cues: projection.cues,
    hoveredCueId: nextHoveredCueId,
    markers: buildMarkers(projection.cues, callbacks),
    decorations: buildDecorations(projection.cues, nextHoveredCueId),
  });
}

export function createLoreCueExtension(
  initialContext: LoreCueContext,
  callbacks: LoreCueCallbacks,
): Extension {
  const field = StateField.define<LoreCueFieldValue>({
    create(state) {
      return projectState(initialContext, state.doc, callbacks, null);
    },
    update(current, transaction) {
      const contextEffect = transaction.effects.find((effect) =>
        effect.is(setLoreCueContextEffect),
      );
      if (contextEffect !== undefined || transaction.docChanged) {
        return projectState(
          contextEffect?.value ?? current.context,
          transaction.newDoc,
          callbacks,
          transaction.docChanged ? null : current.hoveredCueId,
        );
      }
      const hoverEffect = transaction.effects.find((effect) =>
        effect.is(setHoveredLoreCueEffect),
      );
      if (hoverEffect === undefined || hoverEffect.value === current.hoveredCueId) {
        return current;
      }
      return Object.freeze({
        ...current,
        hoveredCueId: hoverEffect.value,
        decorations: buildDecorations(current.cues, hoverEffect.value),
      });
    },
    provide: (cueField) =>
      EditorView.decorations.from(cueField, (value) => value.decorations),
  });

  return [
    field,
    gutter({
      class: "cm-lore-cue-gutter",
      markers: (view) => view.state.field(field).markers,
      lineMarkerChange: (update) =>
        update.startState.field(field) !== update.state.field(field),
    }),
  ];
}
