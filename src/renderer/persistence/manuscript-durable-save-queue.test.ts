import { randomInt, randomUUID } from "node:crypto";
import { EditorState } from "@codemirror/state";
import { describe, expect, it, vi } from "vitest";

import type { ChangeBatch } from "../../application/persistence/change-batch";
import type { SaveReceipt } from "../../application/persistence/save-change-batch";
import type {
  SaveManuscriptFormattingCommand,
  SaveManuscriptFormattingReceipt,
} from "../../application/editor/manuscript-formatting";
import { entityId } from "../../domain/writing";
import {
  extractManuscriptTransaction,
  type ManuscriptTransaction,
} from "../editor/manuscript-transaction";
import {
  ManuscriptDurableSaveQueue,
  ManuscriptDurableSaveQueueError,
  type DurableQueueDocument,
  type ManuscriptBatchingPolicy,
  type ManuscriptSaveState,
  type SaveQueueScheduler,
} from "./manuscript-durable-save-queue";

function createDocument(
  nextSequence = randomInt(1, 10_000),
): DurableQueueDocument {
  return {
    workId: entityId<"Work">(randomUUID()),
    documentId: entityId<"Document">(randomUUID()),
    baseRevisionId: entityId<"DocumentRevision">(randomUUID()),
    nextSequence,
  };
}

describe("shared window durable sources", () => {
  it("adopts a clean remote revision and saves from its current sequence and original base", async () => {
    const document = createDocument();
    const saveChangeBatch = vi.fn(async (batch: ChangeBatch) => receiptFor(batch));
    const { queue } = createQueue({ documents: [document], saveChangeBatch });
    const remote = { ...document, currentRevisionId: entityId<"DocumentRevision">(randomUUID()), nextSequence: document.nextSequence + 1 };
    expect(queue.adoptConfirmedDocument(remote)).toBe(true);
    expect(queue.getCurrentRevisionId(document.documentId)).toBe(remote.currentRevisionId);
    queue.record(document.documentId, appendTransaction("remote").transaction, { composing: false });
    await queue.flush(document.documentId);
    expect(saveChangeBatch.mock.calls[0]?.[0]).toMatchObject({ baseRevisionId: document.baseRevisionId, sequence: remote.nextSequence });
  });

  it("preserves an in-progress local composition when another window saves", () => {
    const document = createDocument();
    const { queue } = createQueue({ documents: [document] });
    queue.record(document.documentId, appendTransaction("").transaction, { composing: true });
    expect(queue.adoptConfirmedDocument({ ...document, currentRevisionId: entityId<"DocumentRevision">(randomUUID()) })).toBe(false);
    expect(queue.hasPendingChanges(document.documentId)).toBe(true);
    expect(queue.getCurrentRevisionId(document.documentId)).toBe(document.baseRevisionId);
  });
});

function appendTransaction(
  beforeText: string,
  insertedText = randomUUID(),
): {
  readonly transaction: ManuscriptTransaction;
  readonly afterText: string;
} {
  const state = EditorState.create({ doc: beforeText });
  const transaction = state.update({
    changes: {
      from: state.doc.length,
      insert: insertedText,
    },
  });
  return {
    transaction: extractManuscriptTransaction(transaction),
    afterText: transaction.state.doc.toString(),
  };
}

function replacementTransaction(
  beforeText: string,
): {
  readonly transaction: ManuscriptTransaction;
  readonly afterText: string;
} {
  const state = EditorState.create({ doc: beforeText });
  const from = randomInt(0, state.doc.length);
  const to = randomInt(from + 1, state.doc.length + 1);
  const transaction = state.update({
    changes: {
      from,
      to,
      insert: randomUUID(),
    },
  });
  return {
    transaction: extractManuscriptTransaction(transaction),
    afterText: transaction.state.doc.toString(),
  };
}

function receiptFor(batch: ChangeBatch): SaveReceipt {
  const frameStartByteOffset = randomInt(0, 10_000);
  const frameByteLength = randomInt(1, 10_000);
  return {
    workId: batch.workId,
    documentId: batch.documentId,
    baseRevisionId: batch.baseRevisionId,
    batchId: batch.batchId,
    sequence: batch.sequence,
    frameStartByteOffset,
    frameEndByteOffset:
      frameStartByteOffset + frameByteLength,
    frameByteLength,
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value) {
      if (resolvePromise === undefined) {
        throw new Error("Deferred promise was not initialized");
      }
      resolvePromise(value);
    },
  };
}

function createFakeScheduler(): {
  readonly scheduler: SaveQueueScheduler;
  readonly runNext: () => void;
  readonly scheduledDelays: () => readonly number[];
} {
  let nextHandle = randomInt(1, 10_000);
  const callbacks = new Map<number, () => void>();
  const delays = new Map<number, number>();
  return {
    scheduler: {
      schedule(delayMs, callback) {
        const handle = nextHandle;
        nextHandle += 1;
        callbacks.set(handle, callback);
        delays.set(handle, delayMs);
        return handle;
      },
      cancel(handle) {
        if (typeof handle === "number") {
          callbacks.delete(handle);
          delays.delete(handle);
        }
      },
    },
    runNext() {
      const entry = callbacks.entries().next().value as
        | [number, () => void]
        | undefined;
      if (entry === undefined) {
        throw new Error("No scheduled save callback is available");
      }
      const [handle, callback] = entry;
      callbacks.delete(handle);
      delays.delete(handle);
      callback();
    },
    scheduledDelays() {
      return Object.freeze([...delays.values()]);
    },
  };
}

function createQueue(input: {
  readonly documents: readonly DurableQueueDocument[];
  readonly policy?: ManuscriptBatchingPolicy;
  readonly saveChangeBatch?: (
    batch: ChangeBatch,
    editorStateJson: string | null,
  ) => Promise<SaveReceipt>;
  readonly saveFormatting?: (
    command: SaveManuscriptFormattingCommand,
  ) => Promise<SaveManuscriptFormattingReceipt>;
}) {
  const maxTransactionsPerBatch =
    input.policy?.maxTransactionsPerBatch ?? randomInt(2, 8);
  const maxDelayMs =
    input.policy?.maxDelayMs ?? randomInt(1, 10_000);
  const policy = {
    maxTransactionsPerBatch,
    maxDelayMs,
  };
  const scheduler = createFakeScheduler();
  const stateChanges: Array<{
    readonly documentId: DurableQueueDocument["documentId"];
    readonly state: ManuscriptSaveState;
  }> = [];
  const saveChangeBatch =
    input.saveChangeBatch ??
    vi.fn(async (batch: ChangeBatch) => receiptFor(batch));
  const queue = new ManuscriptDurableSaveQueue({
    documents: input.documents,
    policy,
    saveChangeBatch,
    ...(input.saveFormatting === undefined
      ? {}
      : { saveFormatting: input.saveFormatting }),
    createBatchId: () =>
      entityId<"ChangeBatch">(randomUUID()),
    now: () => new Date().toISOString(),
    scheduler: scheduler.scheduler,
    onStateChange(documentId, state) {
      stateChanges.push({ documentId, state });
    },
  });
  return {
    queue,
    policy,
    scheduler,
    saveChangeBatch,
    stateChanges,
  };
}

describe("ManuscriptDurableSaveQueue", () => {
  it("stores the latest editor state with text and sequences later formatting after its revision", async () => {
    const document = createDocument(0);
    const textRevisionId = entityId<"DocumentRevision">(randomUUID());
    const formattingRevisionId = entityId<"DocumentRevision">(randomUUID());
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch) => ({
        workId: batch.workId,
        documentId: batch.documentId,
        baseRevisionId: batch.baseRevisionId,
        batchId: batch.batchId,
        sequence: batch.sequence,
        revisionId: textRevisionId,
      }),
    );
    const saveFormatting = vi.fn(
      async (
        command: SaveManuscriptFormattingCommand,
      ): Promise<SaveManuscriptFormattingReceipt> => ({
        schemaVersion: 1,
        workId: command.workId,
        documentId: command.documentId,
        revisionId: formattingRevisionId,
      }),
    );
    const { queue } = createQueue({
      documents: [document],
      policy: {
        maxTransactionsPerBatch: 8,
        maxDelayMs: 100,
      },
      saveChangeBatch,
      saveFormatting,
    });
    const edit = appendTransaction("");
    const stateAtText = JSON.stringify({ revision: "text" });
    const stateAtFormatting = JSON.stringify({ revision: "formatting" });
    queue.record(document.documentId, edit.transaction, {
      composing: false,
      editorStateJson: stateAtText,
    });

    const textSave = queue.recordFormatting(
      document.documentId,
      stateAtFormatting,
    );
    await textSave;

    expect(saveChangeBatch).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: document.documentId }),
      stateAtFormatting,
    );
    expect(saveFormatting).not.toHaveBeenCalled();
    expect(queue.getCurrentRevisionId(document.documentId)).toBe(
      textRevisionId,
    );

    const formattingSave = queue.recordFormatting(
      document.documentId,
      stateAtFormatting,
    );
    await formattingSave;
    expect(saveFormatting).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId: document.workId,
      documentId: document.documentId,
      expectedCurrentRevisionId: textRevisionId,
      editorStateJson: stateAtFormatting,
    });
    expect(queue.getCurrentRevisionId(document.documentId)).toBe(
      formattingRevisionId,
    );
  });

  it("flushes one composed batch at the caller transaction-count boundary", async () => {
    const document = createDocument();
    const maxTransactionsPerBatch = randomInt(2, 7);
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch) => receiptFor(batch),
    );
    const { queue, stateChanges } = createQueue({
      documents: [document],
      policy: {
        maxTransactionsPerBatch,
        maxDelayMs: randomInt(1, 10_000),
      },
      saveChangeBatch,
    });
    let text: string = randomUUID();
    let autoFlush: Promise<void> | null = null;

    for (
      let index = 0;
      index < maxTransactionsPerBatch;
      index += 1
    ) {
      const edit = replacementTransaction(text);
      autoFlush = queue.record(
        document.documentId,
        edit.transaction,
        { composing: false },
      );
      text = edit.afterText;
      if (index < maxTransactionsPerBatch - 1) {
        expect(saveChangeBatch).not.toHaveBeenCalled();
        expect(autoFlush).toBeNull();
      }
    }

    expect(autoFlush).not.toBeNull();
    await autoFlush;
    expect(saveChangeBatch).toHaveBeenCalledOnce();
    expect(saveChangeBatch.mock.calls[0]?.[0]).toMatchObject({
      workId: document.workId,
      documentId: document.documentId,
      baseRevisionId: document.baseRevisionId,
      sequence: document.nextSequence,
    });
    expect(stateChanges.map(({ state }) => state)).toEqual(
      expect.arrayContaining(["editing", "saving", "saved"]),
    );
    expect(queue.getState(document.documentId)).toBe("saved");
  });

  it("uses the exact caller delay when the size boundary is not reached", async () => {
    const document = createDocument();
    const maxDelayMs = randomInt(1, 10_000);
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch) => receiptFor(batch),
    );
    const { queue, scheduler } = createQueue({
      documents: [document],
      policy: {
        maxTransactionsPerBatch: randomInt(2, 8),
        maxDelayMs,
      },
      saveChangeBatch,
    });
    const edit = appendTransaction(randomUUID());

    expect(
      queue.record(document.documentId, edit.transaction, {
        composing: false,
      }),
    ).toBeNull();
    expect(scheduler.scheduledDelays()).toEqual([maxDelayMs]);

    scheduler.runNext();
    await vi.waitFor(() =>
      expect(saveChangeBatch).toHaveBeenCalledOnce(),
    );
    await vi.waitFor(() =>
      expect(queue.getState(document.documentId)).toBe("saved"),
    );
  });

  it("holds size and explicit flush requests until IME composition ends", async () => {
    const document = createDocument();
    const maxTransactionsPerBatch = randomInt(1, 6);
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch) => receiptFor(batch),
    );
    const { queue, scheduler } = createQueue({
      documents: [document],
      policy: {
        maxTransactionsPerBatch,
        maxDelayMs: randomInt(1, 10_000),
      },
      saveChangeBatch,
    });
    let text: string = randomUUID();
    for (
      let index = 0;
      index < maxTransactionsPerBatch;
      index += 1
    ) {
      const edit = appendTransaction(text);
      expect(
        queue.record(document.documentId, edit.transaction, {
          composing: true,
        }),
      ).toBeNull();
      text = edit.afterText;
    }
    await queue.flush(document.documentId);

    expect(saveChangeBatch).not.toHaveBeenCalled();
    expect(scheduler.scheduledDelays()).toEqual([]);

    const compositionFlush = queue.compositionEnd(
      document.documentId,
    );
    expect(compositionFlush).not.toBeNull();
    await compositionFlush;
    expect(saveChangeBatch).toHaveBeenCalledOnce();
    expect(queue.getState(document.documentId)).toBe("saved");
  });

  it("rejects navigation instead of retaining an unbounded IME wait", async () => {
    const document = createDocument();
    const saveGate = deferred<SaveReceipt>();
    const saveChangeBatch = vi.fn(
      (batch: ChangeBatch) => saveGate.promise.then((receipt) => ({
        ...receipt,
        workId: batch.workId,
        documentId: batch.documentId,
        baseRevisionId: batch.baseRevisionId,
        batchId: batch.batchId,
        sequence: batch.sequence,
      })),
    );
    const { queue } = createQueue({
      documents: [document],
      saveChangeBatch,
    });
    const edit = appendTransaction(randomUUID());
    queue.record(document.documentId, edit.transaction, {
      composing: true,
      editorStateJson: randomUUID(),
    });

    await expect(
      queue.flushForNavigation(document.documentId),
    ).rejects.toThrow(ManuscriptDurableSaveQueueError);
    expect(saveChangeBatch).not.toHaveBeenCalled();

    const compositionFlush = queue.compositionEnd(document.documentId);
    expect(compositionFlush).not.toBeNull();
    await Promise.resolve();
    expect(saveChangeBatch).toHaveBeenCalledOnce();

    const batch = saveChangeBatch.mock.calls[0]![0];
    saveGate.resolve(receiptFor(batch));
    await expect(compositionFlush).resolves.toBeUndefined();
    await expect(
      queue.flushForNavigation(document.documentId),
    ).resolves.toBeUndefined();
    expect(queue.getState(document.documentId)).toBe("saved");
  });

  it("rejects a close flush while IME still owns pending composed text", async () => {
    const document = createDocument();
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch) =>
        receiptFor(batch),
    );
    const { queue } = createQueue({
      documents: [document],
      saveChangeBatch,
    });
    const edit =
      appendTransaction(randomUUID());
    queue.record(
      document.documentId,
      edit.transaction,
      { composing: true },
    );

    await expect(
      queue.flushForClose(
        document.documentId,
      ),
    ).rejects.toThrow(
      ManuscriptDurableSaveQueueError,
    );
    expect(saveChangeBatch).not.toHaveBeenCalled();
    expect(
      queue.getState(document.documentId),
    ).toBe("editing");
  });

  it("retains a failed immutable in-flight batch for explicit retry", async () => {
    const document = createDocument();
    const failure = new Error(randomUUID());
    const saveChangeBatch = vi
      .fn<(batch: ChangeBatch) => Promise<SaveReceipt>>()
      .mockRejectedValueOnce(failure)
      .mockImplementationOnce(async (batch) =>
        receiptFor(batch),
      );
    const { queue } = createQueue({
      documents: [document],
      policy: {
        maxTransactionsPerBatch: randomInt(2, 8),
        maxDelayMs: randomInt(1, 10_000),
      },
      saveChangeBatch,
    });
    const edit = appendTransaction(randomUUID());
    expect(queue.record(
      document.documentId,
      edit.transaction,
      { composing: false },
    )).toBeNull();
    const firstAttempt = queue.flush(document.documentId);

    await expect(firstAttempt).rejects.toBe(failure);
    expect(queue.getState(document.documentId)).toBe("failed");
    const firstBatch = saveChangeBatch.mock.calls[0]?.[0];

    await queue.flush(document.documentId);

    expect(saveChangeBatch.mock.calls[1]?.[0]).toBe(firstBatch);
    expect(queue.getState(document.documentId)).toBe("saved");
  });

  it("keeps edits made during an in-flight save in the next sequence", async () => {
    const document = createDocument();
    const firstReceipt = deferred<SaveReceipt>();
    const saveChangeBatch = vi
      .fn<(batch: ChangeBatch) => Promise<SaveReceipt>>()
      .mockImplementationOnce(() => firstReceipt.promise)
      .mockImplementationOnce(async (batch) =>
        receiptFor(batch),
      );
    const { queue } = createQueue({
      documents: [document],
      policy: {
        maxTransactionsPerBatch: randomInt(2, 8),
        maxDelayMs: randomInt(1, 10_000),
      },
      saveChangeBatch,
    });
    const firstEdit = appendTransaction(randomUUID());
    expect(queue.record(
      document.documentId,
      firstEdit.transaction,
      { composing: false },
    )).toBeNull();
    const firstAttempt = queue.flush(document.documentId);
    await vi.waitFor(() =>
      expect(saveChangeBatch).toHaveBeenCalledOnce(),
    );
    const firstBatch = saveChangeBatch.mock.calls[0]?.[0];
    if (firstBatch === undefined) {
      throw new Error("First in-flight batch was not captured");
    }
    const secondEdit = appendTransaction(firstEdit.afterText);

    expect(
      queue.record(
        document.documentId,
        secondEdit.transaction,
        { composing: false },
      ),
    ).toBeNull();
    expect(queue.getState(document.documentId)).toBe("editing");
    expect(saveChangeBatch).toHaveBeenCalledOnce();

    firstReceipt.resolve(receiptFor(firstBatch));
    await firstAttempt;
    expect(queue.getState(document.documentId)).toBe("editing");

    await queue.flush(document.documentId);

    const secondBatch = saveChangeBatch.mock.calls[1]?.[0];
    expect(secondBatch).toMatchObject({
      sequence: firstBatch.sequence + 1,
      beforeTextLengthUtf16:
        firstBatch.afterTextLengthUtf16,
    });
    expect(queue.getState(document.documentId)).toBe("saved");
  });

  it("keeps an explicit flush active through edits queued behind an in-flight save", async () => {
    const document = createDocument();
    const firstReceipt = deferred<SaveReceipt>();
    const saveChangeBatch = vi
      .fn<(batch: ChangeBatch) => Promise<SaveReceipt>>()
      .mockImplementationOnce(() => firstReceipt.promise)
      .mockImplementationOnce(async (batch) =>
        receiptFor(batch),
      );
    const { queue, scheduler } = createQueue({
      documents: [document],
      policy: {
        maxTransactionsPerBatch: randomInt(2, 8),
        maxDelayMs: randomInt(1, 10_000),
      },
      saveChangeBatch,
    });
    const firstEdit = appendTransaction(randomUUID());
    queue.record(
      document.documentId,
      firstEdit.transaction,
      { composing: false },
    );
    const firstAttempt = queue.flush(document.documentId);
    await vi.waitFor(() =>
      expect(saveChangeBatch).toHaveBeenCalledOnce(),
    );
    const firstBatch = saveChangeBatch.mock.calls[0]?.[0];
    if (firstBatch === undefined) {
      throw new Error("First in-flight batch was not captured");
    }
    const secondEdit = appendTransaction(firstEdit.afterText);
    queue.record(
      document.documentId,
      secondEdit.transaction,
      { composing: false },
    );

    const explicitFlush = queue.flush(document.documentId);
    firstReceipt.resolve(receiptFor(firstBatch));
    await firstAttempt;
    await explicitFlush;

    expect(saveChangeBatch).toHaveBeenCalledTimes(2);
    expect(scheduler.scheduledDelays()).toEqual([]);
    expect(queue.getState(document.documentId)).toBe("saved");
  });

  it("fails without advancing when a receipt identifies another batch", async () => {
    const document = createDocument();
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch): Promise<SaveReceipt> => ({
        ...receiptFor(batch),
        batchId: entityId<"ChangeBatch">(randomUUID()),
      }),
    );
    const { queue } = createQueue({
      documents: [document],
      policy: {
        maxTransactionsPerBatch: randomInt(2, 8),
        maxDelayMs: randomInt(1, 10_000),
      },
      saveChangeBatch,
    });
    const edit = appendTransaction(randomUUID());
    expect(queue.record(
      document.documentId,
      edit.transaction,
      { composing: false },
    )).toBeNull();
    const attempt = queue.flush(document.documentId);

    await expect(attempt).rejects.toThrow(
      ManuscriptDurableSaveQueueError,
    );
    expect(queue.getState(document.documentId)).toBe("failed");
  });

  it("does not fall back when a document is not registered", () => {
    const document = createDocument();
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch) => receiptFor(batch),
    );
    const { queue } = createQueue({
      documents: [document],
      saveChangeBatch,
    });
    const edit = appendTransaction(randomUUID());

    expect(() =>
      queue.record(
        entityId<"Document">(randomUUID()),
        edit.transaction,
        { composing: false },
      ),
    ).toThrow(ManuscriptDurableSaveQueueError);
    expect(saveChangeBatch).not.toHaveBeenCalled();
  });

  it("registers a newly created document and saves its first exact batch", async () => {
    const existingDocument = createDocument();
    const createdDocument = createDocument(0);
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch) => receiptFor(batch),
    );
    const { queue } = createQueue({
      documents: [existingDocument],
      saveChangeBatch,
    });
    queue.registerDocument(createdDocument);
    const edit = appendTransaction("");

    expect(
      queue.record(createdDocument.documentId, edit.transaction, {
        composing: false,
      }),
    ).toBeNull();
    await queue.flush(createdDocument.documentId);

    expect(saveChangeBatch).toHaveBeenCalledTimes(1);
    expect(saveChangeBatch.mock.calls[0]?.[0]).toMatchObject({
      workId: createdDocument.workId,
      documentId: createdDocument.documentId,
      baseRevisionId: createdDocument.baseRevisionId,
      sequence: 0,
    });
    expect(queue.getState(createdDocument.documentId)).toBe("saved");
  });

  it("retains pending changes when the next sequence is not representable", async () => {
    const document = createDocument(Number.MAX_SAFE_INTEGER);
    const saveChangeBatch = vi.fn(
      async (batch: ChangeBatch) => receiptFor(batch),
    );
    const { queue } = createQueue({
      documents: [document],
      saveChangeBatch,
    });
    const edit = appendTransaction(randomUUID());
    expect(
      queue.record(document.documentId, edit.transaction, {
        composing: false,
      }),
    ).toBeNull();

    await expect(
      queue.flush(document.documentId),
    ).rejects.toThrow(ManuscriptDurableSaveQueueError);
    await expect(
      queue.flush(document.documentId),
    ).rejects.toThrow(ManuscriptDurableSaveQueueError);
    expect(saveChangeBatch).not.toHaveBeenCalled();
    expect(queue.getState(document.documentId)).toBe("failed");
  });
});
