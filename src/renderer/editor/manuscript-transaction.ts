import type { Transaction } from "@codemirror/state";

export type ManuscriptTextChange = {
  readonly from: number;
  readonly to: number;
  readonly insertedText: string;
};

export type ManuscriptSelectionRange = {
  readonly anchor: number;
  readonly head: number;
  readonly from: number;
  readonly to: number;
  readonly empty: boolean;
};

export type ManuscriptSelection = {
  readonly mainIndex: number;
  readonly ranges: readonly ManuscriptSelectionRange[];
};

export type ManuscriptTransaction = {
  readonly beforeOffsetLength: number;
  readonly afterOffsetLength: number;
  readonly changes: readonly ManuscriptTextChange[];
  readonly selection: ManuscriptSelection;
};

export function extractManuscriptTransaction(
  transaction: Transaction,
): ManuscriptTransaction {
  const changes: ManuscriptTextChange[] = [];
  transaction.changes.iterChanges((from, to, _fromAfter, _toAfter, text) => {
    changes.push(
      Object.freeze({
        from,
        to,
        insertedText: text.toString(),
      }),
    );
  });
  const ranges = transaction.state.selection.ranges.map((range) =>
    Object.freeze({
      anchor: range.anchor,
      head: range.head,
      from: range.from,
      to: range.to,
      empty: range.empty,
    }),
  );

  return Object.freeze({
    beforeOffsetLength: transaction.startState.doc.length,
    afterOffsetLength: transaction.state.doc.length,
    changes: Object.freeze(changes),
    selection: Object.freeze({
      mainIndex: transaction.state.selection.mainIndex,
      ranges: Object.freeze(ranges),
    }),
  });
}
