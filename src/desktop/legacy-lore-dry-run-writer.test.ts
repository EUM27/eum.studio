import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createLegacyLoreDryRunPlan } from "../application/migration/legacy-lore-dry-run";
import { encodeDurableText } from "../application/persistence/change-batch";
import { parseManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import { parseLocalWorkspaceBackupProfile } from "../application/storage/local-workspace-backup-profile";
import { parseLocalWorkspaceDefaults } from "../application/workspace/local-workspace-defaults";
import { entityId } from "../domain/writing";
import { openNodeSqliteLedger } from "../platform/storage/node-sqlite-ledger";
import { openLocalWorkspaceRuntime } from "./local-workspace-runtime";
import { createLocalWorkspaceStorageProfiles } from "./local-workspace-runtime";
import { writeLegacyLoreDryRun } from "./legacy-lore-dry-run-writer";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("legacy lore dry-run writer", () => {
  it("writes mapped works and immutable manuscripts to a disposable local ledger", async () => {
    const parent = await mkdtemp(
      join(tmpdir(), `eum-legacy-dry-run-${randomUUID()}-`),
    );
    cleanupRoots.push(parent);
    const targetRootDirectoryPath = join(parent, "target");
    const manuscript = "원문 그대로\n둘째 줄 ⋯";
    const payload = {
      library: {
        works: [{
          id: "source-work",
          title: "실제 작품",
          description: "설명",
          episodeIds: ["source-document", "empty-document"],
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_100_000,
        }],
        episodeFolders: [],
        episodes: [
          {
            id: "source-document",
            workId: "source-work",
            title: "1화",
            index: 1,
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
          },
          {
            id: "empty-document",
            workId: "source-work",
            title: "2화",
            index: 2,
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
          },
        ],
      },
      manuscripts: {
        "source-document": manuscript,
        "empty-document": "",
      },
      factTemplatesByEpisode: {},
      recentWork: {
        "source-work": {
          episodeId: "source-document",
          cursor: 2,
          updatedAt: 1_700_000_200_000,
        },
      },
      books: [],
      entries: [],
      sessionLogs: [{
        id: "source-session",
        workId: "source-work",
        episodeId: "source-document",
        mode: "free",
        createdAt: 1_700_000_000_000,
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_030_000,
        durationMs: 30_000,
        charDelta: 12,
        focusCompletion: null,
        focusTargetMs: null,
      }],
    };
    const plan = createLegacyLoreDryRunPlan({
      mapperVersion: "legacy-lore-v1",
      sourceSnapshotId: "snapshot-a",
      sourceSnapshotChecksumValue: "source-checksum-a",
      createdAt: "2026-08-07T00:00:00.000Z",
      resumeWorkspaceMode: "manuscript",
      completedWritingSessionState: "completed",
      secretLikeFieldFragments: [
        "accessToken",
        "refreshToken",
        "apiKey",
        "clientSecret",
      ],
      secretRedactionValue: "[REDACTED]",
      payload,
      deriveTargetId: (identity) => digest(identity),
      describeManuscript: (text) => {
        const bytes = encodeDurableText(text);
        return {
          checksumIdentity: "eum-studio-ledger-sha256-v1",
          checksumValue: createHash("sha256").update(bytes).digest("hex"),
          byteLength: bytes.byteLength,
          lengthUtf16: text.length,
        };
      },
      describeRawItem: ({ value }) => {
        const bytes = new TextEncoder().encode(JSON.stringify(value));
        return {
          serializationIdentity: "json-utf8",
          checksumIdentity: "sha256-json-utf8",
          checksumValue: createHash("sha256").update(bytes).digest("hex"),
          byteLength: bytes.byteLength,
          bytes,
        };
      },
    });
    const writeInput = {
      targetRootDirectoryPath,
      studioDisplayName: "이음 스튜디오",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      reportFileName: "migration-report.json",
      anchorPolicy: {
        schemaVersion: 1,
        version: "legacy-lore-v1",
        contextOffsetLength: 16,
      },
      anchorEvidenceChecksumAlgorithm: "sha256",
      plan,
    } as const;
    const result = await writeLegacyLoreDryRun(writeInput);

    expect(result.report.counts).toMatchObject({
      workCount: 1,
      documentCount: 2,
      revisionCount: 2,
      resumeCheckpointCount: 1,
      writingSessionCount: 1,
      uncoveredItemCount: 0,
    });
    const opened = await openLocalWorkspaceRuntime({
      rootDirectoryPath: targetRootDirectoryPath,
      studioDisplayName: "이음 스튜디오",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      batchingPolicy: {
        schemaVersion: 1,
        maxTransactionsPerBatch: 1,
        maxDelayMs: 0,
      },
      emptyDocumentProfile: parseManuscriptDocumentProfile({
        schemaVersion: 1,
        initialDocumentId: "empty-document",
        documents: [{
          workId: "empty-work",
          documentId: "empty-document",
          documentRevisionId: "empty-revision",
          label: "원고",
          initialText: "",
        }],
      }),
      defaults: parseLocalWorkspaceDefaults(
        JSON.parse(
          readFileSync(
            join(
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
            join(
              process.cwd(),
              "config",
              "local-workspace-backup.json",
            ),
            "utf8",
          ),
        ),
      ),
    });
    try {
      const catalog = opened.getWorkspaceCatalog();
      const documentProfile = opened.getManuscriptDocumentProfile();
      expect(catalog.works).toHaveLength(1);
      expect(catalog.works[0]?.title).toBe("실제 작품");
      expect(documentProfile.documents).toHaveLength(2);
      expect(
        documentProfile.documents.find(
          (document) => document.label === "1화",
        )?.initialText,
      ).toBe(manuscript);
      expect(
        documentProfile.documents.find(
          (document) => document.label === "2화",
        )?.initialText,
      ).toBe("");
    } finally {
      opened.close();
    }
    const ledger = await openNodeSqliteLedger(
      createLocalWorkspaceStorageProfiles(targetRootDirectoryPath).ledgerProfile,
    );
    try {
      const transaction = ledger.createResumeCheckpointCaptureTransaction({});
      const mappedCheckpoint = plan.resumeCheckpoints[0];
      expect(mappedCheckpoint).toBeDefined();
      if (mappedCheckpoint === undefined) {
        throw new Error("Expected a mapped checkpoint");
      }
      const work = await transaction.getWork(
        entityId<"Work">(mappedCheckpoint.workId),
      );
      const checkpoint = await transaction.getCheckpointById(
        entityId<"ResumeCheckpoint">(mappedCheckpoint.checkpointId),
      );
      const cursorAnchor = await transaction.getAnchorById(
        entityId<"Anchor">(mappedCheckpoint.cursorAnchorId),
      );
      expect(work?.resumeCheckpointId).toBe(mappedCheckpoint.checkpointId);
      expect(checkpoint?.documentId).toBe(mappedCheckpoint.documentId);
      expect(cursorAnchor).toMatchObject({
        startOffset: 2,
        endOffset: 2,
        exactQuote: "",
        status: "resolved",
      });
    } finally {
      ledger.close();
    }
    const reportText = await readFile(
      join(targetRootDirectoryPath, "migration-report.json"),
      "utf8",
    );
    expect(reportText).not.toContain(manuscript);
    const reused = await writeLegacyLoreDryRun(writeInput);
    expect(reused.publication).toBe("reused");
    expect(reused.report).toEqual(result.report);
    expect(
      await readFile(
        join(targetRootDirectoryPath, "migration-report.json"),
        "utf8",
      ),
    ).toBe(reportText);
  });
});
