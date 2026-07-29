import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
  type ChangeBatch,
} from "./change-batch";
import {
  DurableChangeBatchSaveConflictError,
  parseSaveReceipt,
  SaveChangeBatch,
  type DurableJournalAppendReceipt,
  type DurableSaveTarget,
  type SaveChangeBatchStage,
} from "./save-change-batch";

function createTarget(input?: {
  readonly text?: string;
  readonly nextSequence?: number;
}): DurableSaveTarget {
  return {
    workId: entityId<"Work">(randomUUID()),
    documentId: entityId<"Document">(randomUUID()),
    baseRevisionId: entityId<"DocumentRevision">(randomUUID()),
    nextSequence: input?.nextSequence ?? randomInt(1, 10_000),
    text: input?.text ?? randomUUID(),
  };
}

function createAppendBatch(input: {
  readonly target: DurableSaveTarget;
  readonly beforeText: string;
  readonly insertedText?: string;
  readonly sequence?: number;
  readonly batchId?: string;
  readonly workId?: string;
  readonly baseRevisionId?: string;
}): ChangeBatch {
  const insertedText = input.insertedText ?? randomUUID();
  return parseChangeBatch({
    schemaVersion: 1,
    textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
    batchId: input.batchId ?? randomUUID(),
    workId: input.workId ?? input.target.workId,
    documentId: input.target.documentId,
    baseRevisionId:
      input.baseRevisionId ?? input.target.baseRevisionId,
    sequence: input.sequence ?? input.target.nextSequence,
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16: input.beforeText.length,
    afterTextLengthUtf16:
      input.beforeText.length + insertedText.length,
    changes: [
      {
        fromUtf16: input.beforeText.length,
        toUtf16: input.beforeText.length,
        insertedText,
      },
    ],
  });
}

function createAppendReceipt(): DurableJournalAppendReceipt {
  const frameStartByteOffset = randomInt(0, 10_000);
  const frameByteLength = randomInt(1, 10_000);
  return {
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

function createCommand(input: {
  readonly targets: readonly DurableSaveTarget[];
  readonly appendPayload?: (
    payload: Uint8Array,
  ) => Promise<DurableJournalAppendReceipt>;
  readonly onStage?: (
    stage: SaveChangeBatchStage,
    batch: ChangeBatch,
  ) => Promise<void>;
}) {
  const validateTarget = {
    execute: vi.fn(async (batch: ChangeBatch) => batch),
  };
  const appendPayload =
    input.appendPayload ??
    vi.fn(async () => createAppendReceipt());
  return {
    command: new SaveChangeBatch({
      targets: input.targets,
      validateTarget,
      appendPayload,
      ...(input.onStage === undefined
        ? {}
        : { onStage: input.onStage }),
    }),
    validateTarget,
    appendPayload,
  };
}

describe("SaveChangeBatch", () => {
  it("reports validation completion and append intent in exact order before durable append", async () => {
    const target = createTarget();
    const batch = createAppendBatch({
      target,
      beforeText: target.text,
    });
    const stages: SaveChangeBatchStage[] = [];
    const { command, appendPayload } = createCommand({
      targets: [target],
      onStage: async (stage, stagedBatch) => {
        expect(stagedBatch).toEqual(batch);
        expect(appendPayload).not.toHaveBeenCalled();
        stages.push(stage);
      },
    });

    await command.execute(batch);

    expect(stages).toEqual([
      "target-validated",
      "before-journal-append",
    ]);
    expect(appendPayload).toHaveBeenCalledOnce();
  });

  it.each([
    "target-validated",
    "before-journal-append",
  ] as const)(
    "does not append or advance when the %s stage gate rejects",
    async (rejectedStage) => {
      const target = createTarget();
      const batch = createAppendBatch({
        target,
        beforeText: target.text,
      });
      const stageFailure = new Error(randomUUID());
      let rejectGate = true;
      const { command, appendPayload } = createCommand({
        targets: [target],
        onStage: async (stage) => {
          if (rejectGate && stage === rejectedStage) {
            throw stageFailure;
          }
        },
      });

      await expect(command.execute(batch)).rejects.toBe(
        stageFailure,
      );
      expect(appendPayload).not.toHaveBeenCalled();

      rejectGate = false;
      await expect(
        command.execute(batch),
      ).resolves.toMatchObject({
        batchId: batch.batchId,
        sequence: batch.sequence,
      });
      expect(appendPayload).toHaveBeenCalledOnce();
    },
  );

  it("strictly parses an exact SaveReceipt", () => {
    const target = createTarget();
    const batch = createAppendBatch({
      target,
      beforeText: target.text,
    });
    const appendReceipt = createAppendReceipt();
    const receipt = {
      workId: batch.workId,
      documentId: batch.documentId,
      baseRevisionId: batch.baseRevisionId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      ...appendReceipt,
    };

    expect(parseSaveReceipt(receipt)).toEqual(receipt);
    expect(() =>
      parseSaveReceipt({
        ...receipt,
        [randomUUID()]: randomUUID(),
      }),
    ).toThrow();
    expect(() =>
      parseSaveReceipt({
        ...receipt,
        frameEndByteOffset:
          receipt.frameEndByteOffset + receipt.frameByteLength,
      }),
    ).toThrow();
  });

  it("returns an exact SaveReceipt only after durable append resolves", async () => {
    const target = createTarget();
    const batch = createAppendBatch({
      target,
      beforeText: target.text,
    });
    const appendReceipt = createAppendReceipt();
    const appendDeferred =
      deferred<DurableJournalAppendReceipt>();
    const appendPayload = vi.fn(() => appendDeferred.promise);
    const { command } = createCommand({
      targets: [target],
      appendPayload,
    });

    let settled = false;
    const pendingReceipt = command.execute(batch).then((receipt) => {
      settled = true;
      return receipt;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(appendPayload).toHaveBeenCalledOnce();
    expect(settled).toBe(false);

    appendDeferred.resolve(appendReceipt);

    await expect(pendingReceipt).resolves.toEqual({
      workId: batch.workId,
      documentId: batch.documentId,
      baseRevisionId: batch.baseRevisionId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      ...appendReceipt,
    });
  });

  it("serializes concurrent sequences and validates the second against the first durable head", async () => {
    const target = createTarget();
    const firstInsertedText = randomUUID();
    const first = createAppendBatch({
      target,
      beforeText: target.text,
      insertedText: firstInsertedText,
    });
    const second = createAppendBatch({
      target,
      beforeText: target.text + firstInsertedText,
      sequence: first.sequence + 1,
    });
    const firstAppend = deferred<DurableJournalAppendReceipt>();
    const appendPayload = vi
      .fn<
        (
          payload: Uint8Array,
        ) => Promise<DurableJournalAppendReceipt>
      >()
      .mockImplementationOnce(() => firstAppend.promise)
      .mockImplementationOnce(async () => createAppendReceipt());
    const { command } = createCommand({
      targets: [target],
      appendPayload,
    });

    const firstPending = command.execute(first);
    const secondPending = command.execute(second);
    await Promise.resolve();
    await Promise.resolve();

    expect(appendPayload).toHaveBeenCalledOnce();

    firstAppend.resolve(createAppendReceipt());

    await expect(firstPending).resolves.toMatchObject({
      batchId: first.batchId,
    });
    await expect(secondPending).resolves.toMatchObject({
      batchId: second.batchId,
    });
    expect(appendPayload).toHaveBeenCalledTimes(2);
  });

  it("returns the first receipt for an exact duplicate without another append", async () => {
    const target = createTarget();
    const batch = createAppendBatch({
      target,
      beforeText: target.text,
    });
    const { command, appendPayload } = createCommand({
      targets: [target],
    });

    const firstReceipt = await command.execute(batch);

    await expect(command.execute(batch)).resolves.toBe(
      firstReceipt,
    );
    expect(appendPayload).toHaveBeenCalledOnce();
  });

  it("rejects a changed payload with an accepted batch identity", async () => {
    const target = createTarget();
    const batchId = randomUUID();
    const accepted = createAppendBatch({
      target,
      beforeText: target.text,
      batchId,
    });
    const conflict = createAppendBatch({
      target,
      beforeText: target.text,
      batchId,
      insertedText: randomUUID(),
    });
    const { command, appendPayload } = createCommand({
      targets: [target],
    });
    await command.execute(accepted);

    await expect(command.execute(conflict)).rejects.toThrow(
      DurableChangeBatchSaveConflictError,
    );
    expect(appendPayload).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: "sequence gap",
      mutate: (target: DurableSaveTarget) => ({
        sequence: target.nextSequence + 1,
      }),
    },
    {
      name: "stale sequence",
      mutate: (target: DurableSaveTarget) => ({
        sequence: target.nextSequence - 1,
      }),
    },
    {
      name: "work boundary",
      mutate: () => ({ workId: randomUUID() }),
    },
    {
      name: "base revision boundary",
      mutate: () => ({ baseRevisionId: randomUUID() }),
    },
  ])("does not append a batch with a $name conflict", async ({ mutate }) => {
    const target = createTarget();
    const batch = createAppendBatch({
      target,
      beforeText: target.text,
      ...mutate(target),
    });
    const { command, appendPayload } = createCommand({
      targets: [target],
    });

    await expect(command.execute(batch)).rejects.toThrow(
      DurableChangeBatchSaveConflictError,
    );
    expect(appendPayload).not.toHaveBeenCalled();
  });

  it("does not advance the journal head when append fails", async () => {
    const target = createTarget();
    const batch = createAppendBatch({
      target,
      beforeText: target.text,
    });
    const appendFailure = new Error(randomUUID());
    const appendPayload = vi
      .fn<
        (
          payload: Uint8Array,
        ) => Promise<DurableJournalAppendReceipt>
      >()
      .mockRejectedValueOnce(appendFailure)
      .mockResolvedValueOnce(createAppendReceipt());
    const { command } = createCommand({
      targets: [target],
      appendPayload,
    });

    await expect(command.execute(batch)).rejects.toBe(
      appendFailure,
    );
    await expect(command.execute(batch)).resolves.toMatchObject({
      batchId: batch.batchId,
      sequence: batch.sequence,
    });
    expect(appendPayload).toHaveBeenCalledTimes(2);
  });

  it("rejects a sequence that cannot advance without appending", async () => {
    const target = createTarget({
      nextSequence: Number.MAX_SAFE_INTEGER,
    });
    const batch = createAppendBatch({
      target,
      beforeText: target.text,
    });
    const { command, appendPayload } = createCommand({
      targets: [target],
    });

    await expect(command.execute(batch)).rejects.toThrow(
      DurableChangeBatchSaveConflictError,
    );
    expect(appendPayload).not.toHaveBeenCalled();
  });
});
