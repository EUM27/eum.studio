import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
  type ChangeBatch,
} from "../../application/persistence/change-batch";
import type { SaveReceipt } from "../../application/persistence/save-change-batch";
import type {
  SaveManuscriptFormattingCommand,
  SaveManuscriptFormattingReceipt,
} from "../../application/editor/manuscript-formatting";
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

type InFlightTextSave = {
  readonly kind: "text";
  readonly batch: ChangeBatch;
  readonly editorStateJson: string | null;
  attempt: Promise<void> | null;
};

type InFlightFormattingSave = {
  readonly kind: "formatting";
  readonly command: SaveManuscriptFormattingCommand;
  attempt: Promise<void> | null;
};

type InFlightSave = InFlightTextSave | InFlightFormattingSave;

type QueueDocumentState = {
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  baseRevisionId: EntityId<"DocumentRevision">;
  currentRevisionId: EntityId<"DocumentRevision">;
  nextSequence: number;
  readonly accumulator: ManuscriptChangeAccumulator;
  state: ManuscriptSaveState;
  composing: boolean;
  flushRequested: boolean;
  timer: { readonly handle: unknown } | null;
  pendingEditorStateJson: string | null;
  pendingFormattingJson: string | null;
  inFlight: InFlightSave | null;
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
    editorStateJson: string | null,
  ) => Promise<SaveReceipt>;
  readonly #saveFormatting: ((
    command: SaveManuscriptFormattingCommand,
  ) => Promise<SaveManuscriptFormattingReceipt>) | null;
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
      editorStateJson: string | null,
    ) => Promise<SaveReceipt>;
    readonly saveFormatting?: (
      command: SaveManuscriptFormattingCommand,
    ) => Promise<SaveManuscriptFormattingReceipt>;
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
    this.#saveFormatting = input.saveFormatting ?? null;
    this.#createBatchId = input.createBatchId;
    this.#now = input.now;
    this.#scheduler = input.scheduler;
    this.#onStateChange = input.onStateChange;

    for (const document of input.documents) {
      this.registerDocument(document);
    }
  }

  registerDocument(document: DurableQueueDocument): void {
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
      currentRevisionId: document.baseRevisionId,
      accumulator: new ManuscriptChangeAccumulator(),
      state: "saved",
      composing: false,
      flushRequested: false,
      timer: null,
      pendingEditorStateJson: null,
      pendingFormattingJson: null,
      inFlight: null,
    });
  }

  getState(
    documentId: EntityId<"Document">,
  ): ManuscriptSaveState {
    return this.#getDocument(documentId).state;
  }

  getCurrentRevisionId(
    documentId: EntityId<"Document">,
  ): EntityId<"DocumentRevision"> {
    return this.#getDocument(documentId).currentRevisionId;
  }

  hasPendingChanges(
    documentId: EntityId<"Document">,
  ): boolean {
    const document = this.#getDocument(documentId);
    return (
      document.accumulator.transactionCount > 0 ||
      document.pendingFormattingJson !== null ||
      document.inFlight !== null
    );
  }

  record(
    documentId: EntityId<"Document">,
    transaction: ManuscriptTransaction,
    options: {
      readonly composing: boolean;
      readonly editorStateJson?: string;
    },
  ): Promise<void> | null {
    const document = this.#getDocument(documentId);
    document.accumulator.append(transaction);
    if (transaction.changes.length === 0) {
      return null;
    }

    if (options.editorStateJson !== undefined) {
      document.pendingEditorStateJson = options.editorStateJson;
      document.pendingFormattingJson = null;
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

  recordFormatting(
    documentId: EntityId<"Document">,
    editorStateJson: string,
  ): Promise<void> | null {
    const document = this.#getDocument(documentId);
    if (editorStateJson.length === 0) {
      throw new ManuscriptDurableSaveQueueError(
        `Editor state is empty for document ${documentId}`,
      );
    }
    if (document.accumulator.transactionCount > 0) {
      document.pendingEditorStateJson = editorStateJson;
      document.pendingFormattingJson = null;
    } else {
      document.pendingFormattingJson = editorStateJson;
    }
    this.#setState(document, "editing");
    if (document.composing || document.inFlight !== null) {
      return null;
    }
    return this.flush(documentId);
  }

  compositionEnd(
    documentId: EntityId<"Document">,
  ): Promise<void> | null {
    const document = this.#getDocument(documentId);
    document.composing = false;
    if (
      document.accumulator.transactionCount === 0 &&
      document.pendingFormattingJson === null
    ) {
      return null;
    }
    if (document.inFlight !== null) {
      return null;
    }
    if (
      document.flushRequested ||
      document.pendingFormattingJson !== null ||
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
        document.accumulator.transactionCount > 0 ||
        document.pendingFormattingJson !== null;
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
    if (changes !== null && changes.changes.length > 0) {
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
      const editorStateJson = document.pendingEditorStateJson;
      document.pendingEditorStateJson = null;
      document.inFlight = {
        kind: "text",
        batch,
        editorStateJson,
        attempt: null,
      };
      return this.#sendInFlight(document);
    }
    if (
      document.pendingFormattingJson !== null &&
      this.#saveFormatting !== null
    ) {
      const command: SaveManuscriptFormattingCommand = Object.freeze({
        schemaVersion: 1,
        workId: document.workId,
        documentId: document.documentId,
        expectedCurrentRevisionId: document.currentRevisionId,
        editorStateJson: document.pendingFormattingJson,
      });
      document.pendingFormattingJson = null;
      document.inFlight = {
        kind: "formatting",
        command,
        attempt: null,
      };
      return this.#sendInFlight(document);
    }
    document.pendingFormattingJson = null;
    document.flushRequested = false;
    this.#setState(document, "saved");
    return Promise.resolve();
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
    const saveAttempt =
      inFlight.kind === "text"
        ? Promise.resolve()
            .then(() =>
              this.#saveChangeBatch(
                inFlight.batch,
                inFlight.editorStateJson,
              ),
            )
            .then((receipt) => {
              this.#acceptTextReceipt(document, inFlight, receipt);
            })
        : Promise.resolve()
            .then(() => {
              if (this.#saveFormatting === null) {
                throw new ManuscriptDurableSaveQueueError(
                  "Formatting persistence is unavailable",
                );
              }
              return this.#saveFormatting(inFlight.command);
            })
            .then((receipt) => {
              this.#acceptFormattingReceipt(document, inFlight, receipt);
            });
    const attempt = saveAttempt
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

  #acceptTextReceipt(
    document: QueueDocumentState,
    inFlight: InFlightTextSave,
    receipt: SaveReceipt,
  ): void {
    const { batch } = inFlight;
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
    if (document.inFlight !== inFlight) {
      throw new ManuscriptDurableSaveQueueError(
        `SaveReceipt does not match the current in-flight batch: ${batch.batchId}`,
      );
    }

    document.nextSequence = batch.sequence + 1;
    if ("revisionId" in receipt) {
      document.currentRevisionId = receipt.revisionId;
    }
    document.inFlight = null;
    this.#continueAfterReceipt(document);
  }

  #acceptFormattingReceipt(
    document: QueueDocumentState,
    inFlight: InFlightFormattingSave,
    receipt: SaveManuscriptFormattingReceipt,
  ): void {
    if (
      receipt.workId !== inFlight.command.workId ||
      receipt.documentId !== inFlight.command.documentId ||
      document.inFlight !== inFlight
    ) {
      throw new ManuscriptDurableSaveQueueError(
        `Formatting receipt does not identify document ${document.documentId}`,
      );
    }
    document.currentRevisionId = receipt.revisionId;
    document.inFlight = null;
    this.#continueAfterReceipt(document);
  }

  #continueAfterReceipt(document: QueueDocumentState): void {
    if (
      document.accumulator.transactionCount === 0 &&
      document.pendingFormattingJson === null
    ) {
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
      document.pendingFormattingJson !== null ||
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
