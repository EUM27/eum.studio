export type MigrationSourceBranchKind =
  | "live-file"
  | "backup-file"
  | "local-storage"
  | "indexed-db";

export type MigrationSourceBranchItem = {
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly ownershipRef: string | null;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
};

export type MigrationSourceBranch = {
  readonly snapshotId: string;
  readonly sourceLocator: string;
  readonly branchKind: MigrationSourceBranchKind;
  readonly items: readonly MigrationSourceBranchItem[];
};

export type MigrationSourceBranchReceipt = {
  readonly snapshotId: string;
  readonly sourceLocator: string;
  readonly branchKind: MigrationSourceBranchKind;
  readonly itemCount: number;
};

export type MigrationConflictCandidateMember = {
  readonly snapshotId: string;
  readonly sourceLocator: string;
  readonly branchKind: MigrationSourceBranchKind;
  readonly ownershipRef: string | null;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
};

export type MigrationConflictCandidate = {
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly classification: "identical" | "conflict";
  readonly members: readonly MigrationConflictCandidateMember[];
  readonly selectedSnapshotId: null;
};

export type MigrationSourceBranchInventory = {
  readonly branches: readonly MigrationSourceBranchReceipt[];
  readonly identicalCandidates: readonly MigrationConflictCandidate[];
  readonly conflictCandidates: readonly MigrationConflictCandidate[];
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function itemKey(item: MigrationSourceBranchItem): string {
  return JSON.stringify([item.sourceCollection, item.sourceIdentity]);
}

function sameCandidateEvidence(
  members: readonly MigrationConflictCandidateMember[],
): boolean {
  const first = members[0];
  if (first === undefined) {
    return true;
  }
  return members.every((member) =>
    member.ownershipRef === first.ownershipRef &&
    member.checksumIdentity === first.checksumIdentity &&
    member.checksumValue === first.checksumValue,
  );
}

export function inventoryMigrationSourceBranches(
  branches: readonly MigrationSourceBranch[],
): MigrationSourceBranchInventory {
  const snapshotIds = new Set<string>();
  const grouped = new Map<
    string,
    {
      readonly sourceCollection: string;
      readonly sourceIdentity: string;
      readonly members: MigrationConflictCandidateMember[];
    }
  >();
  for (const branch of branches) {
    if (
      branch.snapshotId.length === 0 ||
      branch.sourceLocator.length === 0 ||
      snapshotIds.has(branch.snapshotId)
    ) {
      throw new Error("Migration source branches require unique identities");
    }
    snapshotIds.add(branch.snapshotId);
    const itemIdentities = new Set<string>();
    for (const item of branch.items) {
      if (
        item.sourceCollection.length === 0 ||
        item.sourceIdentity.length === 0 ||
        item.checksumIdentity.length === 0 ||
        item.checksumValue.length === 0
      ) {
        throw new Error("Migration source branch item is incomplete");
      }
      const key = itemKey(item);
      if (itemIdentities.has(key)) {
        throw new Error("Migration source branch contains a duplicate item");
      }
      itemIdentities.add(key);
      const group = grouped.get(key) ?? {
        sourceCollection: item.sourceCollection,
        sourceIdentity: item.sourceIdentity,
        members: [],
      };
      group.members.push(Object.freeze({
        snapshotId: branch.snapshotId,
        sourceLocator: branch.sourceLocator,
        branchKind: branch.branchKind,
        ownershipRef: item.ownershipRef,
        checksumIdentity: item.checksumIdentity,
        checksumValue: item.checksumValue,
      }));
      grouped.set(key, group);
    }
  }

  const candidates = [...grouped.values()]
    .filter((group) => group.members.length > 1)
    .map((group): MigrationConflictCandidate => {
      const members = Object.freeze(
        group.members.sort((left, right) =>
          compareText(
            `${left.branchKind}:${left.sourceLocator}:${left.snapshotId}`,
            `${right.branchKind}:${right.sourceLocator}:${right.snapshotId}`,
          ),
        ),
      );
      return Object.freeze({
        sourceCollection: group.sourceCollection,
        sourceIdentity: group.sourceIdentity,
        classification: sameCandidateEvidence(members)
          ? "identical"
          : "conflict",
        members,
        selectedSnapshotId: null,
      });
    })
    .sort((left, right) =>
      compareText(
        `${left.sourceCollection}:${left.sourceIdentity}`,
        `${right.sourceCollection}:${right.sourceIdentity}`,
      ),
    );
  return Object.freeze({
    branches: Object.freeze(
      branches.map((branch) => Object.freeze({
        snapshotId: branch.snapshotId,
        sourceLocator: branch.sourceLocator,
        branchKind: branch.branchKind,
        itemCount: branch.items.length,
      })),
    ),
    identicalCandidates: Object.freeze(
      candidates.filter((candidate) => candidate.classification === "identical"),
    ),
    conflictCandidates: Object.freeze(
      candidates.filter((candidate) => candidate.classification === "conflict"),
    ),
  });
}
