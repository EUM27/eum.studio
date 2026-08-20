import { invertedEffects } from "@codemirror/commands";
import {
  EditorSelection,
  Facet,
  StateEffect,
  StateField,
  type ChangeDesc,
  type EditorState,
  type Extension,
  type SelectionRange,
  type Text,
  type Transaction,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  type DecorationSet,
} from "@codemirror/view";

import type {
  ManuscriptEditorDocumentState,
  ManuscriptFormattingProfile,
  ManuscriptFormattingRange,
  ManuscriptParagraphAlignment,
  ManuscriptParagraphAlignmentEntry,
  ManuscriptTextStyle,
} from "../../application/editor/manuscript-formatting";

type BooleanStyleKey = "bold" | "italic" | "underline";

type FormattingStateValue = {
  readonly documentState: ManuscriptEditorDocumentState;
  readonly storedStyle: ManuscriptTextStyle;
  readonly decorations: DecorationSet;
};

type FormattingSnapshot = {
  readonly documentState: ManuscriptEditorDocumentState;
  readonly storedStyle: ManuscriptTextStyle;
};

export type ActiveManuscriptFormatting = {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly fontFamilyId: string;
  readonly fontSizePx: number;
  readonly textColor: string;
  readonly highlightColor: string | null;
  readonly contentWidthPx: number;
  readonly lineHeight: number;
  readonly paragraphSpacingPx: number;
  readonly letterSpacingEm: number;
  readonly paragraphAlignment: ManuscriptParagraphAlignment | "mixed";
};

export const toggleManuscriptStyleEffect =
  StateEffect.define<BooleanStyleKey>();
export const setManuscriptFontFamilyEffect =
  StateEffect.define<string>();
export const setManuscriptFontSizeEffect =
  StateEffect.define<number>();
export const setManuscriptTextColorEffect =
  StateEffect.define<string | null>();
export const setManuscriptHighlightColorEffect =
  StateEffect.define<string | null>();
export const setManuscriptContentWidthEffect =
  StateEffect.define<number>();
export const setManuscriptLineHeightEffect =
  StateEffect.define<number>();
export const setManuscriptParagraphSpacingEffect =
  StateEffect.define<number>();
export const setManuscriptLetterSpacingEffect =
  StateEffect.define<number>();
export const setManuscriptParagraphAlignmentEffect =
  StateEffect.define<ManuscriptParagraphAlignment>();
const restoreManuscriptFormattingEffect =
  StateEffect.define<FormattingSnapshot>();

const formattingProfileFacet = Facet.define<
  ManuscriptFormattingProfile,
  ManuscriptFormattingProfile | null
>({
  combine(values) {
    return values[0] ?? null;
  },
});

const initialDocumentStateFacet = Facet.define<
  ManuscriptEditorDocumentState,
  ManuscriptEditorDocumentState | null
>({
  combine(values) {
    return values[0] ?? null;
  },
});

function requireFormattingProfile(
  profile: ManuscriptFormattingProfile | null,
): ManuscriptFormattingProfile {
  if (profile === null) {
    throw new Error("The manuscript formatting profile is missing");
  }
  return profile;
}

function requireInitialDocumentState(
  state: ManuscriptEditorDocumentState | null,
): ManuscriptEditorDocumentState {
  if (state === null) {
    throw new Error("The manuscript editor document state is missing");
  }
  return state;
}

function styleKey(style: ManuscriptTextStyle): string {
  return JSON.stringify([
    style.bold === true,
    style.italic === true,
    style.underline === true,
    style.fontFamilyId ?? null,
    style.fontSizePx ?? null,
    style.textColor ?? null,
    style.highlightColor ?? null,
  ]);
}

function isEmptyStyle(style: ManuscriptTextStyle): boolean {
  return Object.keys(style).length === 0;
}

function freezeStyle(style: ManuscriptTextStyle): ManuscriptTextStyle {
  return Object.freeze({ ...style });
}

function normalizeRanges(
  ranges: readonly ManuscriptFormattingRange[],
): readonly ManuscriptFormattingRange[] {
  const normalized: ManuscriptFormattingRange[] = [];
  for (const range of [...ranges].sort((left, right) => left.from - right.from)) {
    if (range.from >= range.to || isEmptyStyle(range.style)) {
      continue;
    }
    const previous = normalized.at(-1);
    if (
      previous !== undefined &&
      previous.to === range.from &&
      styleKey(previous.style) === styleKey(range.style)
    ) {
      normalized[normalized.length - 1] = Object.freeze({
        from: previous.from,
        to: range.to,
        style: previous.style,
      });
      continue;
    }
    normalized.push(
      Object.freeze({
        from: range.from,
        to: range.to,
        style: freezeStyle(range.style),
      }),
    );
  }
  return Object.freeze(normalized);
}

function normalizeParagraphAlignments(
  alignments: readonly ManuscriptParagraphAlignmentEntry[],
): readonly ManuscriptParagraphAlignmentEntry[] {
  const byPosition = new Map<number, ManuscriptParagraphAlignmentEntry>();
  for (const entry of alignments) {
    byPosition.set(
      entry.at,
      Object.freeze({ at: entry.at, alignment: entry.alignment }),
    );
  }
  return Object.freeze(
    [...byPosition.values()].sort((left, right) => left.at - right.at),
  );
}

function styleAt(
  ranges: readonly ManuscriptFormattingRange[],
  position: number,
): ManuscriptTextStyle {
  return ranges.find(
    (range) => range.from <= position && position < range.to,
  )?.style ?? Object.freeze({});
}

function styleAtCursor(
  ranges: readonly ManuscriptFormattingRange[],
  position: number,
): ManuscriptTextStyle {
  const exact = styleAt(ranges, position);
  if (!isEmptyStyle(exact)) {
    return exact;
  }
  const before = [...ranges]
    .reverse()
    .find((range) => range.to === position);
  return before?.style ?? Object.freeze({});
}

function mapRanges(
  ranges: readonly ManuscriptFormattingRange[],
  changes: ChangeDesc,
): readonly ManuscriptFormattingRange[] {
  if (changes.empty) {
    return ranges;
  }
  return normalizeRanges(
    ranges.map((range) => ({
      from: changes.mapPos(range.from, 1),
      to: changes.mapPos(range.to, -1),
      style: range.style,
    })),
  );
}

function mapParagraphAlignments(
  alignments: readonly ManuscriptParagraphAlignmentEntry[],
  changes: ChangeDesc,
  document: Text,
): readonly ManuscriptParagraphAlignmentEntry[] {
  if (changes.empty) {
    return alignments;
  }
  return normalizeParagraphAlignments(
    alignments.map((entry) => {
      const mapped = changes.mapPos(entry.at, 1);
      return {
        at: document.lineAt(Math.min(mapped, document.length)).from,
        alignment: entry.alignment,
      };
    }),
  );
}

function paragraphAlignmentAt(
  alignments: readonly ManuscriptParagraphAlignmentEntry[],
  lineStart: number,
): ManuscriptParagraphAlignment {
  return (
    alignments.find((entry) => entry.at === lineStart)?.alignment ?? "left"
  );
}

function selectedLineStarts(
  document: Text,
  selection: EditorSelection,
): readonly number[] {
  const starts = new Set<number>();
  for (const range of selection.ranges) {
    const lastPosition = range.empty
      ? range.head
      : Math.max(range.from, range.to - 1);
    const firstLine = document.lineAt(range.from).number;
    const lastLine = document.lineAt(lastPosition).number;
    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
      starts.add(document.line(lineNumber).from);
    }
  }
  return Object.freeze([...starts].sort((left, right) => left - right));
}

function applyParagraphAlignment(
  documentState: ManuscriptEditorDocumentState,
  document: Text,
  selection: EditorSelection,
  alignment: ManuscriptParagraphAlignment,
): ManuscriptEditorDocumentState {
  const targeted = new Set(selectedLineStarts(document, selection));
  const retained = documentState.paragraphAlignments.filter(
    (entry) => !targeted.has(entry.at),
  );
  const added =
    alignment === "left"
      ? []
      : [...targeted].map((at) => ({ at, alignment }));
  return Object.freeze({
    ...documentState,
    paragraphAlignments: normalizeParagraphAlignments([...retained, ...added]),
  });
}

function withStylePatch(
  style: ManuscriptTextStyle,
  patch: (current: ManuscriptTextStyle) => ManuscriptTextStyle,
): ManuscriptTextStyle {
  return freezeStyle(patch(style));
}

function applyPatchToRange(
  ranges: readonly ManuscriptFormattingRange[],
  from: number,
  to: number,
  patch: (current: ManuscriptTextStyle) => ManuscriptTextStyle,
): readonly ManuscriptFormattingRange[] {
  const boundaries = new Set<number>([from, to]);
  for (const range of ranges) {
    boundaries.add(range.from);
    boundaries.add(range.to);
  }
  const ordered = [...boundaries].sort((left, right) => left - right);
  const result: ManuscriptFormattingRange[] = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const segmentFrom = ordered[index];
    const segmentTo = ordered[index + 1];
    if (
      segmentFrom === undefined ||
      segmentTo === undefined ||
      segmentFrom === segmentTo
    ) {
      continue;
    }
    const current = styleAt(ranges, segmentFrom);
    const style =
      segmentFrom >= from && segmentTo <= to
        ? withStylePatch(current, patch)
        : current;
    if (!isEmptyStyle(style)) {
      result.push({ from: segmentFrom, to: segmentTo, style });
    }
  }
  return normalizeRanges(result);
}

function selectedRanges(selection: EditorSelection): readonly SelectionRange[] {
  return selection.ranges.filter((range) => !range.empty);
}

function selectionHasBooleanStyle(
  ranges: readonly ManuscriptFormattingRange[],
  selection: EditorSelection,
  key: BooleanStyleKey,
): boolean {
  const selected = selectedRanges(selection);
  if (selected.length === 0) {
    return false;
  }
  return selected.every((selectionRange) => {
    let cursor = selectionRange.from;
    for (const range of ranges) {
      if (range.to <= cursor || range.from >= selectionRange.to) {
        continue;
      }
      if (range.from > cursor || range.style[key] !== true) {
        return false;
      }
      cursor = Math.max(cursor, Math.min(selectionRange.to, range.to));
      if (cursor === selectionRange.to) {
        return true;
      }
    }
    return cursor === selectionRange.to;
  });
}

function removeStyleKey(
  style: ManuscriptTextStyle,
  key: keyof ManuscriptTextStyle,
): ManuscriptTextStyle {
  const next = { ...style };
  delete next[key];
  return next;
}

function applyBooleanStyle(
  value: FormattingStateValue,
  selection: EditorSelection,
  key: BooleanStyleKey,
): Pick<FormattingStateValue, "documentState" | "storedStyle"> {
  const selected = selectedRanges(selection);
  if (selected.length === 0) {
    const enabled = value.storedStyle[key] !== true;
    return {
      documentState: value.documentState,
      storedStyle: freezeStyle(
        enabled
          ? { ...value.storedStyle, [key]: true }
          : removeStyleKey(value.storedStyle, key),
      ),
    };
  }
  const enabled = !selectionHasBooleanStyle(
    value.documentState.ranges,
    selection,
    key,
  );
  let ranges = value.documentState.ranges;
  for (const range of selected) {
    ranges = applyPatchToRange(ranges, range.from, range.to, (style) =>
      enabled
        ? { ...style, [key]: true }
        : removeStyleKey(style, key),
    );
  }
  return {
    documentState: Object.freeze({
      ...value.documentState,
      ranges,
    }),
    storedStyle: Object.freeze({}),
  };
}

function applyValueStyle(
  value: FormattingStateValue,
  selection: EditorSelection,
  key: "fontFamilyId" | "fontSizePx" | "textColor" | "highlightColor",
  nextValue: string | number | null,
): Pick<FormattingStateValue, "documentState" | "storedStyle"> {
  const applyValue = (style: ManuscriptTextStyle): ManuscriptTextStyle =>
    nextValue === null
      ? removeStyleKey(style, key)
      : { ...style, [key]: nextValue };
  const selected = selectedRanges(selection);
  if (selected.length === 0) {
    return {
      documentState: value.documentState,
      storedStyle: freezeStyle(applyValue(value.storedStyle)),
    };
  }
  let ranges = value.documentState.ranges;
  for (const range of selected) {
    ranges = applyPatchToRange(
      ranges,
      range.from,
      range.to,
      applyValue,
    );
  }
  return {
    documentState: Object.freeze({
      ...value.documentState,
      ranges,
    }),
    storedStyle: Object.freeze({}),
  };
}

function applyBaseFontStyle(
  documentState: ManuscriptEditorDocumentState,
  storedStyle: ManuscriptTextStyle,
  key: "fontFamilyId" | "fontSizePx",
  value: string | number,
): Pick<FormattingStateValue, "documentState" | "storedStyle"> {
  const ranges = normalizeRanges(
    documentState.ranges.map((range) => ({
      ...range,
      style: removeStyleKey(range.style, key),
    })),
  );
  return {
    documentState: Object.freeze(
      key === "fontFamilyId"
        ? { ...documentState, ranges, fontFamilyId: String(value) }
        : { ...documentState, ranges, fontSizePx: Number(value) },
    ),
    storedStyle: freezeStyle(removeStyleKey(storedStyle, key)),
  };
}

function addInsertedStyles(
  ranges: readonly ManuscriptFormattingRange[],
  transaction: Transaction,
  storedStyle: ManuscriptTextStyle,
): readonly ManuscriptFormattingRange[] {
  if (transaction.changes.empty) {
    return ranges;
  }
  let nextRanges = ranges;
  transaction.changes.iterChanges(
    (fromBefore, _toBefore, fromAfter, toAfter) => {
      if (fromAfter === toAfter) {
        return;
      }
      const inherited = isEmptyStyle(storedStyle)
        ? styleAtCursor(
            transaction.startState.field(manuscriptFormattingField)
              .documentState.ranges,
            fromBefore,
          )
        : storedStyle;
      if (!isEmptyStyle(inherited)) {
        nextRanges = applyPatchToRange(
          nextRanges,
          fromAfter,
          toAfter,
          () => inherited,
        );
      }
    },
  );
  return nextRanges;
}

function decorationForStyle(
  style: ManuscriptTextStyle,
  profile: ManuscriptFormattingProfile,
): Decoration {
  const declarations: string[] = [];
  if (style.bold === true) {
    declarations.push("font-weight: 700");
  }
  if (style.italic === true) {
    declarations.push("font-style: italic");
  }
  if (style.underline === true) {
    declarations.push("text-decoration-line: underline");
  }
  if (style.fontFamilyId !== undefined) {
    const font = profile.fontFamilies.find(
      (candidate) => candidate.id === style.fontFamilyId,
    );
    if (font !== undefined) {
      declarations.push(`font-family: ${font.cssFamily}`);
    }
  }
  if (style.fontSizePx !== undefined) {
    declarations.push(`font-size: ${style.fontSizePx}px`);
  }
  if (style.textColor !== undefined) {
    declarations.push(`color: ${style.textColor}`);
  }
  if (style.highlightColor !== undefined) {
    declarations.push(`background-color: ${style.highlightColor}`);
  }
  return Decoration.mark({
    attributes: {
      style: declarations.join("; "),
    },
  });
}

function buildDecorations(
  documentState: ManuscriptEditorDocumentState,
  profile: ManuscriptFormattingProfile,
  document: Text,
): DecorationSet {
  const inline = documentState.ranges.map((range) =>
      decorationForStyle(range.style, profile).range(range.from, range.to),
    );
  const paragraphs = documentState.paragraphAlignments.map((entry) =>
    Decoration.line({
      attributes: {
        style: `text-align: ${entry.alignment}`,
      },
    }).range(document.lineAt(Math.min(entry.at, document.length)).from),
  );
  return Decoration.set(
    [...inline, ...paragraphs],
    true,
  );
}

function createValue(
  documentState: ManuscriptEditorDocumentState,
  storedStyle: ManuscriptTextStyle,
  profile: ManuscriptFormattingProfile,
  document: Text,
): FormattingStateValue {
  const frozenState = Object.freeze({
    schemaVersion: 1 as const,
    ranges: normalizeRanges(documentState.ranges),
    fontFamilyId: documentState.fontFamilyId,
    fontSizePx: documentState.fontSizePx,
    contentWidthPx: documentState.contentWidthPx,
    lineHeight: documentState.lineHeight,
    paragraphSpacingPx: documentState.paragraphSpacingPx,
    letterSpacingEm: documentState.letterSpacingEm,
    paragraphAlignments: normalizeParagraphAlignments(
      documentState.paragraphAlignments,
    ),
  });
  return Object.freeze({
    documentState: frozenState,
    storedStyle: freezeStyle(storedStyle),
    decorations: buildDecorations(frozenState, profile, document),
  });
}

const manuscriptFormattingField = StateField.define<FormattingStateValue>({
  create(state) {
    return createValue(
      requireInitialDocumentState(state.facet(initialDocumentStateFacet)),
      Object.freeze({}),
      requireFormattingProfile(state.facet(formattingProfileFacet)),
      state.doc,
    );
  },
  update(value, transaction) {
    const profile = requireFormattingProfile(
      transaction.state.facet(formattingProfileFacet),
    );
    let documentState: ManuscriptEditorDocumentState = Object.freeze({
      ...value.documentState,
      ranges: addInsertedStyles(
        mapRanges(value.documentState.ranges, transaction.changes),
        transaction,
        value.storedStyle,
      ),
      paragraphAlignments: mapParagraphAlignments(
        value.documentState.paragraphAlignments,
        transaction.changes,
        transaction.state.doc,
      ),
    });
    let storedStyle = transaction.docChanged
      ? value.storedStyle
      : transaction.selection !== undefined
        ? Object.freeze({})
        : value.storedStyle;
    for (const effect of transaction.effects) {
      if (effect.is(restoreManuscriptFormattingEffect)) {
        documentState = effect.value.documentState;
        storedStyle = effect.value.storedStyle;
      } else if (effect.is(toggleManuscriptStyleEffect)) {
        const applied = applyBooleanStyle(
          { ...value, documentState, storedStyle },
          transaction.startState.selection,
          effect.value,
        );
        documentState = applied.documentState;
        storedStyle = applied.storedStyle;
      } else if (effect.is(setManuscriptFontFamilyEffect)) {
        const applied = applyBaseFontStyle(
          documentState,
          storedStyle,
          "fontFamilyId",
          effect.value,
        );
        documentState = applied.documentState;
        storedStyle = applied.storedStyle;
      } else if (effect.is(setManuscriptFontSizeEffect)) {
        const applied = applyBaseFontStyle(
          documentState,
          storedStyle,
          "fontSizePx",
          effect.value,
        );
        documentState = applied.documentState;
        storedStyle = applied.storedStyle;
      } else if (effect.is(setManuscriptTextColorEffect)) {
        const applied = applyValueStyle(
          { ...value, documentState, storedStyle },
          transaction.startState.selection,
          "textColor",
          effect.value,
        );
        documentState = applied.documentState;
        storedStyle = applied.storedStyle;
      } else if (effect.is(setManuscriptHighlightColorEffect)) {
        const applied = applyValueStyle(
          { ...value, documentState, storedStyle },
          transaction.startState.selection,
          "highlightColor",
          effect.value,
        );
        documentState = applied.documentState;
        storedStyle = applied.storedStyle;
      } else if (effect.is(setManuscriptContentWidthEffect)) {
        documentState = Object.freeze({
          ...documentState,
          contentWidthPx: effect.value,
        });
      } else if (effect.is(setManuscriptLineHeightEffect)) {
        documentState = Object.freeze({
          ...documentState,
          lineHeight: effect.value,
        });
      } else if (effect.is(setManuscriptParagraphSpacingEffect)) {
        documentState = Object.freeze({
          ...documentState,
          paragraphSpacingPx: effect.value,
        });
      } else if (effect.is(setManuscriptLetterSpacingEffect)) {
        documentState = Object.freeze({
          ...documentState,
          letterSpacingEm: effect.value,
        });
      } else if (effect.is(setManuscriptParagraphAlignmentEffect)) {
        documentState = applyParagraphAlignment(
          documentState,
          transaction.startState.doc,
          transaction.startState.selection,
          effect.value,
        );
      }
    }
    return createValue(
      documentState,
      storedStyle,
      profile,
      transaction.state.doc,
    );
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

const manuscriptFormattingHistory = invertedEffects.of((transaction) => {
  if (
    transaction.effects.some(
      (effect) =>
        effect.is(toggleManuscriptStyleEffect) ||
        effect.is(setManuscriptFontFamilyEffect) ||
        effect.is(setManuscriptFontSizeEffect) ||
        effect.is(setManuscriptTextColorEffect) ||
        effect.is(setManuscriptHighlightColorEffect) ||
        effect.is(setManuscriptContentWidthEffect) ||
        effect.is(setManuscriptLineHeightEffect) ||
        effect.is(setManuscriptParagraphSpacingEffect) ||
        effect.is(setManuscriptLetterSpacingEffect) ||
        effect.is(setManuscriptParagraphAlignmentEffect) ||
        effect.is(restoreManuscriptFormattingEffect),
    )
  ) {
    return [
      restoreManuscriptFormattingEffect.of(
        Object.freeze({
          documentState:
            transaction.startState.field(manuscriptFormattingField)
              .documentState,
          storedStyle:
            transaction.startState.field(manuscriptFormattingField)
              .storedStyle,
        }),
      ),
    ];
  }
  return [];
});

export function createManuscriptFormattingExtension(
  profile: ManuscriptFormattingProfile,
  initialState: ManuscriptEditorDocumentState,
): Extension {
  const formattingKeymap = keymap.of([
    {
      key: "Mod-b",
      run(view) {
        view.dispatch({ effects: toggleManuscriptStyleEffect.of("bold") });
        return true;
      },
    },
    {
      key: "Mod-i",
      run(view) {
        view.dispatch({ effects: toggleManuscriptStyleEffect.of("italic") });
        return true;
      },
    },
    {
      key: "Mod-u",
      run(view) {
        view.dispatch({ effects: toggleManuscriptStyleEffect.of("underline") });
        return true;
      },
    },
  ]);
  return [
    formattingProfileFacet.of(profile),
    initialDocumentStateFacet.of(initialState),
    manuscriptFormattingField,
    manuscriptFormattingHistory,
    formattingKeymap,
    EditorView.contentAttributes.compute(
      [manuscriptFormattingField],
      (state) => {
        const value = state.field(manuscriptFormattingField);
        const font = profile.fontFamilies.find(
          (candidate) => candidate.id === value.documentState.fontFamilyId,
        );
        if (font === undefined) {
          throw new Error("The manuscript font is not registered");
        }
        return {
          style: [
            `font-family: ${font.cssFamily}`,
            `font-size: ${value.documentState.fontSizePx}px`,
            `width: min(100%, ${value.documentState.contentWidthPx}px)`,
            `max-width: min(100%, ${value.documentState.contentWidthPx}px)`,
            `line-height: ${value.documentState.lineHeight}`,
            `letter-spacing: ${value.documentState.letterSpacingEm}em`,
            `--manuscript-paragraph-spacing: ${value.documentState.paragraphSpacingPx}px`,
          ].join("; "),
        };
      },
    ),
  ];
}

export function readManuscriptEditorDocumentState(
  state: EditorState,
): ManuscriptEditorDocumentState {
  return state.field(manuscriptFormattingField).documentState;
}

function uniformValue<T>(
  ranges: readonly ManuscriptFormattingRange[],
  selection: SelectionRange,
  read: (style: ManuscriptTextStyle) => T | undefined,
): T | undefined {
  const boundaries = new Set<number>([selection.from, selection.to]);
  for (const range of ranges) {
    if (range.to > selection.from && range.from < selection.to) {
      boundaries.add(Math.max(selection.from, range.from));
      boundaries.add(Math.min(selection.to, range.to));
    }
  }
  const ordered = [...boundaries].sort((left, right) => left - right);
  let resolved: T | undefined;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const from = ordered[index];
    const to = ordered[index + 1];
    if (from === undefined || to === undefined || from === to) {
      continue;
    }
    const value = read(styleAt(ranges, from));
    if (resolved === undefined) {
      resolved = value;
    } else if (resolved !== value) {
      return undefined;
    }
  }
  return resolved;
}

export function readActiveManuscriptFormatting(
  state: EditorState,
  profile: ManuscriptFormattingProfile,
): ActiveManuscriptFormatting {
  const value = state.field(manuscriptFormattingField);
  const selection = state.selection.main;
  const cursorStyle = {
    ...styleAtCursor(value.documentState.ranges, selection.head),
    ...value.storedStyle,
  };
  const readBoolean = (key: BooleanStyleKey): boolean =>
    selection.empty
      ? cursorStyle[key] === true
      : selectionHasBooleanStyle(
          value.documentState.ranges,
          EditorSelection.single(selection.from, selection.to),
          key,
        );
  const selectedFont = selection.empty
    ? cursorStyle.fontFamilyId
    : uniformValue(
        value.documentState.ranges,
        selection,
        (style) => style.fontFamilyId,
      );
  const selectedSize = selection.empty
    ? cursorStyle.fontSizePx
    : uniformValue(
        value.documentState.ranges,
        selection,
        (style) => style.fontSizePx,
      );
  const selectedTextColor = selection.empty
    ? cursorStyle.textColor
    : uniformValue(
        value.documentState.ranges,
        selection,
        (style) => style.textColor,
      );
  const selectedHighlightColor = selection.empty
    ? cursorStyle.highlightColor
    : uniformValue(
        value.documentState.ranges,
        selection,
        (style) => style.highlightColor,
      );
  const selectedParagraphs = selectedLineStarts(state.doc, state.selection);
  const alignments = new Set(
    selectedParagraphs.map((at) =>
      paragraphAlignmentAt(value.documentState.paragraphAlignments, at),
    ),
  );
  const paragraphAlignment =
    alignments.size === 1
      ? (alignments.values().next().value ?? "left")
      : "mixed";
  return Object.freeze({
    bold: readBoolean("bold"),
    italic: readBoolean("italic"),
    underline: readBoolean("underline"),
    fontFamilyId: selectedFont ?? value.documentState.fontFamilyId,
    fontSizePx: selectedSize ?? value.documentState.fontSizePx,
    textColor: selectedTextColor ?? profile.defaults.textColor,
    highlightColor: selectedHighlightColor ?? null,
    contentWidthPx: value.documentState.contentWidthPx,
    lineHeight: value.documentState.lineHeight,
    paragraphSpacingPx: value.documentState.paragraphSpacingPx,
    letterSpacingEm: value.documentState.letterSpacingEm,
    paragraphAlignment,
  });
}

export function transactionChangesManuscriptFormatting(
  transaction: Transaction,
): boolean {
  if (
    !transaction.effects.some(
      (effect) =>
        effect.is(toggleManuscriptStyleEffect) ||
        effect.is(setManuscriptFontFamilyEffect) ||
        effect.is(setManuscriptFontSizeEffect) ||
        effect.is(setManuscriptTextColorEffect) ||
        effect.is(setManuscriptHighlightColorEffect) ||
        effect.is(setManuscriptContentWidthEffect) ||
        effect.is(setManuscriptLineHeightEffect) ||
        effect.is(setManuscriptParagraphSpacingEffect) ||
        effect.is(setManuscriptLetterSpacingEffect) ||
        effect.is(setManuscriptParagraphAlignmentEffect) ||
        effect.is(restoreManuscriptFormattingEffect),
    )
  ) {
    return false;
  }
  return (
    JSON.stringify(
      transaction.startState.field(manuscriptFormattingField).documentState,
    ) !==
    JSON.stringify(
      transaction.state.field(manuscriptFormattingField).documentState,
    )
  );
}

export function transactionChangesManuscriptLayoutSettings(
  transaction: Transaction,
): boolean {
  if (
    !transaction.effects.some(
      (effect) =>
        effect.is(setManuscriptFontFamilyEffect) ||
        effect.is(setManuscriptFontSizeEffect) ||
        effect.is(setManuscriptContentWidthEffect) ||
        effect.is(setManuscriptLineHeightEffect) ||
        effect.is(setManuscriptParagraphSpacingEffect) ||
        effect.is(setManuscriptLetterSpacingEffect) ||
        effect.is(restoreManuscriptFormattingEffect),
    )
  ) {
    return false;
  }
  const before = transaction.startState.field(manuscriptFormattingField)
    .documentState;
  const after = transaction.state.field(manuscriptFormattingField).documentState;
  return (
    before.fontFamilyId !== after.fontFamilyId ||
    before.fontSizePx !== after.fontSizePx ||
    before.contentWidthPx !== after.contentWidthPx ||
    before.lineHeight !== after.lineHeight ||
    before.paragraphSpacingPx !== after.paragraphSpacingPx ||
    before.letterSpacingEm !== after.letterSpacingEm
  );
}

export function transactionChangesManuscriptDocumentFormatting(
  transaction: Transaction,
): boolean {
  if (
    !transaction.effects.some(
      (effect) =>
        effect.is(toggleManuscriptStyleEffect) ||
        effect.is(setManuscriptTextColorEffect) ||
        effect.is(setManuscriptHighlightColorEffect) ||
        effect.is(setManuscriptParagraphAlignmentEffect) ||
        effect.is(restoreManuscriptFormattingEffect),
    )
  ) {
    return false;
  }
  const before = transaction.startState.field(manuscriptFormattingField)
    .documentState;
  const after = transaction.state.field(manuscriptFormattingField).documentState;
  return (
    JSON.stringify(before.ranges) !== JSON.stringify(after.ranges) ||
    JSON.stringify(before.paragraphAlignments) !==
      JSON.stringify(after.paragraphAlignments)
  );
}
