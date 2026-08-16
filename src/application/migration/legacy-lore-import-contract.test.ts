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
        sourceSnapshots: [
          {
            sourceSnapshotId: "snapshot",
            sourceLocator: "data/lorebooks.json",
            checksumIdentity: "sha256",
            checksumValue: "checksum",
            byteLength: 10,
          },
          {
            sourceSnapshotId: "backup-snapshot",
            sourceLocator: "data/lorebooks.json.bak",
            checksumIdentity: "sha256",
            checksumValue: "backup-checksum",
            byteLength: 12,
          },
        ],
        connectorMetadata: [
          {
            connectorKind: "spotify",
            credentialKind: "oauth-token-envelope",
            present: true,
          },
        ],
        browserSourceReceipt: {
          schemaVersion: 1,
          formatIdentity: "eum-browser-source-export",
          formatVersion: "1",
          exportedAt: "2026-08-07T00:00:00.000Z",
          sourceOrigin: "http://localhost",
          bundleByteLength: 20,
          bundleChecksumIdentity: "sha256-v1",
          bundleChecksumValue: "browser-bundle-checksum",
          coverage: {
            sourceEntryCount: 1,
            capturedEntryCount: 1,
            uncoveredEntryCount: 0,
          },
          branchReceipts: [{
            snapshotId: "browser-snapshot",
            sourceLocator: "browser-export:localStorage",
            branchKind: "local-storage",
            itemCount: 1,
          }],
          entryReceipts: [{
            snapshotId: "browser-snapshot",
            sourceLocator: "browser-export:localStorage",
            branchKind: "local-storage",
            sourceCollection: "manuscripts",
            sourceIdentity: "document-a",
            sourceOccurrence: 0,
            ownershipRef: "source-work",
            disposition: "captured",
            redactedFieldCount: 0,
            checksumIdentity: "sha256-v1",
            checksumValue: "browser-entry-checksum",
          }],
        },
        sourceInspection: {
          sourceInventories: [
            {
              snapshotId: "snapshot",
              sourceLocator: "data/lorebooks.json",
              branchKind: "live-file",
              rawJsonInventory: {
                entries: [{
                  path: "$.library.works[]",
                  observedKinds: ["object"],
                  occurrenceCount: 1,
                }],
                objectFields: [{
                  objectPath: "$.library.works[]",
                  occurrenceCount: 1,
                  fields: ["id", "title"],
                }],
                unknownFields: [],
                secretLikePaths: [],
              },
            },
            {
              snapshotId: "backup-snapshot",
              sourceLocator: "data/lorebooks.json.bak",
              branchKind: "backup-file",
              rawJsonInventory: {
                entries: [{
                  path: "$.library.works[]",
                  observedKinds: ["object"],
                  occurrenceCount: 1,
                }],
                objectFields: [{
                  objectPath: "$.library.works[]",
                  occurrenceCount: 1,
                  fields: ["id", "title"],
                }],
                unknownFields: [],
                secretLikePaths: [],
              },
            },
          ],
          branchInventory: {
            branches: [
              {
                snapshotId: "snapshot",
                sourceLocator: "data/lorebooks.json",
                branchKind: "live-file",
                itemCount: 1,
              },
              {
                snapshotId: "backup-snapshot",
                sourceLocator: "data/lorebooks.json.bak",
                branchKind: "backup-file",
                itemCount: 1,
              },
            ],
            identicalCandidates: [{
              sourceCollection: "library.works",
              sourceIdentity: "source-work",
              sourceOccurrence: 0,
              classification: "identical",
              members: [
                {
                  snapshotId: "snapshot",
                  sourceLocator: "data/lorebooks.json",
                  branchKind: "live-file",
                  ownershipRef: "source-work",
                  checksumIdentity: "sha256-json-utf8",
                  checksumValue: "work-checksum",
                },
                {
                  snapshotId: "backup-snapshot",
                  sourceLocator: "data/lorebooks.json.bak",
                  branchKind: "backup-file",
                  ownershipRef: "source-work",
                  checksumIdentity: "sha256-json-utf8",
                  checksumValue: "work-checksum",
                },
              ],
              selectedSnapshotId: null,
            }],
            conflictCandidates: [],
          },
        },
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
      expect(result.summary.sourceSnapshots).toHaveLength(2);
      expect(result.summary.connectorMetadata).toEqual([
        {
          connectorKind: "spotify",
          credentialKind: "oauth-token-envelope",
          present: true,
        },
      ]);
      expect(result.summary.browserSourceReceipt?.coverage).toEqual({
        sourceEntryCount: 1,
        capturedEntryCount: 1,
        uncoveredEntryCount: 0,
      });
      expect(
        result.summary.sourceInspection.branchInventory.identicalCandidates[0],
      ).toMatchObject({
        classification: "identical",
        selectedSnapshotId: null,
      });
      expect(result.summary.counts.uncoveredItemCount).toBe(0);
    }
  });
});
