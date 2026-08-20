import type { ManuscriptDocumentSource } from "./manuscript-document-profile";

export const PREVIOUS_EPISODE_FLOW_TARGET_CHARACTERS = 200;

export type PreviousEpisodeFlowPreview = {
  readonly sourceDocumentId: ManuscriptDocumentSource["documentId"];
  readonly title: string;
  readonly text: string;
};

type PreviewSentenceRange = {
  readonly from: number;
  readonly to: number;
};

const sentenceTerminators = new Set([
  ".",
  "?",
  "!",
  "。",
  "？",
  "！",
  "…",
]);
const sentenceClosingMarks = new Set([
  '"',
  "'",
  "”",
  "’",
  "」",
  "』",
  ")",
  "]",
]);

function collectPreviewSentenceRanges(
  text: string,
  contentStart: number,
  contentEnd: number,
): readonly PreviewSentenceRange[] {
  if (contentStart === contentEnd) {
    return [];
  }

  const sentences: PreviewSentenceRange[] = [];
  let sentenceStart = contentStart;
  for (let index = contentStart; index < contentEnd; index += 1) {
    const character = text[index];
    if (character === undefined || !sentenceTerminators.has(character)) {
      continue;
    }

    let sentenceEnd = index + 1;
    while (
      sentenceEnd < contentEnd &&
      sentenceClosingMarks.has(text[sentenceEnd] ?? "")
    ) {
      sentenceEnd += 1;
    }
    if (sentenceStart < sentenceEnd) {
      sentences.push(Object.freeze({ from: sentenceStart, to: sentenceEnd }));
    }
    sentenceStart = sentenceEnd;
    while (
      sentenceStart < contentEnd &&
      /\s/u.test(text[sentenceStart] ?? "")
    ) {
      sentenceStart += 1;
    }
    index = sentenceStart - 1;
  }

  if (sentenceStart < contentEnd) {
    sentences.push(Object.freeze({ from: sentenceStart, to: contentEnd }));
  }
  return Object.freeze(sentences);
}

export function getPreviousEpisodeFlowPreviewText(
  text: string,
  targetCharacters = PREVIOUS_EPISODE_FLOW_TARGET_CHARACTERS,
): string {
  const canonicalText = text.replace(/\r\n?/gu, "\n");
  const contentStart = canonicalText.search(/\S/u);
  if (contentStart === -1) {
    return "";
  }
  const contentEnd = canonicalText.trimEnd().length;
  const sentenceUnits = collectPreviewSentenceRanges(
    canonicalText,
    contentStart,
    contentEnd,
  );
  if (sentenceUnits.length === 0) {
    return "";
  }

  const selectedUnits: PreviewSentenceRange[] = [];
  let selectedCharacterCount = 0;
  for (let index = sentenceUnits.length - 1; index >= 0; index -= 1) {
    const unit = sentenceUnits[index];
    if (unit === undefined) {
      continue;
    }
    selectedUnits.unshift(unit);
    selectedCharacterCount += unit.to - unit.from;
    if (selectedCharacterCount >= targetCharacters) {
      break;
    }
  }

  const first = selectedUnits[0];
  const last = selectedUnits.at(-1);
  if (first === undefined || last === undefined) {
    return "";
  }
  const selectedStart = first.from === contentStart ? 0 : first.from;
  const selectedEnd = last.to === contentEnd ? canonicalText.length : last.to;
  return canonicalText.slice(selectedStart, selectedEnd);
}

export function derivePreviousEpisodeFlowPreview(
  activeDocument: ManuscriptDocumentSource,
  orderedDocuments: readonly ManuscriptDocumentSource[],
  materializeDocumentText: (document: ManuscriptDocumentSource) => string,
): PreviousEpisodeFlowPreview | null {
  const activeIndex = orderedDocuments.findIndex(
    (document) =>
      document.workId === activeDocument.workId &&
      document.documentId === activeDocument.documentId,
  );
  if (activeIndex <= 0) {
    return null;
  }

  const previousDocument = orderedDocuments[activeIndex - 1];
  if (
    previousDocument === undefined ||
    previousDocument.workId !== activeDocument.workId
  ) {
    return null;
  }
  const text = getPreviousEpisodeFlowPreviewText(
    materializeDocumentText(previousDocument),
  );
  if (text.length === 0) {
    return null;
  }

  return Object.freeze({
    sourceDocumentId: previousDocument.documentId,
    title: previousDocument.label,
    text,
  });
}
