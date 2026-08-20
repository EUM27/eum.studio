import {
  EditorState,
  StateField,
  type Extension,
  type Transaction,
} from "@codemirror/state";

type ProtectedRange = Readonly<{
  from: number;
  to: number;
}>;

function touchesProtectedText(
  transaction: Transaction,
  protectedRanges: readonly ProtectedRange[],
): boolean {
  let touchesProtected = false;
  transaction.changes.iterChanges((from, to) => {
    if (
      from !== to &&
      protectedRanges.some((range) => from < range.to && to > range.from)
    ) {
      touchesProtected = true;
    }
  });
  return touchesProtected;
}

function mapProtectedRanges(
  protectedRanges: readonly ProtectedRange[],
  transaction: Transaction,
): readonly ProtectedRange[] {
  const insertionPositions: number[] = [];
  transaction.changes.iterChanges((from, to, fromAfter, toAfter) => {
    if (from === to && toAfter > fromAfter) {
      insertionPositions.push(from);
    }
  });

  const mapped: ProtectedRange[] = [];
  for (const range of protectedRanges) {
    const splitPositions = insertionPositions.filter(
      (position) => position > range.from && position < range.to,
    );
    const boundaries = [range.from, ...splitPositions, range.to];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const from = transaction.changes.mapPos(boundaries[index]!, 1);
      const to = transaction.changes.mapPos(boundaries[index + 1]!, -1);
      if (from >= to) continue;
      const previous = mapped.at(-1);
      if (previous !== undefined && previous.to >= from) {
        mapped[mapped.length - 1] = Object.freeze({
          from: previous.from,
          to: Math.max(previous.to, to),
        });
      } else {
        mapped.push(Object.freeze({ from, to }));
      }
    }
  }
  return Object.freeze(mapped);
}

export function createForwardWritingProtection(
  protectedLength: number | null,
): Extension {
  if (protectedLength === null) return [];

  const protectedRanges = StateField.define<readonly ProtectedRange[]>({
    create(state) {
      const to = Math.min(protectedLength, state.doc.length);
      return to === 0
        ? Object.freeze([])
        : Object.freeze([Object.freeze({ from: 0, to })]);
    },
    update(current, transaction) {
      return transaction.docChanged
        ? mapProtectedRanges(current, transaction)
        : current;
    },
  });

  return [
    protectedRanges,
    EditorState.changeFilter.of((transaction) => {
      if (!transaction.docChanged) return true;
      const current = transaction.startState.field(protectedRanges, false);
      return current === undefined || !touchesProtectedText(transaction, current);
    }),
  ];
}
