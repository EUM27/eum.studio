import {
  findClusterBreak,
  StateField,
  type EditorState,
  type Extension,
  type Text,
  type Transaction,
} from "@codemirror/state";

export type ManuscriptTextStatistics = {
  readonly characterCount: number;
  readonly characterCountWithoutWhitespace: number;
};

type LineStatistics = ManuscriptTextStatistics;

type ChangedLineRange = {
  oldFrom: number;
  oldTo: number;
  newFrom: number;
  newTo: number;
};

function countLine(text: string): LineStatistics {
  let characterCount = 0;
  let characterCountWithoutWhitespace = 0;
  const whitespaceAt = /\p{White_Space}/uy;
  let offset = 0;

  while (offset < text.length) {
    whitespaceAt.lastIndex = offset;
    if (!whitespaceAt.test(text)) {
      characterCountWithoutWhitespace += 1;
    }
    characterCount += 1;
    offset = findClusterBreak(text, offset);
  }

  return { characterCount, characterCountWithoutWhitespace };
}

function countLineRange(
  document: Text,
  fromLine: number,
  toLine: number,
): LineStatistics {
  let characterCount = 0;
  let characterCountWithoutWhitespace = 0;

  for (const line of document.iterLines(fromLine + 1, toLine + 2)) {
    const statistics = countLine(line);
    characterCount += statistics.characterCount;
    characterCountWithoutWhitespace +=
      statistics.characterCountWithoutWhitespace;
  }

  return { characterCount, characterCountWithoutWhitespace };
}

function freezeStatistics(
  characterCount: number,
  characterCountWithoutWhitespace: number,
): ManuscriptTextStatistics {
  return Object.freeze({
    characterCount,
    characterCountWithoutWhitespace,
  });
}

export function calculateManuscriptTextStatistics(
  document: Text,
): ManuscriptTextStatistics {
  const lineStatistics = countLineRange(document, 0, document.lines - 1);
  return freezeStatistics(
    lineStatistics.characterCount + document.lines - 1,
    lineStatistics.characterCountWithoutWhitespace,
  );
}

function collectChangedLineRanges(
  transaction: Transaction,
): readonly ChangedLineRange[] {
  const ranges: ChangedLineRange[] = [];
  transaction.changes.iterChangedRanges(
    (fromBefore, toBefore, fromAfter, toAfter) => {
      const nextRange: ChangedLineRange = {
        oldFrom:
          transaction.startState.doc.lineAt(fromBefore).number - 1,
        oldTo: transaction.startState.doc.lineAt(toBefore).number - 1,
        newFrom: transaction.state.doc.lineAt(fromAfter).number - 1,
        newTo: transaction.state.doc.lineAt(toAfter).number - 1,
      };
      const previousRange = ranges.at(-1);
      if (
        previousRange !== undefined &&
        (nextRange.oldFrom <= previousRange.oldTo ||
          nextRange.newFrom <= previousRange.newTo)
      ) {
        previousRange.oldTo = Math.max(
          previousRange.oldTo,
          nextRange.oldTo,
        );
        previousRange.newTo = Math.max(
          previousRange.newTo,
          nextRange.newTo,
        );
        return;
      }
      ranges.push(nextRange);
    },
    true,
  );
  return ranges;
}

function updateStatistics(
  previous: ManuscriptTextStatistics,
  transaction: Transaction,
): ManuscriptTextStatistics {
  if (!transaction.docChanged) {
    return previous;
  }

  let characterCount =
    previous.characterCount +
    transaction.state.doc.lines -
    transaction.startState.doc.lines;
  let characterCountWithoutWhitespace =
    previous.characterCountWithoutWhitespace;

  for (const range of collectChangedLineRanges(transaction)) {
    const before = countLineRange(
      transaction.startState.doc,
      range.oldFrom,
      range.oldTo,
    );
    const after = countLineRange(
      transaction.state.doc,
      range.newFrom,
      range.newTo,
    );
    characterCount += after.characterCount - before.characterCount;
    characterCountWithoutWhitespace +=
      after.characterCountWithoutWhitespace -
      before.characterCountWithoutWhitespace;
  }

  return freezeStatistics(
    characterCount,
    characterCountWithoutWhitespace,
  );
}

const manuscriptTextStatisticsField =
  StateField.define<ManuscriptTextStatistics>({
    create(state) {
      return calculateManuscriptTextStatistics(state.doc);
    },
    update: updateStatistics,
  });

export const manuscriptTextStatisticsExtension: Extension =
  manuscriptTextStatisticsField;

export function readManuscriptTextStatistics(
  state: EditorState,
): ManuscriptTextStatistics {
  return state.field(manuscriptTextStatisticsField);
}
