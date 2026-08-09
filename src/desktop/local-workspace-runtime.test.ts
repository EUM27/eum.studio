import {
  randomUUID,
} from "node:crypto";
import { readFileSync } from "node:fs";
import {
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseManuscriptDocumentProfile,
} from "../application/editor/manuscript-document-profile";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
} from "../application/persistence/change-batch";
import {
  parseManuscriptBatchingPolicy,
} from "../application/persistence/manuscript-persistence-profile";
import {
  openLocalWorkspaceRuntime,
} from "./local-workspace-runtime";
import {
  parseLocalWorkspaceDefaults,
} from "../application/workspace/local-workspace-defaults";
import {
  parseLocalWorkspaceBackupProfile,
} from "../application/storage/local-workspace-backup-profile";

function createOptions(rootDirectoryPath: string) {
  const workId = randomUUID();
  const documentId = randomUUID();
  return {
    rootDirectoryPath,
    studioDisplayName: randomUUID(),
    locale: "ko-KR",
    timezone: "Asia/Seoul",
    batchingPolicy: parseManuscriptBatchingPolicy({
      schemaVersion: 1,
      maxTransactionsPerBatch: 1,
      maxDelayMs: 0,
    }),
    emptyDocumentProfile: parseManuscriptDocumentProfile({
      schemaVersion: 1,
      initialDocumentId: documentId,
      documents: [
        {
          workId,
          documentId,
          documentRevisionId: randomUUID(),
          label: randomUUID(),
          initialText: "",
        },
      ],
    }),
    defaults: parseLocalWorkspaceDefaults(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "local-workspace-defaults.json",
          ),
          "utf8",
        ),
      ),
    ),
    backupProfile: parseLocalWorkspaceBackupProfile(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "local-workspace-backup.json",
          ),
          "utf8",
        ),
      ),
    ),
  } as const;
}

describe("local workspace runtime", () => {
  it("creates a first Work, saves an immutable revision, and materializes it after reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-local-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    const title = randomUUID();
    const firstDocumentTitle = randomUUID();
    const insertedText = randomUUID();
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title,
        firstDocumentTitle,
      });
      const profile = runtime.getManuscriptDocumentProfile();
      expect(profile.initialDocumentId).toBe(created.documentId);
      expect(profile.documents[0]).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        documentRevisionId: created.revisionId,
        label: firstDocumentTitle,
        initialText: "",
      });

      const receipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: insertedText.length,
          changes: [
            {
              fromUtf16: 0,
              toUtf16: 0,
              insertedText,
            },
          ],
        }),
      );
      expect(receipt).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
      });
      expect(receipt).toHaveProperty("revisionId");

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = runtime.getManuscriptDocumentProfile();
      expect(reopened.documents[0]).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        label: firstDocumentTitle,
        initialText: insertedText,
      });
      expect(
        runtime.getWorkspaceCatalog().works[0],
      ).toMatchObject({
        workId: created.workId,
        title,
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("creates additional Works and Documents and reopens the exact per-Work resume range", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-multi-work-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const continued = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: randomUUID(),
      });
      const manuscript = randomUUID();
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: continued.documentId,
          baseRevisionId: continued.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      const selection = {
        anchor: manuscript.length,
        head: Math.max(1, manuscript.length - 5),
      } as const;
      const captured = await runtime.captureWorkspaceResume({
        schemaVersion: 1,
        workId: first.workId,
        documentId: continued.documentId,
        selection,
        workspaceMode: "writing",
      });
      expect(captured).toMatchObject({
        status: "resolved",
        workId: first.workId,
        documentId: continued.documentId,
        selection,
      });

      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      expect(runtime.getWorkspaceCatalog().works).toHaveLength(2);
      expect(
        runtime.getWorkspaceCatalog().works.find(
          (work) => work.workId === first.workId,
        )?.documents,
      ).toHaveLength(2);
      expect(second.workId).not.toBe(first.workId);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const activated = await runtime.activateWorkspaceLocation({
        schemaVersion: 1,
        workId: first.workId,
        documentId: null,
      });
      expect(activated).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: continued.documentId,
      });
      expect(runtime.getManuscriptResumeCheckpoint()).toMatchObject({
        status: "resolved",
        workId: first.workId,
        documentId: continued.documentId,
        selection,
      });
      expect(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === continued.documentId,
        ),
      ).toMatchObject({ initialText: manuscript });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("keeps the active durable sequence when workspace navigation reloads the catalog", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-navigation-sequence-"),
    );
    const options = createOptions(rootDirectoryPath);
    const runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const firstText = randomUUID();
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: first.documentId,
          baseRevisionId: first.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: firstText.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: firstText,
          }],
        }),
      );
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      await runtime.activateWorkspaceLocation({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
      });

      const appendedText = randomUUID();
      const receipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: first.documentId,
          baseRevisionId: first.revisionId,
          sequence: 1,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: firstText.length,
          afterTextLengthUtf16: firstText.length + appendedText.length,
          changes: [{
            fromUtf16: firstText.length,
            toUtf16: firstText.length,
            insertedText: appendedText,
          }],
        }),
      );

      expect(receipt).toMatchObject({
        workId: first.workId,
        documentId: first.documentId,
        baseRevisionId: first.revisionId,
        sequence: 1,
      });
      const persistenceProfile =
        runtime.getManuscriptPersistenceProfile();
      expect(persistenceProfile).not.toBeNull();
      expect(persistenceProfile?.documentSequences).toContainEqual({
          documentId: first.documentId,
          nextSequence: 2,
        });
      expect(runtime.getWorkspaceCatalog()).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: first.documentId,
      });
      expect(second.workId).not.toBe(first.workId);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("stores an exact selected range as an EventBlock and resolves it after reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-event-block-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "도입 문장과 정확히 선택할 사건 원문과 마무리 문장";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      const exactQuote = "정확히 선택할 사건 원문";
      const from = manuscript.indexOf(exactQuote);
      const to = from + exactQuote.length;
      const createdEvent = await runtime.createEventBlock({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: { anchor: to, head: from },
        exactQuote,
        title: "첫 사건",
        note: "선택 범위를 그대로 저장",
      });

      expect(createdEvent).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        title: "첫 사건",
        exactQuote,
        integrity: "resolved",
        range: { from, to },
      });
      expect(
        (await runtime.listEventBlocks({
          schemaVersion: 1,
          workId: created.workId,
        })).eventBlocks,
      ).toContainEqual(createdEvent);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened.eventBlocks).toHaveLength(1);
      expect(reopened.eventBlocks[0]).toMatchObject({
        eventBlockId: createdEvent.eventBlockId,
        documentId: created.documentId,
        exactQuote,
        integrity: "resolved",
        range: { from, to },
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("stores a cursor boundary as a SceneOverride without changing manuscript text", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-scene-override-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "도입과 다음 장면 사이";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
        }),
      );
      const offset = manuscript.indexOf("다음");
      const createdOverride = await runtime.createSceneOverride({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: { anchor: offset, head: offset },
        exactQuote: "",
        operation: "add",
        note: "두 장면 사이",
      });

      expect(createdOverride).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        operation: "add",
        note: "두 장면 사이",
        boundaries: [
          {
            exactQuote: "",
            integrity: "resolved",
            range: { from: offset, to: offset },
          },
        ],
      });
      expect(createdOverride.baseRuleSetRevision).toBeGreaterThan(0);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listSceneOverrides({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened.sceneOverrides).toHaveLength(1);
      expect(reopened.sceneOverrides[0]).toMatchObject({
        sceneOverrideId: createdOverride.sceneOverrideId,
        documentId: created.documentId,
        operation: "add",
        boundaries: [{ range: { from: offset, to: offset } }],
      });
      expect(
        runtime.getManuscriptDocumentProfile().documents[0]?.initialText,
      ).toBe(manuscript);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists a manual writing session and caller-configured focus cycle across reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-work-activity-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const started = await runtime.startWritingSession({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        note: "직접 시작",
      });
      expect(started.activeSessionId).not.toBeNull();
      expect(started.sessions[0]).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        state: "active",
        note: "직접 시작",
      });

      const manuscript = "기록 세션 중 작성한 원고";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
        }),
      );
      const targetDurationMs = 37 * 60 * 1_000;
      const focused = await runtime.startFocusCycle({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        phaseRef: "초고 집중",
        targetDurationMs,
        note: "사용자 지정 시간",
      });
      const activeFocusCycleId = focused.activeFocusCycleId;
      expect(activeFocusCycleId).not.toBeNull();
      expect(focused.focusCycles[0]).toMatchObject({
        sessionId: started.activeSessionId,
        state: "running",
        phaseRef: "초고 집중",
        targetDurationMs,
        note: "사용자 지정 시간",
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listWorkActivity({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened).toMatchObject({
        activeSessionId: started.activeSessionId,
        activeFocusCycleId,
      });
      expect(reopened.focusCycles[0]?.targetDurationMs).toBe(targetDurationMs);

      if (activeFocusCycleId === null || started.activeSessionId === null) {
        throw new Error("Expected active activity identities");
      }
      const stoppedFocus = await runtime.stopFocusCycle({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: activeFocusCycleId,
      });
      expect(stoppedFocus.activeFocusCycleId).toBeNull();
      expect(stoppedFocus.focusCycles[0]).toMatchObject({ state: "stopped" });

      const stoppedSession = await runtime.stopWritingSession({
        schemaVersion: 1,
        workId: created.workId,
        sessionId: started.activeSessionId,
      });
      expect(stoppedSession.activeSessionId).toBeNull();
      expect(stoppedSession.sessions[0]).toMatchObject({
        state: "completed",
        characterDelta: manuscript.length,
      });
      expect(stoppedSession.sessions[0]?.activeDurationMs).toBeGreaterThanOrEqual(0);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const completed = await runtime.listWorkActivity({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(completed.sessions[0]).toMatchObject({
        state: "completed",
        characterDelta: manuscript.length,
      });
      expect(completed.focusCycles[0]).toMatchObject({
        state: "stopped",
        targetDurationMs,
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("restores a Document by appending a revision and keeps an immutable WorkSnapshot", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-work-version-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const firstText = `첫 원고 ${randomUUID()}`;
      const firstReceipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: firstText.length,
          changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: firstText }],
        }),
      );
      if (!("revisionId" in firstReceipt)) {
        throw new Error("Expected a durable revision receipt");
      }
      const snapshotLabel = `원고 기준 ${randomUUID()}`;
      const snapshot = await runtime.createWorkSnapshot({
        schemaVersion: 1,
        workId: created.workId,
        label: snapshotLabel,
      });
      expect(snapshot).toMatchObject({
        workId: created.workId,
        label: snapshotLabel,
        documentRevisions: [
          {
            documentId: created.documentId,
            documentRevisionId: firstReceipt.revisionId,
          },
        ],
      });

      const suffix = `\n둘째 원고 ${randomUUID()}`;
      const secondReceipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 1,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: firstText.length,
          afterTextLengthUtf16: firstText.length + suffix.length,
          changes: [
            {
              fromUtf16: firstText.length,
              toUtf16: firstText.length,
              insertedText: suffix,
            },
          ],
        }),
      );
      if (!("revisionId" in secondReceipt)) {
        throw new Error("Expected a durable revision receipt");
      }
      const beforeRestore = await runtime.listDocumentRevisions({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
      });
      expect(beforeRestore.revisions).toHaveLength(3);
      expect(
        beforeRestore.revisions.find((revision) => revision.isCurrent),
      ).toMatchObject({ revisionId: secondReceipt.revisionId });

      const restored = await runtime.restoreDocumentRevision({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        targetRevisionId: firstReceipt.revisionId,
      });
      expect(restored).toMatchObject({
        targetRevisionId: firstReceipt.revisionId,
      });
      expect(restored.restoredRevisionId).not.toBe(firstReceipt.revisionId);
      expect(
        runtime.getManuscriptDocumentProfile().documents[0],
      ).toMatchObject({
        documentRevisionId: restored.restoredRevisionId,
        initialText: firstText,
      });
      const afterRestore = await runtime.listDocumentRevisions({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
      });
      expect(afterRestore.revisions).toHaveLength(4);
      expect(
        afterRestore.revisions.find((revision) => revision.isCurrent),
      ).toMatchObject({ revisionId: restored.restoredRevisionId });
      expect(afterRestore.revisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ revisionId: firstReceipt.revisionId }),
          expect.objectContaining({ revisionId: secondReceipt.revisionId }),
        ]),
      );
      expect(
        (await runtime.listWorkSnapshots({
          schemaVersion: 1,
          workId: created.workId,
        })).snapshots[0],
      ).toEqual(snapshot);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(
        runtime.getManuscriptDocumentProfile().documents[0],
      ).toMatchObject({
        documentRevisionId: restored.restoredRevisionId,
        initialText: firstText,
      });
      expect(
        (await runtime.listWorkSnapshots({
          schemaVersion: 1,
          workId: created.workId,
        })).snapshots[0],
      ).toEqual(snapshot);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("creates a verified backup bundle and restores the exact workspace into a new location", async () => {
    const parentDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-local-backup-"),
    );
    const sourceRootDirectoryPath = path.join(
      parentDirectoryPath,
      "source-workspace",
    );
    const bundleRootDirectoryPath = path.join(
      parentDirectoryPath,
      "verified-backup",
    );
    const restoredRootDirectoryPath = path.join(
      parentDirectoryPath,
      "restored-workspace",
    );
    const options = createOptions(sourceRootDirectoryPath);
    const manuscript = `복원할 원고 ${randomUUID()}`;
    let runtime = await openLocalWorkspaceRuntime(options);
    let restoredRuntime: Awaited<
      ReturnType<typeof openLocalWorkspaceRuntime>
    > | null = null;

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: `백업 작품 ${randomUUID()}`,
        firstDocumentTitle: "1화",
      });
      const receipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [
            {
              fromUtf16: 0,
              toUtf16: 0,
              insertedText: manuscript,
            },
          ],
        }),
      );
      expect(receipt).toHaveProperty("revisionId");

      const createdBackup = await runtime.createBackupBundle(
        bundleRootDirectoryPath,
      );
      expect(createdBackup).toMatchObject({
        bundlePath: path.resolve(bundleRootDirectoryPath),
        targetPath: null,
        lastAction: "created",
        counts: {
          workCount: 1,
          documentCount: 1,
          revisionCount: 2,
        },
      });

      const restoredBackup = await runtime.restoreBackupBundle(
        bundleRootDirectoryPath,
        restoredRootDirectoryPath,
      );
      expect(restoredBackup).toMatchObject({
        bundlePath: path.resolve(bundleRootDirectoryPath),
        targetPath: path.resolve(restoredRootDirectoryPath),
        lastAction: "restored",
        counts: createdBackup.counts,
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.getBackupStatus()).lastVerified).toEqual(
        restoredBackup,
      );

      restoredRuntime = await openLocalWorkspaceRuntime({
        ...options,
        rootDirectoryPath: restoredRootDirectoryPath,
      });
      expect(
        restoredRuntime.getManuscriptDocumentProfile().documents[0],
      ).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        initialText: manuscript,
      });
    } finally {
      restoredRuntime?.close();
      runtime.close();
      await rm(parentDirectoryPath, { recursive: true, force: true });
    }
  });
});
