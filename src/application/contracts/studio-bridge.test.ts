import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
  MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
  MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
  MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
  MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
  MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
  RUNTIME_INFO_CHANNEL,
  createStudioBridge as createStudioBridgeContract,
  isRuntimeInfo,
  type BridgeInvoke,
  type BridgeListen,
} from "./studio-bridge";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
} from "../persistence/change-batch";
import {
  createApplyStartupRecoveryCommand,
} from "../persistence/startup-recovery-contract";
import type { StartupRecoveryCandidate } from "../persistence/prepare-startup-recovery";
import { entityId } from "../../domain/writing";

const ignoreBridgeEvents: BridgeListen =
  () => () => undefined;

function createStudioBridge(
  invoke: BridgeInvoke,
) {
  return createStudioBridgeContract(
    invoke,
    ignoreBridgeEvents,
  );
}

describe("studio bridge contract", () => {
  it("wraps the allowlisted runtime query without exposing a generic sender", async () => {
    const runtimeInfo = {
      appName: randomUUID(),
      appVersion: randomUUID(),
      platform: randomUUID(),
      architecture: randomUUID(),
    };
    const invoke = vi.fn().mockResolvedValue(runtimeInfo);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.system.getRuntimeInfo()).resolves.toEqual(runtimeInfo);
    expect(invoke).toHaveBeenCalledWith(RUNTIME_INFO_CHANNEL);
    expect("send" in bridge).toBe(false);
    expect("invoke" in bridge).toBe(false);
  });

  it("rejects malformed main-process responses", async () => {
    const bridge = createStudioBridge(async () => ({ appName: randomUUID() }));

    await expect(bridge.system.getRuntimeInfo()).rejects.toThrow(
      "Invalid runtime information",
    );
  });

  it("wraps the allowlisted manuscript input profile query", async () => {
    const inputProfile = {
      schemaVersion: 1,
      autoClosePairs: [
        {
          open: randomUUID(),
          close: randomUUID(),
        },
      ],
      textReplacements: [
        {
          trigger: randomUUID(),
          replacement: randomUUID(),
        },
      ],
    } as const;
    const invoke = vi.fn().mockResolvedValue(inputProfile);
    const bridge = createStudioBridge(invoke);

    await expect(bridge.editor.getManuscriptInputProfile()).resolves.toEqual(
      inputProfile,
    );
    expect(invoke).toHaveBeenCalledWith(MANUSCRIPT_INPUT_PROFILE_CHANNEL);
  });

  it("wraps the allowlisted manuscript document profile query", async () => {
    const document = {
      workId: randomUUID(),
      documentId: randomUUID(),
      documentRevisionId: randomUUID(),
      label: randomUUID(),
      initialText: randomUUID(),
    };
    const documentProfile = {
      schemaVersion: 1,
      initialDocumentId: document.documentId,
      documents: [document],
    };
    const invoke = vi.fn().mockResolvedValue(documentProfile);
    const bridge = createStudioBridge(invoke);
    const readDocumentProfile = Reflect.get(
      bridge.editor,
      "getManuscriptDocumentProfile",
    );

    expect(readDocumentProfile).toBeTypeOf("function");
    if (typeof readDocumentProfile !== "function") {
      return;
    }
    await expect(readDocumentProfile()).resolves.toEqual(documentProfile);
    expect(invoke).toHaveBeenCalledWith(
      "studio:editor:get-manuscript-document-profile",
    );
  });

  it("strictly invokes the allowlisted durable manuscript save command", async () => {
    const beforeText = randomUUID();
    const insertedText = randomUUID();
    const batch = parseChangeBatch({
      schemaVersion: 1,
      textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
      batchId: randomUUID(),
      workId: randomUUID(),
      documentId: randomUUID(),
      baseRevisionId: randomUUID(),
      sequence: Number.parseInt(randomUUID().slice(0, 6), 16),
      createdAt: new Date().toISOString(),
      beforeTextLengthUtf16: beforeText.length,
      afterTextLengthUtf16:
        beforeText.length + insertedText.length,
      changes: [
        {
          fromUtf16: beforeText.length,
          toUtf16: beforeText.length,
          insertedText,
        },
      ],
    });
    const frameStartByteOffset = Number.parseInt(
      randomUUID().slice(0, 6),
      16,
    );
    const frameByteLength =
      Number.parseInt(randomUUID().slice(0, 4), 16) + 1;
    const receipt = {
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
    const invoke = vi.fn().mockResolvedValue(receipt);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.saveChangeBatch(batch),
    ).resolves.toEqual(receipt);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
      batch,
    );
  });

  it("rejects a malformed durable save receipt", async () => {
    const beforeText = randomUUID();
    const insertedText = randomUUID();
    const batch = parseChangeBatch({
      schemaVersion: 1,
      textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
      batchId: randomUUID(),
      workId: randomUUID(),
      documentId: randomUUID(),
      baseRevisionId: randomUUID(),
      sequence: Number.parseInt(randomUUID().slice(0, 6), 16),
      createdAt: new Date().toISOString(),
      beforeTextLengthUtf16: beforeText.length,
      afterTextLengthUtf16:
        beforeText.length + insertedText.length,
      changes: [
        {
          fromUtf16: beforeText.length,
          toUtf16: beforeText.length,
          insertedText,
        },
      ],
    });
    const bridge = createStudioBridge(async () => ({
      batchId: batch.batchId,
    }));

    await expect(
      bridge.editor.saveChangeBatch(batch),
    ).rejects.toThrow("Invalid save receipt");
  });

  it("reads only the renderer persistence projection", async () => {
    const profile = {
      schemaVersion: 1,
      batching: {
        schemaVersion: 1,
        maxTransactionsPerBatch:
          Number.parseInt(randomUUID().slice(0, 4), 16) + 1,
        maxDelayMs: Number.parseInt(
          randomUUID().slice(0, 4),
          16,
        ),
      },
      documentSequences: [
        {
          documentId: randomUUID(),
          nextSequence: Number.parseInt(
            randomUUID().slice(0, 6),
            16,
          ),
        },
      ],
    };
    const invoke = vi.fn().mockResolvedValue(profile);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.getManuscriptPersistenceProfile(),
    ).resolves.toEqual(profile);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
    );
    expect("journalPath" in profile).toBe(false);
    expect("checksumAlgorithm" in profile).toBe(false);
  });

  it("preserves unavailable persistence and rejects malformed projections", async () => {
    const unavailableBridge = createStudioBridge(async () => null);
    await expect(
      unavailableBridge.editor.getManuscriptPersistenceProfile(),
    ).resolves.toBeNull();

    const malformedBridge = createStudioBridge(async () => ({
      schemaVersion: 1,
      journalPath: randomUUID(),
    }));
    await expect(
      malformedBridge.editor.getManuscriptPersistenceProfile(),
    ).rejects.toThrow("Invalid manuscript persistence profile");
  });

  it("wraps the allowlisted startup recovery query and strictly parses its response", async () => {
    const recovery = {
      schemaVersion: 1,
      status: "clean",
      issues: [],
    } as const;
    const invoke = vi.fn().mockResolvedValue(recovery);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.getManuscriptStartupRecovery(),
    ).resolves.toEqual(recovery);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
    );

    const malformed = createStudioBridge(
      async () => ({
        ...recovery,
        [randomUUID()]: randomUUID(),
      }),
    );
    await expect(
      malformed.editor.getManuscriptStartupRecovery(),
    ).rejects.toThrow(
      "Invalid manuscript startup recovery",
    );
  });

  it("reads only a strictly parsed resume checkpoint projection", async () => {
    const projection = {
      schemaVersion: 1,
      status: "resolved",
      workId: randomUUID(),
      documentId: randomUUID(),
      targetRevisionId: randomUUID(),
      selection: {
        anchor:
          Number.parseInt(
            randomUUID().slice(0, 4),
            16,
          ),
        head:
          Number.parseInt(
            randomUUID().slice(0, 4),
            16,
          ),
      },
    } as const;
    const invoke =
      vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.getManuscriptResumeCheckpoint(),
    ).resolves.toEqual(projection);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
    );

    const malformed =
      createStudioBridge(async () => ({
        ...projection,
        move: null,
      }));
    await expect(
      malformed.editor.getManuscriptResumeCheckpoint(),
    ).rejects.toThrow(
      "Invalid manuscript resume checkpoint",
    );
  });

  it("sends only the exact startup recovery apply command and strictly parses its acknowledgement", async () => {
    const safeBoundary =
      Number.parseInt(
        randomUUID().slice(0, 4),
        16,
      ) + 1;
    const documentId =
      entityId<"Document">(randomUUID());
    const candidate: StartupRecoveryCandidate = {
      sourceJournalEndByteOffset:
        safeBoundary +
        Number.parseInt(
          randomUUID().slice(0, 4),
          16,
        ),
      checksumVerifiedPrefixByteLength:
        safeBoundary,
      safeReplayThroughByteOffset:
        safeBoundary,
      affectedDocuments: [
        {
          workId:
            entityId<"Work">(randomUUID()),
          documentId,
          baseRevisionId:
            entityId<"DocumentRevision">(
              randomUUID(),
            ),
          recoveredText: randomUUID(),
          nextSequence: Number.parseInt(
            randomUUID().slice(0, 6),
            16,
          ),
        },
      ],
      appliedBatchIds: [
        entityId<"ChangeBatch">(randomUUID()),
      ],
      duplicateBatchIds: [],
      safePayloads: [
        new TextEncoder().encode(randomUUID()),
      ],
      issues: [],
    };
    const command =
      createApplyStartupRecoveryCommand(candidate);
    const acknowledgement = {
      schemaVersion: 1,
      status: "applied",
      compactionId: randomUUID(),
      consumedThroughByteOffset:
        candidate.sourceJournalEndByteOffset,
      reclamation: "completed",
    } as const;
    const invoke = vi
      .fn()
      .mockResolvedValue(acknowledgement);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.editor.applyManuscriptStartupRecovery(
        command,
      ),
    ).resolves.toEqual(acknowledgement);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
      command,
    );

    const malformed = createStudioBridge(
      async () => ({
        ...acknowledgement,
        reclamation: randomUUID(),
      }),
    );
    await expect(
      malformed.editor.applyManuscriptStartupRecovery(
        command,
      ),
    ).rejects.toThrow(
      "Invalid manuscript recovery acknowledgement",
    );
  });

  it("rejects a malformed manuscript input profile response", async () => {
    const bridge = createStudioBridge(async () => ({ schemaVersion: 1 }));

    await expect(bridge.editor.getManuscriptInputProfile()).rejects.toThrow(
      "Invalid manuscript input profile",
    );
  });

  it("accepts only complete string-valued runtime information", () => {
    expect(
      isRuntimeInfo({
        appName: randomUUID(),
        appVersion: randomUUID(),
        platform: randomUUID(),
        architecture: randomUUID(),
      }),
    ).toBe(true);
    expect(isRuntimeInfo(null)).toBe(false);
    expect(isRuntimeInfo({})).toBe(false);
  });

  it("strictly receives and completes the manuscript close handshake", async () => {
    const request = {
      schemaVersion: 1,
      requestId: randomUUID(),
    } as const;
    const result = {
      schemaVersion: 1,
      requestId: request.requestId,
      status: "saved",
    } as const;
    let receive:
      | ((payload: unknown) => void)
      | undefined;
    const unsubscribe = vi.fn();
    const listen: BridgeListen = (
      channel,
      listener,
    ) => {
      expect(channel).toBe(
        MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
      );
      receive = listener;
      return unsubscribe;
    };
    const invoke = vi.fn().mockResolvedValue(result);
    const bridge = createStudioBridgeContract(
      invoke,
      listen,
    );
    const listener = vi.fn();

    const stop =
      bridge.editor.onManuscriptCloseRequest(
        listener,
      );
    expect(receive).toBeTypeOf("function");
    receive?.(request);
    expect(listener).toHaveBeenCalledWith(
      request,
    );
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();

    await expect(
      bridge.editor.completeManuscriptCloseRequest(
        result,
      ),
    ).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith(
      MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
      result,
    );
  });

  it("rejects malformed manuscript close handshake values", async () => {
    let receive:
      | ((payload: unknown) => void)
      | undefined;
    const bridge = createStudioBridgeContract(
      async () => ({
        schemaVersion: 1,
        requestId: randomUUID(),
        status: randomUUID(),
      }),
      (_channel, listener) => {
        receive = listener;
        return () => undefined;
      },
    );
    bridge.editor.onManuscriptCloseRequest(
      () => undefined,
    );

    expect(() =>
      receive?.({
        schemaVersion: 1,
        requestId: "",
      }),
    ).toThrow(
      "ManuscriptCloseRequest.requestId must be a non-empty string",
    );
    await expect(
      bridge.editor.completeManuscriptCloseRequest(
        {
          schemaVersion: 1,
          requestId: randomUUID(),
          status: "saved",
        },
      ),
    ).rejects.toThrow(
      "Invalid manuscript close result",
    );
  });
});
