import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
  type ChangeBatch,
} from "../../application/persistence/change-batch";
import type { SaveReceipt } from "../../application/persistence/save-change-batch";
import type {
  EntityId,
  Instant,
} from "../../domain/writing";
import type { ManuscriptTransaction } from "../editor/manuscript-transaction";
import { ManuscriptChangeAccumulator } from "./manuscript-change-accumulator";

export type ManuscriptBatchingPolicy = {
  readonly maxTransactionsPerBatch: number;
  readonly maxDelayMs: number;
};

export type ManuscriptSaveState =
  | "editing"
  | "saving"
  | "saved"
  | "failed";

export type DurableQueueDocument = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly baseRevisionId: EntityId<"DocumentRevision">;
  readonly nextSequence: number;
};

export type SaveQueueScheduler = {
  schedule(delayMs: number, callback: () => void): unknown;
  cancel(handle: unknown): void;
};

type InFlightBatch = {
  readonly batch: ChangeBatch;
  attempt: Promise<void> | null;
};

type QueueDocumentState = {
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  baseRevisionId: EntityId<"DocumentRevision">;
  nextSequence: number;
  readonly accumulator: ManuscriptChangeAccumulator;
  state: ManuscriptSaveState;
  composing: boolean;
  flushRequested: boolean;
  timer: { readonly handle: unknown } | null;
  inFlight: InFlightBatch | null;
};

export class ManuscriptDurableSaveQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManuscriptDurableSaveQueueError";
  }
}

function assertBatchingPolicy(
  policy: ManuscriptBatchingPolicy,
): void {
  if (
    !Number.isSafeInteger(policy.maxTransactionsPerBatch) ||
    policy.maxTransactionsPerBatch <= 0
  ) {
    throw new Error(
      "maxTransactionsPerBatch must be a positive safe integer",
    );
  }
  if (
    !Number.isSafeInteger(policy.maxDelayMs) ||
    policy.maxDelayMs < 0
  ) {
    throw new Error(
      "maxDelayMs must be a non-negative safe integer",
    );
  }
}

export class ManuscriptDurableSaveQueue {
  readonly #documents = new Map<
    EntityId<"Document">,
    QueueDocumentState
  >();
  readonly #policy: ManuscriptBatchingPolicy;
  readonly #saveChangeBatch: (
    batch: ChangeBatch,
  ) => Promise<SaveReceipt>;
  readonly #createBatchId: () => EntityId<"ChangeBatch">;
  readonly #now: () => Instant;
  readonly #scheduler: SaveQueueScheduler;
  readonly #onStateChange: (
    documentId: EntityId<"Document">,
    state: ManuscriptSaveState,
  ) => void;

  constructor(input: {
    readonly documents: readonly DurableQueueDocument[];
    readonly policy: ManuscriptBatchingPolicy;
    readonly saveChangeBatch: (
      batch: ChangeBatch,
    ) => Promise<SaveReceipt>;
    readonly createBatchId: () => EntityId<"ChangeBatch">;
    readonly now: () => Instant;
    readonly scheduler: SaveQueueScheduler;
    readonly onStateChange: (
      documentId: EntityId<"Document">,
      state: ManuscriptSaveState,
    ) => void;
  }) {
    assertBatchingPolicy(input.policy);
    this.#policy = Object.freeze({ ...input.policy });
    this.#saveChangeBatch = input.saveChangeBatch;
    this.#createBatchId = input.createBatchId;
    this.#now = input.now;
    this.#scheduler = input.scheduler;
    this.#onStateChange = input.onStateChange;

    for (const document of input.documents) {
      if (
        !Number.isSafeInteger(document.nextSequence) ||
        document.nextSequence < 0
      ) {
        throw new Error(
          `Invalid next sequence for durable queue document ${document.documentId}`,
        );
      }
      if (this.#documents.has(document.documentId)) {
        throw new Error(
          `Duplicate durable queue document: ${document.documentId}`,
        );
      }
      this.#documents.set(document.documentId, {
        ...document,
        accumulator: new ManuscriptChangeAccumulator(),
        state: "saved",
        composing: false,
        flushRequested: false,
        timer: null,
        inFlight: null,
      });
    }
  }

  getState(
    documentId: EntityId<"Document">,
  ): ManuscriptSaveState {
    return this.#getDocument(documentId).state;
  }

  record(
    documentId: EntityId<"Document">,
    transaction: ManuscriptTransaction,
    options: { readonly composing: boolean },
  ): Promise<void> | null {
    const document = this.#getDocument(documentId);
    document.accumulator.append(transaction);
    if (transaction.changes.length === 0) {
      return null;
    }

    document.composing = options.composing;
    this.#setState(document, "editing");
    if (document.composing) {
      this.#cancelTimer(document);
      return null;
    }
    if (document.inFlight !== null) {
      if (
        document.accumulator.transactionCount >=
        this.#policy.maxTransactionsPerBatch
      ) {
        document.flushRequested = true;
      }
      return null;
    }
    if (
      document.flushRequested ||
      document.accumulator.transactionCount >=
        this.#policy.maxTransactionsPerBatch
    ) {
      document.flushRequested = false;
      return this.flush(documentId);
    }
    this.#armTimer(document);
    return null;
  }

  compositionEnd(
    documentId: EntityId<"Document">,
  ): Promise<void> | null {
    const document = this.#getDocument(documentId);
    document.composing = false;
    if (document.accumulator.transactionCount === 0) {
      return null;
    }
    if (document.inFlight !== null) {
      return null;
    }
    if (
      document.flushRequested ||
      document.accumulator.transactionCount >=
        this.#policy.maxTransactionsPerBatch
    ) {
      document.flushRequested = false;
      return this.flush(documentId);
    }
    this.#armTimer(document);
    return null;
  }

  flushForClose(
    documentId: EntityId<"Document">,
  ): Promise<void> {
    const document =
      this.#getDocument(documentId);
    if (
      document.composing &&
      document.accumulator
        .transactionCount > 0
    ) {
      return Promise.reject(
        new ManuscriptDurableSaveQueueError(
          `Cannot close while IME composition owns pending text for document ${document.documentId}`,
        ),
      );
    }
    return this.flush(documentId);
  }

  flush(documentId: EntityId<"Document">): Promise<void> {
    const document = this.#getDocument(documentId);
    this.#cancelTimer(document);
    if (document.composing) {
      document.flushRequested = true;
      return Promise.resolve();
    }
    if (document.inFlight !== null) {
      const pendingChanges =
        document.accumulator.transactionCount > 0;
      if (pendingChanges) {
        document.flushRequested = true;
      }
      const attempt =
        document.inFlight.attempt ??
        this.#sendInFlight(document);
      return pendingChanges
        ? attempt.then(() =>
            this.flush(documentId),
          )
        : attempt;
    }
    if (
      document.accumulator.transactionCount > 0 &&
      !Number.isSafeInteger(document.nextSequence + 1)
    ) {
      const error = new ManuscriptDurableSaveQueueError(
        `Sequence cannot advance for document ${document.documentId}`,
      );
      this.#setState(document, "failed");
      return Promise.reject(error);
    }

    const changes = document.accumulator.drain();
    if (changes === null || changes.changes.length === 0) {
      document.flushRequested = false;
      this.#setState(document, "saved");
      return Promise.resolve();
    }
    const batch = parseChangeBatch({
      schemaVersion: 1,
      textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
      batchId: this.#createBatchId(),
      workId: document.workId,
      documentId: document.documentId,
      baseRevisionId: document.baseRevisionId,
      sequence: document.nextSequence,
      createdAt: this.#now(),
      beforeTextLengthUtf16: changes.beforeOffsetLength,
      afterTextLengthUtf16: changes.afterOffsetLength,
      changes: changes.changes,
    });
    document.inFlight = {
      batch,
      attempt: null,
    };
    return this.#sendInFlight(document);
  }

  #sendInFlight(document: QueueDocumentState): Promise<void> {
    const inFlight = document.inFlight;
    if (inFlight === null) {
      throw new ManuscriptDurableSaveQueueError(
        `Document has no in-flight batch: ${document.documentId}`,
      );
    }
    this.#setState(
      document,
      document.accumulator.transactionCount === 0
        ? "saving"
        : "editing",
    );
    const attempt = Promise.resolve()
      .then(() => this.#saveChangeBatch(inFlight.batch))
      .then((receipt) => {
        this.#acceptReceipt(document, inFlight.batch, receipt);
      })
      .catch((error: unknown) => {
        if (document.inFlight === inFlight) {
          inFlight.attempt = null;
          this.#setState(document, "failed");
        }
        throw error;
      });
    inFlight.attempt = attempt;
    return attempt;
  }

  #acceptReceipt(
    document: QueueDocumentState,
    batch: ChangeBatch,
    receipt: SaveReceipt,
  ): void {
    if (
      receipt.workId !== batch.workId ||
      receipt.documentId !== batch.documentId ||
      receipt.baseRevisionId !== batch.baseRevisionId ||
      receipt.batchId !== batch.batchId ||
      receipt.sequence !== batch.sequence
    ) {
      throw new ManuscriptDurableSaveQueueError(
        `SaveReceipt does not identify the requested batch: ${batch.batchId}`,
      );
    }
    if (document.inFlight?.batch !== batch) {
      throw new ManuscriptDurableSaveQueueError(
        `SaveReceipt does not match the current in-flight batch: ${batch.batchId}`,
      );
    }

    document.nextSequence = batch.sequence + 1;
    document.inFlight = null;
    if (document.accumulator.transactionCount === 0) {
      document.flushRequested = false;
      this.#setState(document, "saved");
      return;
    }

    this.#setState(document, "editing");
    if (document.composing) {
      return;
    }
    if (
      document.flushRequested ||
      document.accumulator.transactionCount >=
        this.#policy.maxTransactionsPerBatch
    ) {
      document.flushRequested = false;
      void this.flush(document.documentId).catch(() => undefined);
      return;
    }
    this.#armTimer(document);
  }

  #getDocument(
    documentId: EntityId<"Document">,
  ): QueueDocumentState {
    const document = this.#documents.get(documentId);
    if (document === undefined) {
      throw new ManuscriptDurableSaveQueueError(
        `Unknown durable queue document: ${documentId}`,
      );
    }
    return document;
  }

  #setState(
    document: QueueDocumentState,
    state: ManuscriptSaveState,
  ): void {
    if (document.state === state) {
      return;
    }
    document.state = state;
    this.#onStateChange(document.documentId, state);
  }

  #armTimer(document: QueueDocumentState): void {
    if (
      document.timer !== null ||
      document.composing ||
      document.inFlight !== null ||
      document.accumulator.transactionCount === 0
    ) {
      return;
    }
    const handle = this.#scheduler.schedule(
      this.#policy.maxDelayMs,
      () => {
        document.timer = null;
        void this.flush(document.documentId).catch(() => undefined);
      },
    );
    document.timer = { handle };
  }

  #cancelTimer(document: QueueDocumentState): void {
    if (document.timer === null) {
      return;
    }
    this.#scheduler.cancel(document.timer.handle);
    document.timer = null;
  }
}
