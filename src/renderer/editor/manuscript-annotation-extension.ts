import {
  StateEffect,
  StateField,
  type Extension,
  type Range,
  type Text,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  type DecorationSet,
} from "@codemirror/view";

export type ManuscriptAnnotationRange = Readonly<{
  annotationId: string;
  from: number;
  to: number;
  tags: readonly string[];
}>;

export const setManuscriptAnnotationRangesEffect =
  StateEffect.define<readonly ManuscriptAnnotationRange[]>();

function normalizeRanges(
  ranges: readonly ManuscriptAnnotationRange[],
  document: Text,
): readonly ManuscriptAnnotationRange[] {
  const byId = new Map<string, ManuscriptAnnotationRange>();
  for (const range of ranges) {
    if (
      range.annotationId.length === 0 ||
      !Number.isSafeInteger(range.from) ||
      !Number.isSafeInteger(range.to) ||
      range.from < 0 ||
      range.to <= range.from ||
      range.to > document.length
    ) {
      continue;
    }
    byId.set(range.annotationId, Object.freeze({
      ...range,
      tags: Object.freeze([...range.tags]),
    }));
  }
  return Object.freeze(
    [...byId.values()].sort((left, right) =>
      left.from - right.from ||
      left.to - right.to ||
      left.annotationId.localeCompare(right.annotationId)
    ),
  );
}

function buildDecorations(
  ranges: readonly ManuscriptAnnotationRange[],
): DecorationSet {
  const decorations: Range<Decoration>[] = ranges.map((range) =>
    Decoration.mark({
      class: "cm-manuscript-annotation",
      attributes: {
        "data-manuscript-annotation-id": range.annotationId,
        title: range.tags.length === 0
          ? "주석 있음"
          : `주석 · ${range.tags.join(", ")}`,
      },
    }).range(range.from, range.to)
  );
  return Decoration.set(decorations, true);
}

export function createManuscriptAnnotationExtension(
  initialRanges: readonly ManuscriptAnnotationRange[],
): Extension {
  const field = StateField.define<Readonly<{
    ranges: readonly ManuscriptAnnotationRange[];
    decorations: DecorationSet;
  }>>({
    create(state) {
      const ranges = normalizeRanges(initialRanges, state.doc);
      return Object.freeze({
        ranges,
        decorations: buildDecorations(ranges),
      });
    },
    update(current, transaction) {
      const effect = transaction.effects.find((candidate) =>
        candidate.is(setManuscriptAnnotationRangesEffect)
      );
      if (effect !== undefined) {
        const ranges = normalizeRanges(effect.value, transaction.newDoc);
        return Object.freeze({
          ranges,
          decorations: buildDecorations(ranges),
        });
      }
      if (!transaction.docChanged) return current;
      return Object.freeze({
        ranges: current.ranges,
        decorations: current.decorations.map(transaction.changes),
      });
    },
    provide: (annotationField) =>
      EditorView.decorations.from(
        annotationField,
        (value) => value.decorations,
      ),
  });
  return field;
}
