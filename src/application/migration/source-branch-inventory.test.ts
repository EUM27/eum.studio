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
            sourceOccurrence: 0,
            ownershipRef: "work-a",
            checksumIdentity: "sha256",
            checksumValue: "same-body",
          },
          {
            sourceCollection: "manuscripts",
            sourceIdentity: "document-b",
            sourceOccurrence: 0,
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
          sourceOccurrence: 0,
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
          sourceOccurrence: 0,
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
        sourceOccurrence: 0,
        classification: "identical",
        selectedSnapshotId: null,
      }),
    ]);
    expect(inventory.conflictCandidates).toEqual([
      expect.objectContaining({
        sourceIdentity: "document-b",
        sourceOccurrence: 0,
        classification: "conflict",
        selectedSnapshotId: null,
      }),
    ]);
  });

  it("keeps repeated source identities separate by occurrence", () => {
    const inventory = inventoryMigrationSourceBranches([
      {
        snapshotId: "live",
        sourceLocator: "data/lorebooks.json",
        branchKind: "live-file",
        items: [
          {
            sourceCollection: "entries",
            sourceIdentity: "duplicate-entry",
            sourceOccurrence: 0,
            ownershipRef: "work-a",
            checksumIdentity: "sha256",
            checksumValue: "first",
          },
          {
            sourceCollection: "entries",
            sourceIdentity: "duplicate-entry",
            sourceOccurrence: 1,
            ownershipRef: "work-a",
            checksumIdentity: "sha256",
            checksumValue: "second-live",
          },
        ],
      },
      {
        snapshotId: "backup",
        sourceLocator: "data/lorebooks.json.bak",
        branchKind: "backup-file",
        items: [
          {
            sourceCollection: "entries",
            sourceIdentity: "duplicate-entry",
            sourceOccurrence: 0,
            ownershipRef: "work-a",
            checksumIdentity: "sha256",
            checksumValue: "first",
          },
          {
            sourceCollection: "entries",
            sourceIdentity: "duplicate-entry",
            sourceOccurrence: 1,
            ownershipRef: "work-a",
            checksumIdentity: "sha256",
            checksumValue: "second-backup",
          },
        ],
      },
    ]);

    expect(inventory.identicalCandidates).toEqual([
      expect.objectContaining({ sourceOccurrence: 0 }),
    ]);
    expect(inventory.conflictCandidates).toEqual([
      expect.objectContaining({
        sourceOccurrence: 1,
        selectedSnapshotId: null,
      }),
    ]);
  });
});
