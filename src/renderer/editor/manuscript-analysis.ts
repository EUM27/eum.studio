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

export type ManuscriptHeatmapMode = "off" | "sentence" | "word";

export type ManuscriptAnalysis = {
  readonly summary: string;
  readonly topWords: readonly Readonly<{
    word: string;
    count: number;
  }>[];
  readonly sentences: Readonly<{
    count: number;
    averageLength: number;
    minimumLength: number;
    maximumLength: number;
  }>;
  readonly repetitionDensityPercent: number;
};

const wordPattern = /[\p{L}\p{N}]+/gu;

function collectWordFrequency(text: string): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const match of text.matchAll(wordPattern)) {
    const word = match[0].toLocaleLowerCase();
    if (word.length < 2) continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  return frequency;
}

export function analyzeManuscriptText(text: string): ManuscriptAnalysis {
  const allWords = [...text.matchAll(wordPattern)];
  const frequency = collectWordFrequency(text);
  const topWords = [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([word, count]) => Object.freeze({ word, count }));
  const sentences = text
    .split(/[.!?](?:\s+|$)/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const sentenceLengths = sentences.map(
    (sentence) => sentence.replace(/\s/gu, "").length,
  );
  const topWordCount = topWords.reduce((total, word) => total + word.count, 0);
  const repetitionDensityPercent = allWords.length === 0
    ? 0
    : Number(((topWordCount / allWords.length) * 100).toFixed(1));
  return Object.freeze({
    summary:
      topWords.length === 0
        ? "아직 분석할 원고가 없습니다."
        : `주요 키워드: ${topWords
            .slice(0, 5)
            .map((entry) => entry.word)
            .join(", ")}`,
    topWords: Object.freeze(topWords),
    sentences: Object.freeze({
      count: sentenceLengths.length,
      averageLength:
        sentenceLengths.length === 0
          ? 0
          : Math.round(
              sentenceLengths.reduce((total, length) => total + length, 0) /
                sentenceLengths.length,
            ),
      minimumLength:
        sentenceLengths.length === 0 ? 0 : Math.min(...sentenceLengths),
      maximumLength:
        sentenceLengths.length === 0 ? 0 : Math.max(...sentenceLengths),
    }),
    repetitionDensityPercent,
  });
}

export const setManuscriptHeatmapModeEffect =
  StateEffect.define<ManuscriptHeatmapMode>();

type HeatmapState = {
  readonly mode: ManuscriptHeatmapMode;
  readonly decorations: DecorationSet;
};

export function classifySentenceHeatmapLine(text: string): string | null {
  const length = text.replace(/[^\p{L}]/gu, "").length;
  if (length > 80) return "manuscript-heatmap-extreme";
  if (length > 60) return "manuscript-heatmap-very-long";
  if (length > 40) return "manuscript-heatmap-long";
  return null;
}

export function classifyRepeatedWord(count: number): string | null {
  if (count >= 6) return "dense";
  if (count >= 3) return "repeated";
  return null;
}

function buildHeatmapDecorations(
  document: Text,
  mode: ManuscriptHeatmapMode,
): DecorationSet {
  if (mode === "off") return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  if (mode === "sentence") {
    for (let lineNumber = 1; lineNumber <= document.lines; lineNumber += 1) {
      const line = document.line(lineNumber);
      const className = classifySentenceHeatmapLine(line.text);
      if (className !== null) {
        ranges.push(
          Decoration.line({
            class: `manuscript-heatmap-line ${className}`,
          }).range(line.from),
        );
      }
    }
    return Decoration.set(ranges, true);
  }

  const frequency = collectWordFrequency(document.toString());
  for (let lineNumber = 1; lineNumber <= document.lines; lineNumber += 1) {
    const line = document.line(lineNumber);
    for (const match of line.text.matchAll(wordPattern)) {
      const count = frequency.get(match[0].toLocaleLowerCase()) ?? 0;
      const strength = classifyRepeatedWord(count);
      if (strength === null || match.index === undefined) continue;
      ranges.push(
        Decoration.mark({
          class:
            strength === "dense"
              ? "manuscript-heatmap-word manuscript-heatmap-word-dense"
              : "manuscript-heatmap-word",
        }).range(
          line.from + match.index,
          line.from + match.index + match[0].length,
        ),
      );
    }
  }
  return Decoration.set(ranges, true);
}

export function createManuscriptHeatmapExtension(
  initialMode: ManuscriptHeatmapMode,
): Extension {
  const field = StateField.define<HeatmapState>({
    create(state) {
      return Object.freeze({
        mode: initialMode,
        decorations: buildHeatmapDecorations(state.doc, initialMode),
      });
    },
    update(current, transaction) {
      let mode = current.mode;
      for (const effect of transaction.effects) {
        if (effect.is(setManuscriptHeatmapModeEffect)) {
          mode = effect.value;
        }
      }
      if (!transaction.docChanged && mode === current.mode) return current;
      return Object.freeze({
        mode,
        decorations: buildHeatmapDecorations(transaction.state.doc, mode),
      });
    },
    provide: (source) => [
      EditorView.decorations.from(source, (value) => value.decorations),
      EditorView.editorAttributes.from(source, (value) => ({
        "data-heatmap-mode": value.mode,
      })),
    ],
  });
  return field;
}
