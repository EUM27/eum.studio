import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  ACTIVITY_LIST_WORK_CHANNEL,
  ACTIVITY_START_FOCUS_CHANNEL,
  ACTIVITY_START_SESSION_CHANNEL,
  ACTIVITY_STOP_FOCUS_CHANNEL,
  ACTIVITY_STOP_SESSION_CHANNEL,
  BACKUP_CREATE_CHANNEL,
  BACKUP_GET_STATUS_CHANNEL,
  BACKUP_RESTORE_CHANNEL,
  MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
  MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
  MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
  MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
  MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
  MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
  MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
  RUNTIME_INFO_CHANNEL,
  STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
  STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
  STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
  STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
  VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
  VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
  VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
  VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
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

  it("exposes only strict EventBlock create and list commands", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const eventBlock = {
      schemaVersion: 1,
      eventBlockId: randomUUID(),
      anchorId: randomUUID(),
      workId,
      documentId,
      documentRevisionId: randomUUID(),
      title: "첫 사건",
      note: "",
      exactQuote: "선택한 원문",
      integrity: "resolved",
      range: { from: 2, to: 8 },
      createdAt: new Date().toISOString(),
    } as const;
    const invoke = vi.fn(async (channel) =>
      channel === STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL
        ? eventBlock
        : {
            schemaVersion: 1,
            workId,
            eventBlocks: [eventBlock],
          },
    );
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 8, head: 2 },
      exactQuote: "선택한 원문",
      title: "첫 사건",
      note: "",
    } as const;

    await expect(
      bridge.structure.createEventBlock(command),
    ).resolves.toEqual(eventBlock);
    await expect(
      bridge.structure.listEventBlocks({ schemaVersion: 1, workId }),
    ).resolves.toEqual({
      schemaVersion: 1,
      workId,
      eventBlocks: [eventBlock],
    });
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
      command,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
      { schemaVersion: 1, workId },
    );
  });

  it("exposes only strict SceneOverride create and list commands", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const sceneOverride = {
      schemaVersion: 1,
      sceneOverrideId: randomUUID(),
      workId,
      documentId,
      operation: "add",
      baseRuleSetRevision: 3,
      note: "커서 경계",
      boundaries: [
        {
          anchorId: randomUUID(),
          documentRevisionId: randomUUID(),
          exactQuote: "",
          integrity: "resolved",
          range: { from: 5, to: 5 },
        },
      ],
      createdAt: new Date().toISOString(),
    } as const;
    const invoke = vi.fn(async (channel) =>
      channel === STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL
        ? sceneOverride
        : {
            schemaVersion: 1,
            workId,
            sceneOverrides: [sceneOverride],
          },
    );
    const bridge = createStudioBridge(invoke);
    const command = {
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 5, head: 5 },
      exactQuote: "",
      operation: "add",
      note: "커서 경계",
    } as const;

    await expect(
      bridge.structure.createSceneOverride(command),
    ).resolves.toEqual(sceneOverride);
    await expect(
      bridge.structure.listSceneOverrides({ schemaVersion: 1, workId }),
    ).resolves.toEqual({
      schemaVersion: 1,
      workId,
      sceneOverrides: [sceneOverride],
    });
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
      command,
    );
    expect(invoke).toHaveBeenCalledWith(
      STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
      { schemaVersion: 1, workId },
    );
  });

  it("exposes strict Work activity commands without a fixed focus duration", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const sessionId = entityId<"WritingSession">(randomUUID());
    const focusCycleId = entityId<"FocusCycle">(randomUUID());
    const now = new Date().toISOString();
    const targetDurationMs = 37 * 60 * 1_000;
    const projection = {
      schemaVersion: 1,
      workId,
      activeSessionId: sessionId,
      activeFocusCycleId: focusCycleId,
      sessions: [{
        schemaVersion: 1,
        sessionId,
        workId,
        documentId,
        state: "active",
        startedAt: now,
        endedAt: null,
        activeDurationMs: 0,
        startRevisionId: entityId<"DocumentRevision">(randomUUID()),
        endRevisionId: null,
        characterDelta: null,
        note: "",
      }],
      focusCycles: [{
        schemaVersion: 1,
        focusCycleId,
        workId,
        sessionId,
        state: "running",
        phaseRef: "초고 집중",
        targetDurationMs,
        startedAt: now,
        deadlineAt: new Date(Date.parse(now) + targetDurationMs).toISOString(),
        completedAt: null,
        note: "",
      }],
    } as const;
    const invoke = vi.fn().mockResolvedValue(projection);
    const bridge = createStudioBridge(invoke);
    const list = { schemaVersion: 1, workId } as const;
    const startSession = {
      schemaVersion: 1,
      workId,
      documentId,
      note: "",
    } as const;
    const stopSession = { schemaVersion: 1, workId, sessionId } as const;
    const startFocus = {
      schemaVersion: 1,
      workId,
      documentId,
      phaseRef: "초고 집중",
      targetDurationMs,
      note: "",
    } as const;
    const stopFocus = { schemaVersion: 1, workId, focusCycleId } as const;

    await expect(bridge.activity.listWork(list)).resolves.toEqual(projection);
    await expect(bridge.activity.startSession(startSession)).resolves.toEqual(projection);
    await expect(bridge.activity.stopSession(stopSession)).resolves.toEqual(projection);
    await expect(bridge.activity.startFocus(startFocus)).resolves.toEqual(projection);
    await expect(bridge.activity.stopFocus(stopFocus)).resolves.toEqual(projection);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_LIST_WORK_CHANNEL, list);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_START_SESSION_CHANNEL, startSession);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_STOP_SESSION_CHANNEL, stopSession);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_START_FOCUS_CHANNEL, startFocus);
    expect(invoke).toHaveBeenCalledWith(ACTIVITY_STOP_FOCUS_CHANNEL, stopFocus);
  });

  it("exposes strict Document revision and WorkSnapshot commands", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const revisionId = entityId<"DocumentRevision">(randomUUID());
    const restoredRevisionId = entityId<"DocumentRevision">(randomUUID());
    const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
    const now = new Date().toISOString();
    const revisionList = {
      schemaVersion: 1,
      workId,
      documentId,
      revisions: [{
        schemaVersion: 1,
        revisionId,
        workId,
        documentId,
        parentRevisionId: null,
        length: 12,
        cause: "manuscript-edit",
        createdAt: now,
        durableAt: now,
        isCurrent: true,
      }],
    } as const;
    const restoreResult = {
      schemaVersion: 1,
      workId,
      documentId,
      targetRevisionId: revisionId,
      restoredRevisionId,
    } as const;
    const snapshot = {
      schemaVersion: 1,
      workSnapshotId,
      workId,
      label: "초고 기준",
      cause: "manual",
      manifestHash: randomUUID(),
      createdAt: now,
      documentRevisions: [{ documentId, documentRevisionId: revisionId }],
    } as const;
    const snapshotList = {
      schemaVersion: 1,
      workId,
      snapshots: [snapshot],
    } as const;
    const invoke = vi.fn(async (channel) => {
      if (channel === VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL) {
        return revisionList;
      }
      if (channel === VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL) {
        return restoreResult;
      }
      if (channel === VERSION_CREATE_WORK_SNAPSHOT_CHANNEL) {
        return snapshot;
      }
      return snapshotList;
    });
    const bridge = createStudioBridge(invoke);
    const listRevisions = { schemaVersion: 1, workId, documentId } as const;
    const restore = {
      schemaVersion: 1,
      workId,
      documentId,
      targetRevisionId: revisionId,
    } as const;
    const createSnapshot = {
      schemaVersion: 1,
      workId,
      label: "초고 기준",
    } as const;
    const listSnapshots = { schemaVersion: 1, workId } as const;

    await expect(
      bridge.version.listDocumentRevisions(listRevisions),
    ).resolves.toEqual(revisionList);
    await expect(
      bridge.version.restoreDocumentRevision(restore),
    ).resolves.toEqual(restoreResult);
    await expect(
      bridge.version.createWorkSnapshot(createSnapshot),
    ).resolves.toEqual(snapshot);
    await expect(
      bridge.version.listWorkSnapshots(listSnapshots),
    ).resolves.toEqual(snapshotList);
    expect(invoke).toHaveBeenCalledWith(
      VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
      listRevisions,
    );
    expect(invoke).toHaveBeenCalledWith(
      VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
      restore,
    );
    expect(invoke).toHaveBeenCalledWith(
      VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
      createSnapshot,
    );
    expect(invoke).toHaveBeenCalledWith(
      VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
      listSnapshots,
    );
  });

  it("exposes verified local backup status, creation, and restore actions", async () => {
    const summary = {
      schemaVersion: 1,
      bundlePath: "D:\\Backups\\eum-studio-2026-08-07",
      targetPath: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      verifiedAt: "2026-08-07T00:00:01.000Z",
      lastAction: "created",
      counts: {
        workCount: 1,
        documentCount: 2,
        revisionCount: 3,
        resumeCheckpointCount: 1,
        writingSessionCount: 1,
      },
    } as const;
    const status = { schemaVersion: 1, lastVerified: summary } as const;
    const completed = {
      schemaVersion: 1,
      status: "completed",
      summary,
    } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === BACKUP_GET_STATUS_CHANNEL) {
        return status;
      }
      return completed;
    });
    const bridge = createStudioBridge(invoke);

    await expect(bridge.backup.getStatus()).resolves.toEqual(status);
    await expect(bridge.backup.create()).resolves.toEqual(completed);
    await expect(bridge.backup.restore()).resolves.toEqual(completed);
    expect(invoke).toHaveBeenCalledWith(BACKUP_GET_STATUS_CHANNEL);
    expect(invoke).toHaveBeenCalledWith(BACKUP_CREATE_CHANNEL);
    expect(invoke).toHaveBeenCalledWith(BACKUP_RESTORE_CHANNEL);
  });

  it("exposes a strict read-only legacy import rehearsal action", async () => {
    const completed = {
      schemaVersion: 1,
      status: "completed",
      summary: {
        schemaVersion: 1,
        sourceRootPath: "D:\\eum.editor",
        sourceSnapshotId: "snapshot",
        sourceChecksumIdentity: "sha256",
        sourceChecksumValue: "checksum",
        sourceByteLength: 10,
        targetRootPath: "D:\\rehearsal",
        rehearsalWorkspacePath: "D:\\rehearsal\\workspace",
        reportPath: "D:\\rehearsal\\workspace\\report.json",
        capturedAt: "2026-08-07T00:00:00.000Z",
        publication: "published",
        sourceUnchanged: true,
        issueCount: 0,
        counts: {
          workCount: 1,
          folderCount: 0,
          documentCount: 1,
          revisionCount: 1,
          resumeCheckpointCount: 1,
          writingSessionCount: 0,
          rawItemCount: 1,
          receiptCount: 3,
          sourceItemCount: 3,
          uncoveredItemCount: 0,
          orphanManuscriptCount: 0,
        },
      },
    } as const;
    const invoke = vi.fn().mockResolvedValue(completed);
    const bridge = createStudioBridge(invoke);

    await expect(
      bridge.migration.runLegacyLoreRehearsal(),
    ).resolves.toEqual(completed);
    expect(invoke).toHaveBeenCalledWith(
      MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
    );
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
