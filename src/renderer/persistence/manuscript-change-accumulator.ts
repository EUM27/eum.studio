import { ChangeSet } from "@codemirror/state";

import type { ChangeBatchChange } from "../../application/persistence/change-batch";
import type { ManuscriptTransaction } from "../editor/manuscript-transaction";

export type AccumulatedManuscriptChanges = {
  readonly beforeOffsetLength: number;
  readonly afterOffsetLength: number;
  readonly transactionCount: number;
  readonly changes: readonly ChangeBatchChange[];
};

export class ManuscriptChangeCompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManuscriptChangeCompositionError";
  }
}

function reconstructChangeSet(
  transaction: ManuscriptTransaction,
): ChangeSet {
  let changeSet: ChangeSet;
  try {
    changeSet = ChangeSet.of(
      transaction.changes.map((change) => ({
        from: change.from,
        to: change.to,
        insert: change.insertedText,
      })),
      transaction.beforeOffsetLength,
    );
  } catch (error) {
    throw new ManuscriptChangeCompositionError(
      error instanceof Error
        ? error.message
        : "Unable to reconstruct manuscript changes",
    );
  }
  if (changeSet.newLength !== transaction.afterOffsetLength) {
    throw new ManuscriptChangeCompositionError(
      `Transaction result length mismatch: expected ${transaction.afterOffsetLength}, received ${changeSet.newLength}`,
    );
  }
  return changeSet;
}

export class ManuscriptChangeAccumulator {
  #composed: ChangeSet | null = null;
  #transactionCount = 0;

  get transactionCount(): number {
    return this.#transactionCount;
  }

  append(transaction: ManuscriptTransaction): void {
    if (transaction.changes.length === 0) {
      return;
    }
    const next = reconstructChangeSet(transaction);
    const prior = this.#composed;
    if (
      prior !== null &&
      prior.newLength !== transaction.beforeOffsetLength
    ) {
      throw new ManuscriptChangeCompositionError(
        `Transaction base length discontinuity: expected ${prior.newLength}, received ${transaction.beforeOffsetLength}`,
      );
    }

    let composed: ChangeSet;
    try {
      composed = prior === null ? next : prior.compose(next);
    } catch (error) {
      throw new ManuscriptChangeCompositionError(
        error instanceof Error
          ? error.message
          : "Unable to compose manuscript changes",
      );
    }
    this.#composed = composed;
    this.#transactionCount += 1;
  }

  snapshot(): AccumulatedManuscriptChanges | null {
    const composed = this.#composed;
    if (composed === null) {
      return null;
    }
    const changes: ChangeBatchChange[] = [];
    composed.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      changes.push(
        Object.freeze({
          fromUtf16: fromA,
          toUtf16: toA,
          insertedText: inserted.toString(),
        }),
      );
    });
    return Object.freeze({
      beforeOffsetLength: composed.length,
      afterOffsetLength: composed.newLength,
      transactionCount: this.#transactionCount,
      changes: Object.freeze(changes),
    });
  }

  drain(): AccumulatedManuscriptChanges | null {
    const snapshot = this.snapshot();
    if (snapshot === null) {
      return null;
    }
    this.#composed = null;
    this.#transactionCount = 0;
    return snapshot;
  }
}
