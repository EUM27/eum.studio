import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseLegacyBrowserSourceExportProfile } from "../application/migration/browser-source-export";
import { parseLegacyLoreImportProfile } from "../application/migration/legacy-lore-import-profile";
import { discardLegacyLoreDryRun } from "./legacy-lore-dry-run-lifecycle";
import { runLegacyLoreImportRehearsal } from "./legacy-lore-import-rehearsal";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("legacy lore import rehearsal", () => {
  it("seals a read-only source, writes an exact rehearsal, and reuses it without duplicates", async () => {
    const parent = await mkdtemp(
      path.join(tmpdir(), `eum-legacy-import-${randomUUID()}-`),
    );
    const sourceRootPath = path.join(parent, "legacy-source");
    const targetRootPath = path.join(parent, "import-rehearsal");
    const sourceFilePath = path.join(sourceRootPath, "data", "lorebooks.json");
    const backupFilePath = path.join(sourceRootPath, "data", "lorebooks.json.bak");
    const credentialFilePath = path.join(sourceRootPath, "data", "spotify-auth.json");
    const browserBundlePath = path.join(parent, "browser-source-export.json");
    const manuscript = "첫 줄\n둘째 줄 ⋯";
    const browserManuscript = "브라우저에만 있는 원고";
    const browserSecret = "must-not-enter-the-migration-report";
    const credentialSecret = "must-not-enter-the-source-archive";
    await mkdir(path.dirname(sourceFilePath), { recursive: true });
    const livePayload = {
        library: {
          works: [{
            id: "legacy-work",
            title: "가져올 작품",
            description: "설명",
            episodeIds: ["legacy-document"],
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
            futureField: { preserved: true },
          }],
          episodes: [{
            id: "legacy-document",
            workId: "legacy-work",
            title: "1화",
            index: 1,
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
          }],
          episodeFolders: [],
        },
        manuscripts: { "legacy-document": manuscript },
        recentWork: {
          "legacy-work": {
            episodeId: "legacy-document",
            cursor: 2,
            updatedAt: 1_700_000_200_000,
          },
        },
        factTemplatesByEpisode: {},
        books: [],
        entries: [],
        sessionLogs: [],
      };
    await writeFile(sourceFilePath, JSON.stringify(livePayload), "utf8");
    await writeFile(
      backupFilePath,
      JSON.stringify({
        ...livePayload,
        library: {
          ...livePayload.library,
          works: livePayload.library.works.map((work) => ({
            ...work,
            title: "백업은 mapping source가 아님",
          })),
        },
      }),
      "utf8",
    );
    await writeFile(credentialFilePath, credentialSecret, "utf8");
    await writeFile(
      browserBundlePath,
      JSON.stringify({
        formatIdentity: "eum-browser-source-export",
        formatVersion: "1",
        exportedAt: "2026-08-10T00:00:00.000Z",
        sourceOrigin: "http://localhost",
        localStorageEntries: [
          {
            key: "eum-editor:library:v2",
            value: JSON.stringify(livePayload.library),
          },
          {
            key: "eum-editor:manuscript:v2:legacy-document",
            value: browserManuscript,
          },
          {
            key: "eum-editor:ai-provider-settings:v1",
            value: JSON.stringify({ apiKeys: { other: browserSecret } }),
          },
        ],
        indexedDatabases: [
          {
            databaseName: "eum-work-store",
            version: 1,
            stores: [
              {
                storeName: "works",
                records: [{
                  key: "legacy-work",
                  value: { id: "legacy-work", title: "브라우저 작품" },
                }],
              },
              {
                storeName: "backups",
                records: [{
                  key: "backup-a",
                  value: { id: "backup-a", workId: "legacy-work" },
                }],
              },
            ],
          },
          {
            databaseName: "eum-publishing-store",
            version: 1,
            stores: [{
              storeName: "publishing-state",
              records: [{ key: "current", value: { submissions: [] } }],
            }],
          },
        ],
      }),
      "utf8",
    );
    const sourceChecksum = sha256(await readFile(sourceFilePath));
    const backupChecksum = sha256(await readFile(backupFilePath));
    const browserChecksum = sha256(await readFile(browserBundlePath));
    const profile = parseLegacyLoreImportProfile(
      JSON.parse(
        readFileSync(
          path.join(process.cwd(), "config", "legacy-lore-import.json"),
          "utf8",
        ),
      ),
    );
    const browserProfile = parseLegacyBrowserSourceExportProfile(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "legacy-browser-source-export.json",
          ),
          "utf8",
        ),
      ),
    );

    try {
      const first = await runLegacyLoreImportRehearsal({
        sourceRootPath,
        targetRootPath,
        studioDisplayName: "이음 스튜디오",
        locale: "ko-KR",
        timezone: "Asia/Seoul",
        profile,
        browserExportBundlePath: browserBundlePath,
        browserExportProfile: browserProfile,
      });
      expect(first).toMatchObject({
        publication: "published",
        sourceChecksumValue: sourceChecksum,
        sourceUnchanged: true,
        counts: {
          workCount: 1,
          documentCount: 1,
          revisionCount: 1,
          uncoveredItemCount: 0,
        },
      });
      expect(sha256(await readFile(sourceFilePath))).toBe(sourceChecksum);
      expect(sha256(await readFile(backupFilePath))).toBe(backupChecksum);
      expect(first.sourceSnapshots).toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceLocator: "data/lorebooks.json",
          checksumValue: sourceChecksum,
        }),
        expect.objectContaining({
          sourceLocator: "data/lorebooks.json.bak",
          checksumValue: backupChecksum,
        }),
        expect.objectContaining({
          sourceLocator: browserProfile.bundleArchive.sourceLocator,
          checksumValue: browserChecksum,
        }),
      ]));
      expect(first.browserSourceReceipt?.coverage).toEqual({
        sourceEntryCount: 6,
        capturedEntryCount: 6,
        uncoveredEntryCount: 0,
      });
      expect(first.connectorMetadata).toEqual(expect.arrayContaining([
        {
          connectorKind: "spotify",
          credentialKind: "oauth-token-envelope",
          present: true,
        },
      ]));
      expect(first.sourceInspection.sourceInventories).toHaveLength(6);
      expect(first.sourceInspection.branchInventory.conflictCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceCollection: "library.works",
            sourceIdentity: "legacy-work",
            sourceOccurrence: 0,
            selectedSnapshotId: null,
          }),
        ]),
      );

      const second = await runLegacyLoreImportRehearsal({
        sourceRootPath,
        targetRootPath,
        studioDisplayName: "이음 스튜디오",
        locale: "ko-KR",
        timezone: "Asia/Seoul",
        profile,
        browserExportBundlePath: browserBundlePath,
        browserExportProfile: browserProfile,
      });
      expect(second).toEqual({ ...first, publication: "reused" });
      expect(sha256(await readFile(sourceFilePath))).toBe(sourceChecksum);
      expect(sha256(await readFile(backupFilePath))).toBe(backupChecksum);
      expect(sha256(await readFile(browserBundlePath))).toBe(browserChecksum);
      const reportText = await readFile(first.reportPath, "utf8");
      const report = JSON.parse(reportText);
      expect(report.manuscripts[0]).toMatchObject({
        sourceDocumentId: "legacy-document",
        lengthUtf16: manuscript.length,
      });
      expect(report.sourceInventory.counts).toMatchObject({
        workCount: 1,
        documentCount: 1,
        manuscriptCount: 1,
        orphanManuscriptCount: 0,
      });
      expect(report.manuscriptProofs).toEqual([
        expect.objectContaining({
          sourceDocumentId: "legacy-document",
          sourceOwnershipRef: "legacy-work",
          preservation: "target-revision-checksum-match",
          targetDocumentId: expect.any(String),
          targetRevisionId: expect.any(String),
          sourceChecksumValue: expect.any(String),
          targetChecksumValue: expect.any(String),
          rawItemId: expect.any(String),
        }),
      ]);
      expect(report.manuscriptProofs[0].sourceChecksumValue).toBe(
        report.manuscriptProofs[0].targetChecksumValue,
      );
      expect(report.sharedLoreFinalization).toEqual({
        status: "blocked-by-schema-decision",
        globalBookCount: 0,
        globalEntryCount: 0,
      });
      expect(
        Object.values(report.dispositionCounts).reduce(
          (total: number, count) => total + Number(count),
          0,
        ),
      ).toBe(
        report.counts.sourceItemCount -
          report.browserSourceReceipt.coverage.sourceEntryCount,
      );
      expect(reportText).not.toContain(credentialSecret);
      expect(reportText).not.toContain(manuscript);
      expect(reportText).not.toContain(browserManuscript);
      expect(reportText).not.toContain(browserSecret);
      expect(reportText).not.toContain(browserBundlePath);
      expect(JSON.stringify(report.sourceInspection)).not.toContain(manuscript);
      expect(
        await readFile(
          path.join(targetRootPath, "source-archive", "raw", "lorebooks.json.bak"),
        ),
      ).toEqual(await readFile(backupFilePath));
      expect(
        await readFile(
          path.join(
            targetRootPath,
            "source-archive",
            ...browserProfile.bundleArchive.rawEntrySegments,
          ),
        ),
      ).toEqual(await readFile(browserBundlePath));
      const sourceManifest = await readFile(
        path.join(targetRootPath, "source-archive", "manifest.json"),
        "utf8",
      );
      expect(sourceManifest).not.toContain(credentialSecret);
      expect(sourceManifest).not.toContain(credentialFilePath);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it.runIf(Boolean(process.env.EUM_STUDIO_LEGACY_SOURCE_ROOT?.trim()))(
    "rehearses the configured live source without changing any captured file",
    async () => {
      const sourceRootPath = process.env.EUM_STUDIO_LEGACY_SOURCE_ROOT?.trim();
      if (!sourceRootPath) {
        throw new Error("Live legacy source root is unavailable");
      }
      const parent = await mkdtemp(
        path.join(tmpdir(), `eum-live-legacy-import-${randomUUID()}-`),
      );
      const targetRootPath = path.join(parent, "import-rehearsal");
      const profile = parseLegacyLoreImportProfile(
        JSON.parse(
          readFileSync(
            path.join(process.cwd(), "config", "legacy-lore-import.json"),
            "utf8",
          ),
        ),
      );
      const sources = await Promise.all(profile.source.captures.map(
        async (capture) => {
          const sourcePath = path.join(
            sourceRootPath,
            ...capture.sourceFileSegments,
          );
          const bytes = await readFile(sourcePath);
          return {
            sourcePath,
            sourceLocator: capture.sourceLocator,
            byteLength: bytes.byteLength,
            checksumValue: sha256(bytes),
          };
        },
      ));

      try {
        const result = await runLegacyLoreImportRehearsal({
          sourceRootPath,
          targetRootPath,
          studioDisplayName: "이음 스튜디오",
          locale: "ko-KR",
          timezone: "Asia/Seoul",
          profile,
        });
        expect(result.sourceUnchanged).toBe(true);
        expect(result.sourceSnapshots).toEqual(
          sources.map((source) => expect.objectContaining({
            sourceLocator: source.sourceLocator,
            byteLength: source.byteLength,
            checksumValue: source.checksumValue,
          })),
        );
        expect(result.connectorMetadata).toHaveLength(
          profile.source.connectorProbes.length,
        );
        expect(result.sourceInspection.sourceInventories).toHaveLength(
          profile.source.captures.length,
        );
        expect(
          result.sourceInspection.branchInventory.conflictCandidates,
        ).toHaveLength(0);
        expect(
          result.sourceInspection.branchInventory.identicalCandidates.length,
        ).toBeGreaterThan(0);
        expect(result.counts.uncoveredItemCount).toBe(0);
        const report = JSON.parse(await readFile(result.reportPath, "utf8"));
        expect(report.counts.sourceItemCount).toBe(report.counts.receiptCount);
        expect(report.counts.sourceItemCount).toBe(report.rawItems.length);
        const receiptsFor = (sourceCollection: string) =>
          report.receipts.filter((receipt: { sourceCollection: string }) =>
            receipt.sourceCollection === sourceCollection
          );
        expect(receiptsFor("library.works")).toHaveLength(
          report.sourceInventory.counts.workCount,
        );
        expect(receiptsFor("library.episodes")).toHaveLength(
          report.sourceInventory.counts.documentCount,
        );
        expect(receiptsFor("manuscripts")).toHaveLength(
          report.sourceInventory.counts.manuscriptCount,
        );
        expect(receiptsFor("factTemplatesByEpisode")).toHaveLength(
          report.sourceInventory.counts.structureSnapshotCount,
        );
        expect(receiptsFor("recentWork")).toHaveLength(
          report.sourceInventory.counts.resumeCandidateCount,
        );
        expect(receiptsFor("sessionLogs")).toHaveLength(
          report.sourceInventory.counts.sessionCount,
        );
        expect(receiptsFor("books")).toHaveLength(
          report.sourceInventory.counts.loreBookCount,
        );
        expect(receiptsFor("entries")).toHaveLength(
          report.sourceInventory.counts.loreEntryCount,
        );
        expect(
          [...receiptsFor("books"), ...receiptsFor("entries")].every(
            (receipt: { fieldReceipts: unknown[] }) =>
              receipt.fieldReceipts.length > 0,
          ),
        ).toBe(true);
        expect(
          report.receipts
            .filter((receipt: { disposition: string }) =>
              receipt.disposition === "adapted"
            )
            .every((receipt: { targetEntityId: string | null }) =>
              typeof receipt.targetEntityId === "string" &&
              receipt.targetEntityId.length > 0
            ),
        ).toBe(true);
        expect(
          report.receipts.every((receipt: { rawItemId: string }) =>
            typeof receipt.rawItemId === "string" &&
            receipt.rawItemId.length > 0
          ),
        ).toBe(true);
        expect(report.manuscriptProofs).toHaveLength(
          report.sourceInventory.counts.manuscriptCount,
        );
        expect(
          report.manuscriptProofs.filter(
            (proof: { preservation: string }) =>
              proof.preservation === "target-revision-checksum-match",
          ),
        ).toHaveLength(result.counts.documentCount);
        expect(
          report.manuscriptProofs.filter(
            (proof: { preservation: string }) =>
              proof.preservation === "quarantine-raw-exact",
          ),
        ).toHaveLength(result.counts.orphanManuscriptCount);
        expect(
          report.manuscriptProofs
            .filter((proof: { preservation: string }) =>
              proof.preservation === "target-revision-checksum-match"
            )
            .every((proof: {
              sourceChecksumIdentity: string;
              sourceChecksumValue: string;
              targetChecksumIdentity: string;
              targetChecksumValue: string;
            }) =>
              proof.sourceChecksumIdentity === proof.targetChecksumIdentity &&
              proof.sourceChecksumValue === proof.targetChecksumValue
            ),
        ).toBe(true);
        expect(report.sharedLoreFinalization.status).toBe(
          "blocked-by-schema-decision",
        );
        expect(
          report.issueCounts.find(
            (issue: { issueKind: string }) =>
              issue.issueKind ===
              "shared-lore-canonical-finalization-blocked",
          )?.count ?? 0,
        ).toBe(
          report.sharedLoreFinalization.globalBookCount +
          report.sharedLoreFinalization.globalEntryCount,
        );
        expect(
          Object.values(report.dispositionCounts).reduce(
            (total: number, count) => total + Number(count),
            0,
          ),
        ).toBe(report.counts.sourceItemCount);
        const repeated = await runLegacyLoreImportRehearsal({
          sourceRootPath,
          targetRootPath,
          studioDisplayName: "이음 스튜디오",
          locale: "ko-KR",
          timezone: "Asia/Seoul",
          profile,
        });
        expect(repeated).toEqual({ ...result, publication: "reused" });
        console.info("[live-legacy-rehearsal]", JSON.stringify({
          snapshotCount: result.sourceSnapshots.length,
          connectorMetadataCount: result.connectorMetadata.length,
          identicalCandidateCount:
            result.sourceInspection.branchInventory.identicalCandidates.length,
          conflictCandidateCount:
            result.sourceInspection.branchInventory.conflictCandidates.length,
          issueCount: result.issueCount,
          counts: result.counts,
          sourceInventoryCounts: report.sourceInventory.counts,
          dispositionCounts: report.dispositionCounts,
          manuscriptProofCount: report.manuscriptProofs.length,
          sharedLoreFinalization: report.sharedLoreFinalization,
        }));
        const sourceArchiveRootPath = path.join(
          targetRootPath,
          profile.source.archiveDirectoryName,
        );
        const sourceArchiveProofPaths = [
          path.join(
            sourceArchiveRootPath,
            ...profile.source.manifestEntrySegments,
          ),
          ...profile.source.captures.map((capture) =>
            path.join(sourceArchiveRootPath, ...capture.rawEntrySegments)
          ),
        ];
        const sourceArchiveChecksums = await Promise.all(
          sourceArchiveProofPaths.map(async (proofPath) => ({
            proofPath,
            checksumValue: sha256(await readFile(proofPath)),
          })),
        );
        const discarded = await discardLegacyLoreDryRun({
          dryRunTargetRootPath: result.rehearsalWorkspacePath,
          sourceArchiveRootPath,
          sourceArchiveProofPaths,
          checksum: {
            identity: profile.source.checksumIdentity,
            algorithm: profile.source.checksumAlgorithm,
          },
        });
        expect(discarded.sourceArchiveProofCount).toBe(
          sourceArchiveProofPaths.length,
        );
        for (const proof of sourceArchiveChecksums) {
          expect(sha256(await readFile(proof.proofPath))).toBe(
            proof.checksumValue,
          );
        }
      } finally {
        for (const source of sources) {
          const bytes = await readFile(source.sourcePath);
          expect(bytes.byteLength).toBe(source.byteLength);
          expect(sha256(bytes)).toBe(source.checksumValue);
        }
        await rm(parent, { recursive: true, force: true });
      }
    },
  );
});
