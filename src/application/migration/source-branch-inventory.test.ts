import { describe, expect, it } from "vitest";

import { inventoryMigrationSourceBranches } from "./source-branch-inventory";

describe("migration source branch inventory", () => {
  it("keeps live, backup, and browser branches separate without selecting a conflict winner", () => {
    const inventory = inventoryMigrationSourceBranches([
      {
        snapshotId: "live",
        sourceLocator: "data/lorebooks.json",
        branchKind: "live-file",
        items: [
          {
            sourceCollection: "manuscripts",
            sourceIdentity: "document-a",
            ownershipRef: "work-a",
            checksumIdentity: "sha256",
            checksumValue: "same-body",
          },
          {
            sourceCollection: "manuscripts",
            sourceIdentity: "document-b",
            ownershipRef: "work-a",
            checksumIdentity: "sha256",
            checksumValue: "live-body",
          },
        ],
      },
      {
        snapshotId: "backup",
        sourceLocator: "data/lorebooks.json.bak",
        branchKind: "backup-file",
        items: [{
          sourceCollection: "manuscripts",
          sourceIdentity: "document-a",
          ownershipRef: "work-a",
          checksumIdentity: "sha256",
          checksumValue: "same-body",
        }],
      },
      {
        snapshotId: "browser",
        sourceLocator: "localStorage:eum-editor:manuscript:document-b",
        branchKind: "local-storage",
        items: [{
          sourceCollection: "manuscripts",
          sourceIdentity: "document-b",
          ownershipRef: "work-a",
          checksumIdentity: "sha256",
          checksumValue: "browser-body",
        }],
      },
    ]);

    expect(inventory.branches).toHaveLength(3);
    expect(inventory.identicalCandidates).toEqual([
      expect.objectContaining({
        sourceIdentity: "document-a",
        classification: "identical",
        selectedSnapshotId: null,
      }),
    ]);
    expect(inventory.conflictCandidates).toEqual([
      expect.objectContaining({
        sourceIdentity: "document-b",
        classification: "conflict",
        selectedSnapshotId: null,
      }),
    ]);
  });
});
