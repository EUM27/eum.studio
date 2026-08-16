import {
  parseRawJsonInventoryReport,
  type RawJsonInventoryReport,
} from "./raw-json-inventory";

export type MigrationSourceBranchKind =
  | "live-file"
  | "backup-file"
  | "local-storage"
  | "indexed-db";

export type MigrationSourceBranchItem = {
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly sourceOccurrence: number;
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
  readonly sourceOccurrence: number;
  readonly classification: "identical" | "conflict";
  readonly members: readonly MigrationConflictCandidateMember[];
  readonly selectedSnapshotId: null;
};

export type MigrationSourceBranchInventory = {
  readonly branches: readonly MigrationSourceBranchReceipt[];
  readonly identicalCandidates: readonly MigrationConflictCandidate[];
  readonly conflictCandidates: readonly MigrationConflictCandidate[];
};

export type MigrationSourceInventoryReceipt = {
  readonly snapshotId: string;
  readonly sourceLocator: string;
  readonly branchKind: MigrationSourceBranchKind;
  readonly rawJsonInventory: RawJsonInventoryReport;
};

export type MigrationSourceInspection = {
  readonly sourceInventories: readonly MigrationSourceInventoryReceipt[];
  readonly branchInventory: MigrationSourceBranchInventory;
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function itemKey(item: MigrationSourceBranchItem): string {
  return JSON.stringify([
    item.sourceCollection,
    item.sourceIdentity,
    item.sourceOccurrence,
  ]);
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

function inputRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmptyText(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function nonNegativeInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  return value;
}

function parseBranchKind(
  value: unknown,
  label: string,
): MigrationSourceBranchKind {
  if (
    value !== "live-file" &&
    value !== "backup-file" &&
    value !== "local-storage" &&
    value !== "indexed-db"
  ) {
    throw new Error(`${label} contains an unsupported branch kind`);
  }
  return value;
}

export function parseMigrationSourceInspection(
  value: unknown,
): MigrationSourceInspection {
  const label = "MigrationSourceInspection";
  const input = inputRecord(value, label);
  exactFields(input, ["sourceInventories", "branchInventory"], label);
  if (!Array.isArray(input.sourceInventories) || input.sourceInventories.length === 0) {
    throw new Error(`${label}.sourceInventories must be a non-empty array`);
  }
  const snapshotIds = new Set<string>();
  const sourceLocators = new Set<string>();
  const sourceInventories = Object.freeze(input.sourceInventories.map(
    (entry, index) => {
      const entryLabel = `${label}.sourceInventories[${index}]`;
      const entryInput = inputRecord(entry, entryLabel);
      exactFields(
        entryInput,
        ["snapshotId", "sourceLocator", "branchKind", "rawJsonInventory"],
        entryLabel,
      );
      const snapshotId = nonEmptyText(entryInput, "snapshotId", entryLabel);
      const sourceLocator = nonEmptyText(
        entryInput,
        "sourceLocator",
        entryLabel,
      );
      if (snapshotIds.has(snapshotId) || sourceLocators.has(sourceLocator)) {
        throw new Error(`${label}.sourceInventories contains a duplicate source`);
      }
      snapshotIds.add(snapshotId);
      sourceLocators.add(sourceLocator);
      return Object.freeze({
        snapshotId,
        sourceLocator,
        branchKind: parseBranchKind(
          entryInput.branchKind,
          `${entryLabel}.branchKind`,
        ),
        rawJsonInventory: parseRawJsonInventoryReport(
          entryInput.rawJsonInventory,
        ),
      });
    },
  ));

  const branchInventoryInput = inputRecord(
    input.branchInventory,
    `${label}.branchInventory`,
  );
  exactFields(
    branchInventoryInput,
    ["branches", "identicalCandidates", "conflictCandidates"],
    `${label}.branchInventory`,
  );
  if (!Array.isArray(branchInventoryInput.branches)) {
    throw new Error(`${label}.branchInventory.branches must be an array`);
  }
  const branches = Object.freeze(branchInventoryInput.branches.map(
    (entry, index) => {
      const entryLabel = `${label}.branchInventory.branches[${index}]`;
      const entryInput = inputRecord(entry, entryLabel);
      exactFields(
        entryInput,
        ["snapshotId", "sourceLocator", "branchKind", "itemCount"],
        entryLabel,
      );
      return Object.freeze({
        snapshotId: nonEmptyText(entryInput, "snapshotId", entryLabel),
        sourceLocator: nonEmptyText(entryInput, "sourceLocator", entryLabel),
        branchKind: parseBranchKind(
          entryInput.branchKind,
          `${entryLabel}.branchKind`,
        ),
        itemCount: nonNegativeInteger(entryInput, "itemCount", entryLabel),
      });
    },
  ));
  if (branches.length !== sourceInventories.length) {
    throw new Error(`${label} source inventories and branch receipts differ`);
  }
  const branchesBySnapshot = new Map(
    branches.map((branch) => [branch.snapshotId, branch]),
  );
  if (
    branchesBySnapshot.size !== branches.length ||
    sourceInventories.some((source) => {
      const branch = branchesBySnapshot.get(source.snapshotId);
      return (
        branch === undefined ||
        branch.sourceLocator !== source.sourceLocator ||
        branch.branchKind !== source.branchKind
      );
    })
  ) {
    throw new Error(`${label} source inventories and branch receipts differ`);
  }

  const candidateKeys = new Set<string>();
  const parseCandidates = (
    candidateValue: unknown,
    classification: "identical" | "conflict",
  ): readonly MigrationConflictCandidate[] => {
    const candidatesLabel = `${label}.branchInventory.${classification}Candidates`;
    if (!Array.isArray(candidateValue)) {
      throw new Error(`${candidatesLabel} must be an array`);
    }
    return Object.freeze(candidateValue.map((entry, index) => {
      const entryLabel = `${candidatesLabel}[${index}]`;
      const entryInput = inputRecord(entry, entryLabel);
      exactFields(
        entryInput,
        [
          "sourceCollection",
          "sourceIdentity",
          "sourceOccurrence",
          "classification",
          "members",
          "selectedSnapshotId",
        ],
        entryLabel,
      );
      if (
        entryInput.classification !== classification ||
        entryInput.selectedSnapshotId !== null ||
        !Array.isArray(entryInput.members) ||
        entryInput.members.length < 2
      ) {
        throw new Error(`${entryLabel} candidate evidence is invalid`);
      }
      const sourceCollection = nonEmptyText(
        entryInput,
        "sourceCollection",
        entryLabel,
      );
      const sourceIdentity = nonEmptyText(
        entryInput,
        "sourceIdentity",
        entryLabel,
      );
      const sourceOccurrence = nonNegativeInteger(
        entryInput,
        "sourceOccurrence",
        entryLabel,
      );
      const candidateKey = JSON.stringify([
        sourceCollection,
        sourceIdentity,
        sourceOccurrence,
      ]);
      if (candidateKeys.has(candidateKey)) {
        throw new Error(`${label}.branchInventory contains a duplicate candidate`);
      }
      candidateKeys.add(candidateKey);
      const memberSnapshots = new Set<string>();
      const members = Object.freeze(entryInput.members.map((member, memberIndex) => {
        const memberLabel = `${entryLabel}.members[${memberIndex}]`;
        const memberInput = inputRecord(member, memberLabel);
        exactFields(
          memberInput,
          [
            "snapshotId",
            "sourceLocator",
            "branchKind",
            "ownershipRef",
            "checksumIdentity",
            "checksumValue",
          ],
          memberLabel,
        );
        const snapshotId = nonEmptyText(memberInput, "snapshotId", memberLabel);
        const sourceLocator = nonEmptyText(
          memberInput,
          "sourceLocator",
          memberLabel,
        );
        const branchKind = parseBranchKind(
          memberInput.branchKind,
          `${memberLabel}.branchKind`,
        );
        const branch = branchesBySnapshot.get(snapshotId);
        if (
          memberSnapshots.has(snapshotId) ||
          branch === undefined ||
          branch.sourceLocator !== sourceLocator ||
          branch.branchKind !== branchKind
        ) {
          throw new Error(`${entryLabel} references an unknown source branch`);
        }
        memberSnapshots.add(snapshotId);
        const ownershipRef = memberInput.ownershipRef;
        if (
          ownershipRef !== null &&
          (typeof ownershipRef !== "string" || ownershipRef.length === 0)
        ) {
          throw new Error(`${memberLabel}.ownershipRef is invalid`);
        }
        return Object.freeze({
          snapshotId,
          sourceLocator,
          branchKind,
          ownershipRef,
          checksumIdentity: nonEmptyText(
            memberInput,
            "checksumIdentity",
            memberLabel,
          ),
          checksumValue: nonEmptyText(
            memberInput,
            "checksumValue",
            memberLabel,
          ),
        });
      }));
      if (sameCandidateEvidence(members) !== (classification === "identical")) {
        throw new Error(`${entryLabel} classification does not match its evidence`);
      }
      return Object.freeze({
        sourceCollection,
        sourceIdentity,
        sourceOccurrence,
        classification,
        members,
        selectedSnapshotId: null,
      });
    }));
  };

  return Object.freeze({
    sourceInventories,
    branchInventory: Object.freeze({
      branches,
      identicalCandidates: parseCandidates(
        branchInventoryInput.identicalCandidates,
        "identical",
      ),
      conflictCandidates: parseCandidates(
        branchInventoryInput.conflictCandidates,
        "conflict",
      ),
    }),
  });
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
      readonly sourceOccurrence: number;
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
        !Number.isSafeInteger(item.sourceOccurrence) ||
        item.sourceOccurrence < 0 ||
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
        sourceOccurrence: item.sourceOccurrence,
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
        sourceOccurrence: group.sourceOccurrence,
        classification: sameCandidateEvidence(members)
          ? "identical"
          : "conflict",
        members,
        selectedSnapshotId: null,
      });
    })
    .sort((left, right) =>
      compareText(
        `${left.sourceCollection}:${left.sourceIdentity}:${left.sourceOccurrence}`,
        `${right.sourceCollection}:${right.sourceIdentity}:${right.sourceOccurrence}`,
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
