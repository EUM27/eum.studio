import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import {
  parseLegacyBrowserSourceExportBundle,
  serializeCanonicalBrowserSourceValue,
  type LegacyBrowserSourceExportCapture,
  type LegacyBrowserSourceExportEntryReceipt,
  type LegacyBrowserSourceExportProfile,
  type LegacyBrowserSourceExportReceipt,
} from "../../application/migration/browser-source-export";
import {
  inventoryMigrationSourceBranches,
  type MigrationSourceBranch,
  type MigrationSourceBranchInventory,
} from "../../application/migration/source-branch-inventory";

export type LoadNodeBrowserSourceExportResult = {
  readonly capture: LegacyBrowserSourceExportCapture;
  readonly branches: readonly MigrationSourceBranch[];
  readonly branchInventory: MigrationSourceBranchInventory;
  readonly receipt: LegacyBrowserSourceExportReceipt;
};

export type LoadNodeBrowserSourceExportInput = {
  readonly bundlePath: string;
  readonly profile: LegacyBrowserSourceExportProfile;
};

function checksum(
  algorithm: string,
  bytes: Uint8Array,
): string {
  return createHash(algorithm).update(bytes).digest("hex");
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(
    serializeCanonicalBrowserSourceValue(value),
  );
}

function parseBundleJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    return JSON.parse(withoutBom) as unknown;
  } catch {
    throw new Error("Browser source export bundle is not valid JSON");
  }
}

function snapshotId(
  profile: LegacyBrowserSourceExportProfile,
  bundleChecksumValue: string,
  sourceLocator: string,
): string {
  return checksum(
    profile.checksumAlgorithm,
    canonicalBytes([
      profile.formatIdentity,
      profile.formatVersion,
      bundleChecksumValue,
      sourceLocator,
    ]),
  );
}

export async function loadNodeBrowserSourceExport(
  input: LoadNodeBrowserSourceExportInput,
): Promise<LoadNodeBrowserSourceExportResult> {
  if (!isAbsolute(input.bundlePath)) {
    throw new Error("Browser source export bundlePath must be absolute");
  }
  createHash(input.profile.checksumAlgorithm).digest();
  const bundleBytes = await readFile(input.bundlePath);
  const bundleChecksumValue = checksum(
    input.profile.checksumAlgorithm,
    bundleBytes,
  );
  const capture = parseLegacyBrowserSourceExportBundle(
    parseBundleJson(bundleBytes),
    input.profile,
  );

  const groupedItems = new Map<
    string,
    LegacyBrowserSourceExportCapture["items"][number][]
  >();
  for (const item of capture.items) {
    const group = groupedItems.get(item.sourceLocator) ?? [];
    group.push(item);
    groupedItems.set(item.sourceLocator, group);
  }

  const entryReceipts: LegacyBrowserSourceExportEntryReceipt[] = [];
  const branches = Object.freeze([...groupedItems.entries()].map(
    ([sourceLocator, items]): MigrationSourceBranch => {
      const branchKind = items[0]?.branchKind;
      if (
        branchKind === undefined ||
        items.some((item) => item.branchKind !== branchKind)
      ) {
        throw new Error("Browser source export branch kind is inconsistent");
      }
      const branchSnapshotId = snapshotId(
        input.profile,
        bundleChecksumValue,
        sourceLocator,
      );
      const branchItems = Object.freeze(items.map((item) => {
        const checksumValue = checksum(
          input.profile.checksumAlgorithm,
          canonicalBytes(item.value),
        );
        entryReceipts.push(Object.freeze({
          snapshotId: branchSnapshotId,
          sourceLocator,
          branchKind,
          sourceCollection: item.sourceCollection,
          sourceIdentity: item.sourceIdentity,
          sourceOccurrence: item.sourceOccurrence,
          ownershipRef: item.ownershipRef,
          disposition: item.disposition,
          redactedFieldCount: item.redactedFieldCount,
          checksumIdentity: input.profile.checksumIdentity,
          checksumValue,
        }));
        return Object.freeze({
          sourceCollection: item.sourceCollection,
          sourceIdentity: item.sourceIdentity,
          sourceOccurrence: item.sourceOccurrence,
          ownershipRef: item.ownershipRef,
          checksumIdentity: input.profile.checksumIdentity,
          checksumValue,
        });
      }));
      return Object.freeze({
        snapshotId: branchSnapshotId,
        sourceLocator,
        branchKind,
        items: branchItems,
      });
    },
  ));
  if (entryReceipts.length !== capture.coverage.sourceEntryCount) {
    throw new Error("Browser source export receipt coverage is incomplete");
  }
  const branchInventory = inventoryMigrationSourceBranches(branches);
  const receipt = Object.freeze({
    schemaVersion: 1 as const,
    formatIdentity: input.profile.formatIdentity,
    formatVersion: input.profile.formatVersion,
    exportedAt: capture.exportedAt,
    sourceOrigin: capture.sourceOrigin,
    bundleByteLength: bundleBytes.byteLength,
    bundleChecksumIdentity: input.profile.checksumIdentity,
    bundleChecksumValue,
    coverage: capture.coverage,
    branchReceipts: branchInventory.branches,
    entryReceipts: Object.freeze(entryReceipts),
  });
  return Object.freeze({
    capture,
    branches,
    branchInventory,
    receipt,
  });
}
