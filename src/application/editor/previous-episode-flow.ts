import type { ManuscriptDocumentSource } from "./manuscript-document-profile";

export const PREVIOUS_EPISODE_FLOW_TARGET_CHARACTERS = 200;

export type PreviousEpisodeFlowPreview = {
  readonly sourceDocumentId: ManuscriptDocumentSource["documentId"];
  readonly title: string;
  readonly text: string;
};

type PreviewSentence = {
  readonly blockIndex: number;
  readonly text: string;
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

function splitPreviewSentences(block: string): readonly string[] {
  const normalizedBlock = block.replace(/\s+/gu, " ").trim();
  if (normalizedBlock.length === 0) {
    return [];
  }

  const sentences: string[] = [];
  let sentenceStart = 0;
  for (let index = 0; index < normalizedBlock.length; index += 1) {
    const character = normalizedBlock[index];
    if (character === undefined || !sentenceTerminators.has(character)) {
      continue;
    }

    let sentenceEnd = index + 1;
    while (
      sentenceEnd < normalizedBlock.length &&
      sentenceClosingMarks.has(normalizedBlock[sentenceEnd] ?? "")
    ) {
      sentenceEnd += 1;
    }
    const sentence = normalizedBlock.slice(sentenceStart, sentenceEnd).trim();
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    sentenceStart = sentenceEnd;
    while (
      sentenceStart < normalizedBlock.length &&
      /\s/u.test(normalizedBlock[sentenceStart] ?? "")
    ) {
      sentenceStart += 1;
    }
  }

  const tail = normalizedBlock.slice(sentenceStart).trim();
  if (tail.length > 0) {
    sentences.push(tail);
  }
  return sentences.length > 0 ? sentences : [normalizedBlock];
}

function joinPreviewSentences(units: readonly PreviewSentence[]): string {
  const paragraphs: string[][] = [];
  const paragraphIndexes: number[] = [];
  for (const unit of units) {
    let targetIndex = paragraphIndexes.indexOf(unit.blockIndex);
    if (targetIndex === -1) {
      targetIndex = paragraphs.length;
      paragraphIndexes.push(unit.blockIndex);
      paragraphs.push([]);
    }
    paragraphs[targetIndex]?.push(unit.text);
  }
  return paragraphs.map((paragraph) => paragraph.join(" ")).join("\n\n");
}

export function getPreviousEpisodeFlowPreviewText(
  text: string,
  targetCharacters = PREVIOUS_EPISODE_FLOW_TARGET_CHARACTERS,
): string {
  const normalizedText = text.replace(/\r\n?/gu, "\n").trim();
  if (normalizedText.length === 0) {
    return "";
  }

  const looseBlocks = normalizedText
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  const lineBlocks = normalizedText
    .split(/\n+/u)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  const blocks = looseBlocks.length > 1 ? looseBlocks : lineBlocks;
  const sentenceUnits = blocks.flatMap((block, blockIndex) =>
    splitPreviewSentences(block).map((sentence) => ({
      blockIndex,
      text: sentence,
    })),
  );
  if (sentenceUnits.length === 0) {
    return "";
  }

  const selectedUnits: PreviewSentence[] = [];
  let selectedCharacterCount = 0;
  for (let index = sentenceUnits.length - 1; index >= 0; index -= 1) {
    const unit = sentenceUnits[index];
    if (unit === undefined) {
      continue;
    }
    selectedUnits.unshift(unit);
    selectedCharacterCount += unit.text.length;
    if (selectedCharacterCount >= targetCharacters) {
      break;
    }
  }

  return joinPreviewSentences(selectedUnits);
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
