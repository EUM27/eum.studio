import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createLegacyLoreDryRunPlan } from "../application/migration/legacy-lore-dry-run";
import { encodeDurableText } from "../application/persistence/change-batch";
import {
  backupAndRestoreLegacyLoreDryRun,
  discardLegacyLoreDryRun,
} from "./legacy-lore-dry-run-lifecycle";
import { recordLegacyLoreMigrationDecision } from "./legacy-lore-migration-decision";
import { writeLegacyLoreDryRun } from "./legacy-lore-dry-run-writer";
import { createLocalWorkspaceStorageProfiles } from "./local-workspace-runtime";
import { openNodeSqliteLedger } from "../platform/storage/node-sqlite-ledger";

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

describe("legacy lore dry-run lifecycle", () => {
  it("backs up, restores, regenerates the same report, and discards only the dry-run target", async () => {
    const parent = await mkdtemp(
      join(tmpdir(), `eum-legacy-lifecycle-${randomUUID()}-`),
    );
    cleanupRoots.push(parent);
    const dryRunRoot = join(parent, "dry-run");
    const restoredRoot = join(parent, "restored");
    const defaultWorkspaceRoot = join(parent, "default-workspace");
    await mkdir(defaultWorkspaceRoot);
    const defaultWorkspaceProfiles = createLocalWorkspaceStorageProfiles(
      defaultWorkspaceRoot,
    );
    const defaultWorkspaceLedger = await openNodeSqliteLedger(
      defaultWorkspaceProfiles.ledgerProfile,
    );
    defaultWorkspaceLedger.close();
    const defaultWorkspaceChecksum = createHash("sha256")
      .update(await readFile(defaultWorkspaceProfiles.databasePath))
      .digest("hex");
    const manuscript = "복원할 원고\n둘째 줄";
    const createPlan = (
      sourceSnapshotId: string,
      sourceSnapshotChecksumValue: string,
      workTitle: string,
      manuscriptText: string,
    ) => createLegacyLoreDryRunPlan({
        mapperVersion: "legacy-lore-v1",
        sourceSnapshotId,
        sourceSnapshotChecksumValue,
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
        payload: {
        library: {
          works: [{
            id: "source-work",
            title: workTitle,
            episodeIds: ["source-document"],
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
          }],
          episodeFolders: [],
          episodes: [{
            id: "source-document",
            workId: "source-work",
            title: "1화",
            index: 1,
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
          }],
        },
        manuscripts: { "source-document": manuscriptText },
        recentWork: {
          "source-work": {
            episodeId: "source-document",
            cursor: 2,
            updatedAt: 1_700_000_200_000,
          },
        },
        sessionLogs: [],
        factTemplatesByEpisode: {},
        books: [],
        entries: [],
      },
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
    const plan = createPlan(
      "snapshot-a",
      "source-checksum-a",
      "복원 작품",
      manuscript,
    );
    const writerInput = {
      targetRootDirectoryPath: dryRunRoot,
      studioDisplayName: "이음 스튜디오",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      reportFileName: "migration-report.json",
      anchorPolicy: {
        schemaVersion: 1 as const,
        version: "legacy-lore-v1",
        contextOffsetLength: 16,
      },
      anchorEvidenceChecksumAlgorithm: "sha256",
      plan,
    };
    const source = await writeLegacyLoreDryRun(writerInput);
    const sourceReportText = await readFile(
      join(dryRunRoot, "migration-report.json"),
      "utf8",
    );
    const decisionInput = {
      targetRootDirectoryPath: dryRunRoot,
      reportFileName: "migration-report.json",
      decisionId: "decision-a",
      sourceCollection: "manuscripts",
      sourceIdentity: "orphan-document",
      commandKind: "keep-in-review",
      decisionPayloadJson: JSON.stringify({ disposition: "review" }),
      decidedAt: "2026-08-07T00:00:30.000Z",
      actorRef: "local-user",
    };
    expect(
      (await recordLegacyLoreMigrationDecision(decisionInput)).publication,
    ).toBe("published");
    const repeated = await writeLegacyLoreDryRun(writerInput);
    expect(repeated.publication).toBe("reused");
    expect(repeated.report).toEqual(source.report);
    expect(await readFile(join(dryRunRoot, "migration-report.json"), "utf8"))
      .toBe(sourceReportText);
    expect(
      (await recordLegacyLoreMigrationDecision(decisionInput)).publication,
    ).toBe("reused");

    const differentDryRunRoot = join(parent, "different-dry-run");
    const differentPlan = createPlan(
      "snapshot-b",
      "source-checksum-b",
      "다른 archive 작품",
      "다른 archive 원고",
    );
    const different = await writeLegacyLoreDryRun({
      ...writerInput,
      targetRootDirectoryPath: differentDryRunRoot,
      plan: differentPlan,
    });
    expect(different.report.batchId).not.toBe(source.report.batchId);
    expect(different.report.sourceSnapshotId).toBe("snapshot-b");
    expect(await readFile(join(dryRunRoot, "migration-report.json"), "utf8"))
      .toBe(sourceReportText);
    const sourceLedgerAfterDifferentBatch = await openNodeSqliteLedger(
      createLocalWorkspaceStorageProfiles(dryRunRoot).ledgerProfile,
    );
    try {
      expect(
        await sourceLedgerAfterDifferentBatch.getMigrationDecisionById(
          "decision-a",
        ),
      ).toMatchObject({ batchId: source.report.batchId });
    } finally {
      sourceLedgerAfterDifferentBatch.close();
    }
    const lifecycle = await backupAndRestoreLegacyLoreDryRun({
      writerInput,
      temporaryBundleRootPath: join(parent, "backup.staging"),
      finalBundleRootPath: join(parent, "backup"),
      restoreStagingRootPath: join(parent, "restored.staging"),
      restoreFinalRootPath: restoredRoot,
      bundleDatabaseEntrySegments: ["ledger", "workspace.sqlite3"],
      bundleManifestEntrySegments: ["manifest.json"],
      bundleManifestChecksumEntrySegments: ["manifest.sha256"],
      bundleBlobEntrySegments: (address) => [
        "blobs",
        `${address.checksumValue}.blob`,
      ],
      format: { identity: "eum-studio-backup", version: "1" },
      sqlite: {
        sourceDatabaseName: "main",
        targetDatabaseName: "main",
        pagesPerStep: 16,
        standaloneSnapshotJournalMode: "DELETE",
      },
      checksum: { identity: "sha256", algorithm: "sha256" },
      createdAt: "2026-08-07T00:01:00.000Z",
      restorePreflight: {
        preflight: async ({ requiredByteCount }) => {
          expect(requiredByteCount).toBeGreaterThan(0);
        },
      },
    });
    expect(lifecycle).toMatchObject({
      reportRegenerated: true,
      countsMatch: true,
      checksumsMatch: true,
    });
    expect(
      JSON.parse(await readFile(join(restoredRoot, "migration-report.json"), "utf8")),
    ).toEqual(source.report);
    const restoredLedger = await openNodeSqliteLedger(
      createLocalWorkspaceStorageProfiles(restoredRoot).ledgerProfile,
    );
    try {
      expect(
        await restoredLedger.getMigrationDecisionById("decision-a"),
      ).toMatchObject({
        commandKind: "keep-in-review",
        decisionPayloadJson: JSON.stringify({ disposition: "review" }),
      });
    } finally {
      restoredLedger.close();
    }
    expect(
      createHash("sha256")
        .update(await readFile(defaultWorkspaceProfiles.databasePath))
        .digest("hex"),
    ).toBe(defaultWorkspaceChecksum);

    const archiveRoot = join(parent, "source-archive");
    const archiveManifestPath = join(archiveRoot, "manifest.json");
    const archiveRawPath = join(archiveRoot, "raw.json");
    await mkdir(archiveRoot);
    await writeFile(archiveManifestPath, "source archive proof", "utf8");
    await writeFile(archiveRawPath, "source archive raw proof", "utf8");
    const discarded = await discardLegacyLoreDryRun({
      dryRunTargetRootPath: dryRunRoot,
      sourceArchiveRootPath: archiveRoot,
      sourceArchiveProofPaths: [archiveManifestPath, archiveRawPath],
      checksum: { identity: "sha256", algorithm: "sha256" },
    });
    expect(discarded.sourceArchiveProofCount).toBe(2);
    expect(await readFile(archiveManifestPath, "utf8")).toBe(
      "source archive proof",
    );
    expect(await readFile(archiveRawPath, "utf8")).toBe(
      "source archive raw proof",
    );
  });
});
