import { describe, expect, it } from "vitest";

import {
  parseLegacyLoreImportRehearsalActionResult,
} from "./legacy-lore-import-contract";

describe("legacy lore import rehearsal contract", () => {
  it("parses a completed source-preserving rehearsal result", () => {
    const result = parseLegacyLoreImportRehearsalActionResult({
      schemaVersion: 1,
      status: "completed",
      summary: {
        schemaVersion: 1,
        sourceRootPath: "D:\\legacy",
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
          writingSessionCount: 1,
          rawItemCount: 1,
          receiptCount: 3,
          sourceItemCount: 3,
          uncoveredItemCount: 0,
          orphanManuscriptCount: 0,
        },
      },
    });

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.summary.sourceUnchanged).toBe(true);
      expect(result.summary.counts.uncoveredItemCount).toBe(0);
    }
  });
});
