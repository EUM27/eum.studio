import {
  EditorSelection,
  StateEffect,
  StateField,
  type Extension,
  type Range,
  type Text,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  dropCursor,
  type DecorationSet,
} from "@codemirror/view";

export type ManuscriptSceneRange = Readonly<{
  sceneKey: string;
  sceneIndex: number;
  start: number;
  end: number;
  integrity: "resolved" | "needsReview" | "broken";
  spansEpisodes: boolean;
}>;

export const setManuscriptSceneRangesEffect =
  StateEffect.define<readonly ManuscriptSceneRange[]>();

function normalizeManuscriptSceneRanges(
  ranges: readonly ManuscriptSceneRange[],
  document: Text,
): readonly ManuscriptSceneRange[] {
  const byIdentity = new Map<string, ManuscriptSceneRange>();
  for (const range of ranges) {
    if (
      range.sceneKey.length === 0 ||
      !Number.isSafeInteger(range.sceneIndex) ||
      range.sceneIndex < 1 ||
      !Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start < 0 ||
      range.end < range.start ||
      range.end > document.length
    ) {
      continue;
    }
    byIdentity.set(range.sceneKey, Object.freeze({ ...range }));
  }
  return Object.freeze(
    [...byIdentity.values()].sort((first, second) =>
      first.start - second.start ||
      first.end - second.end ||
      first.sceneKey.localeCompare(second.sceneKey)
    ),
  );
}

function buildManuscriptSceneDecorations(
  ranges: readonly ManuscriptSceneRange[],
): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  ranges.forEach((range) => {
    if (range.start < range.end) {
      decorations.push(
        Decoration.mark({
          class: [
            "cm-manuscript-scene-range",
            range.sceneIndex % 2 === 0 ? "is-even" : "is-odd",
          ].join(" "),
          attributes: {
            "data-scene-key": range.sceneKey,
            "data-scene-integrity": range.integrity,
            "data-scene-spans-episodes": String(range.spansEpisodes),
            draggable: range.integrity === "resolved" ? "true" : "false",
            title: range.integrity === "resolved"
              ? "장면 범위를 드래그해 이동"
              : "장면 범위를 확인한 뒤 이동할 수 있습니다",
          },
        }).range(range.start, range.end),
      );
    }
  });
  return Decoration.set(decorations, true);
}

export function createManuscriptSceneRangeExtension(
  initialRanges: readonly ManuscriptSceneRange[],
): Extension {
  const sceneRangeField = StateField.define<{
    readonly ranges: readonly ManuscriptSceneRange[];
    readonly decorations: DecorationSet;
  }>({
    create(state) {
      const ranges = normalizeManuscriptSceneRanges(initialRanges, state.doc);
      return Object.freeze({
        ranges,
        decorations: buildManuscriptSceneDecorations(ranges),
      });
    },
    update(current, transaction) {
      const effect = transaction.effects.find((candidate) =>
        candidate.is(setManuscriptSceneRangesEffect),
      );
      if (effect === undefined) {
        if (!transaction.docChanged) return current;
        return Object.freeze({
          ranges: current.ranges,
          decorations: current.decorations.map(transaction.changes),
        });
      }
      const ranges = normalizeManuscriptSceneRanges(
        effect.value,
        transaction.newDoc,
      );
      return Object.freeze({
        ranges,
        decorations: buildManuscriptSceneDecorations(ranges),
      });
    },
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });
  return [
    sceneRangeField,
    dropCursor(),
    EditorView.domEventHandlers({
      dragstart: (event, view) => {
        const target = event.target instanceof Element
          ? event.target.closest<HTMLElement>(".cm-manuscript-scene-range")
          : null;
        const sceneKey = target?.dataset.sceneKey;
        if (sceneKey === undefined || view.state.readOnly) return false;
        const range = view.state.field(sceneRangeField).ranges.find(
          (candidate) => candidate.sceneKey === sceneKey,
        );
        if (range === undefined || range.integrity !== "resolved") {
          return true;
        }
        view.dispatch({
          selection: EditorSelection.range(range.start, range.end),
        });
        return false;
      },
    }),
  ];
}
