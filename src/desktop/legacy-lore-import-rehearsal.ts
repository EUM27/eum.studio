import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { encodeDurableText } from "../application/persistence/change-batch";
import {
  createLegacyLoreDryRunPlan,
  type LegacyLoreTargetIdentityInput,
} from "../application/migration/legacy-lore-dry-run";
import type {
  LegacyLoreImportRehearsalSummary,
} from "../application/migration/legacy-lore-import-contract";
import type {
  LegacyLoreImportProfile,
} from "../application/migration/legacy-lore-import-profile";
import type {
  SourceArchiveManifest,
  SourceSnapshotReceipt,
} from "../application/migration/source-archive";
import { exportNodeSourceArchive } from "../platform/migration/node-source-archive-exporter";
import { writeLegacyLoreDryRun } from "./legacy-lore-dry-run-writer";

type ErrorWithCode = { readonly code?: unknown };

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(canonicalValue(value)));
}

function checksum(algorithm: string, bytes: Uint8Array): string {
  return createHash(algorithm).update(bytes).digest("hex");
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await stat(value);
    return true;
  } catch (error) {
    if ((error as ErrorWithCode).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function contains(parent: string, candidate: string): boolean {
  const relation = path.relative(parent, candidate);
  return (
    relation.length === 0 ||
    (!path.isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${path.sep}`))
  );
}

function assertSeparateRoots(sourceRoot: string, targetRoot: string): void {
  if (contains(sourceRoot, targetRoot) || contains(targetRoot, sourceRoot)) {
    throw new Error("Legacy source and rehearsal target must not overlap");
  }
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(
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

function archiveEntryPath(root: string, segments: readonly string[]): string {
  return path.resolve(root, ...segments);
}

async function readExistingSnapshot(input: {
  readonly archiveRoot: string;
  readonly profile: LegacyLoreImportProfile;
}): Promise<{ readonly manifest: SourceArchiveManifest; readonly snapshot: SourceSnapshotReceipt }> {
  const manifestValue: unknown = JSON.parse(
    await readFile(
      archiveEntryPath(input.archiveRoot, input.profile.source.manifestEntrySegments),
      "utf8",
    ),
  );
  const manifest = readRecord(manifestValue, "Source archive manifest");
  const format = readRecord(manifest.format, "Source archive format");
  const snapshots = manifest.snapshots;
  if (
    manifest.schemaVersion !== 1 ||
    readString(manifest, "sourceProfileId", "Source archive manifest") !==
      input.profile.source.sourceProfileId ||
    readString(manifest, "checksumIdentity", "Source archive manifest") !==
      input.profile.source.checksumIdentity ||
    readString(format, "identity", "Source archive format") !==
      input.profile.source.formatIdentity ||
    readString(format, "version", "Source archive format") !==
      input.profile.source.formatVersion ||
    !Array.isArray(snapshots) ||
    snapshots.length !== 1
  ) {
    throw new Error("Existing source archive does not match the import profile");
  }
  const snapshot = readRecord(snapshots[0], "Source snapshot");
  const parsedSnapshot = Object.freeze({
    snapshotId: readString(snapshot, "snapshotId", "Source snapshot"),
    sourceKind: "file" as const,
    sourceLocator: readString(snapshot, "sourceLocator", "Source snapshot"),
    capturedAt: readString(snapshot, "capturedAt", "Source snapshot"),
    byteLength: snapshot.byteLength,
    checksumIdentity: readString(snapshot, "checksumIdentity", "Source snapshot"),
    checksumValue: readString(snapshot, "checksumValue", "Source snapshot"),
    rawEntry: readString(snapshot, "rawEntry", "Source snapshot"),
  });
  if (
    snapshot.sourceKind !== "file" ||
    parsedSnapshot.sourceLocator !== input.profile.source.sourceLocator ||
    parsedSnapshot.rawEntry !== input.profile.source.rawEntrySegments.join("/") ||
    parsedSnapshot.checksumIdentity !== input.profile.source.checksumIdentity ||
    typeof parsedSnapshot.byteLength !== "number" ||
    !Number.isSafeInteger(parsedSnapshot.byteLength) ||
    parsedSnapshot.byteLength < 0
  ) {
    throw new Error("Existing source snapshot does not match the import profile");
  }
  return Object.freeze({
    manifest: manifestValue as SourceArchiveManifest,
    snapshot: parsedSnapshot as SourceSnapshotReceipt,
  });
}

function targetIdentity(
  algorithm: string,
  identity: LegacyLoreTargetIdentityInput,
): string {
  return checksum(algorithm, canonicalBytes(identity));
}

export async function runLegacyLoreImportRehearsal(input: {
  readonly sourceRootPath: string;
  readonly targetRootPath: string;
  readonly studioDisplayName: string;
  readonly locale: string;
  readonly timezone: string;
  readonly profile: LegacyLoreImportProfile;
}): Promise<LegacyLoreImportRehearsalSummary> {
  if (!path.isAbsolute(input.sourceRootPath) || !path.isAbsolute(input.targetRootPath)) {
    throw new Error("Legacy source and rehearsal target paths must be absolute");
  }
  const sourceRoot = path.resolve(input.sourceRootPath);
  const targetRoot = path.resolve(input.targetRootPath);
  assertSeparateRoots(sourceRoot, targetRoot);
  const sourceFilePath = path.resolve(
    sourceRoot,
    ...input.profile.source.sourceFileSegments,
  );
  const sourceBefore = await readFile(sourceFilePath);
  const sourceChecksumBefore = checksum(
    input.profile.source.checksumAlgorithm,
    sourceBefore,
  );
  const targetExisted = await pathExists(targetRoot);
  if (!targetExisted) {
    await mkdir(targetRoot, { recursive: false });
  }
  const archiveRoot = path.join(
    targetRoot,
    input.profile.source.archiveDirectoryName,
  );
  const rehearsalRoot = path.join(
    targetRoot,
    input.profile.rehearsal.directoryName,
  );

  try {
    let manifest: SourceArchiveManifest;
    let snapshot: SourceSnapshotReceipt;
    if (targetExisted) {
      ({ manifest, snapshot } = await readExistingSnapshot({
        archiveRoot,
        profile: input.profile,
      }));
    } else {
      const exported = await exportNodeSourceArchive({
        sourceProfileId: input.profile.source.sourceProfileId,
        format: {
          identity: input.profile.source.formatIdentity,
          version: input.profile.source.formatVersion,
        },
        checksum: {
          identity: input.profile.source.checksumIdentity,
          algorithm: input.profile.source.checksumAlgorithm,
        },
        clock: { now: () => new Date().toISOString() },
        captures: [{
          sourcePath: sourceFilePath,
          sourceLocator: input.profile.source.sourceLocator,
          archiveEntrySegments: input.profile.source.rawEntrySegments,
        }],
        connectorProbes: [],
        manifestEntrySegments: input.profile.source.manifestEntrySegments,
        temporaryArchiveRootPath: path.join(
          targetRoot,
          `.${input.profile.source.archiveDirectoryName}.${randomUUID()}.tmp`,
        ),
        finalArchiveRootPath: archiveRoot,
      });
      manifest = exported.manifest;
      const exportedSnapshot = manifest.snapshots[0];
      if (exportedSnapshot === undefined) {
        throw new Error("Source archive did not capture the configured source");
      }
      snapshot = exportedSnapshot;
    }

    if (
      snapshot.checksumValue !== sourceChecksumBefore ||
      snapshot.byteLength !== sourceBefore.byteLength
    ) {
      throw new Error("Current legacy source differs from the sealed snapshot");
    }
    const archivedBytes = await readFile(
      archiveEntryPath(archiveRoot, input.profile.source.rawEntrySegments),
    );
    if (
      archivedBytes.byteLength !== snapshot.byteLength ||
      checksum(input.profile.source.checksumAlgorithm, archivedBytes) !==
        snapshot.checksumValue
    ) {
      throw new Error("Sealed legacy source bytes do not match their receipt");
    }
    const payload: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(archivedBytes),
    );
    const plan = createLegacyLoreDryRunPlan({
      mapperVersion: input.profile.rehearsal.mapperVersion,
      sourceSnapshotId: snapshot.snapshotId,
      sourceSnapshotChecksumValue: snapshot.checksumValue,
      createdAt: manifest.capturedAt,
      resumeWorkspaceMode: input.profile.rehearsal.resumeWorkspaceMode,
      completedWritingSessionState:
        input.profile.rehearsal.completedWritingSessionState,
      secretLikeFieldFragments:
        input.profile.rehearsal.secretLikeFieldFragments,
      secretRedactionValue: input.profile.rehearsal.secretRedactionValue,
      payload,
      deriveTargetId: (identity) =>
        targetIdentity(input.profile.source.checksumAlgorithm, identity),
      describeManuscript: (text) => {
        const bytes = encodeDurableText(text);
        return Object.freeze({
          checksumIdentity: input.profile.content.manuscriptChecksumIdentity,
          checksumValue: checksum(
            input.profile.content.manuscriptChecksumAlgorithm,
            bytes,
          ),
          byteLength: bytes.byteLength,
          lengthUtf16: text.length,
        });
      },
      describeRawItem: ({ value }) => {
        const bytes = canonicalBytes(value);
        return Object.freeze({
          serializationIdentity: input.profile.content.rawSerializationIdentity,
          checksumIdentity: input.profile.content.rawChecksumIdentity,
          checksumValue: checksum(
            input.profile.content.rawChecksumAlgorithm,
            bytes,
          ),
          byteLength: bytes.byteLength,
          bytes,
        });
      },
    });
    const written = await writeLegacyLoreDryRun({
      targetRootDirectoryPath: rehearsalRoot,
      studioDisplayName: input.studioDisplayName,
      locale: input.locale,
      timezone: input.timezone,
      reportFileName: input.profile.rehearsal.reportFileName,
      anchorPolicy: input.profile.rehearsal.anchorPolicy,
      anchorEvidenceChecksumAlgorithm:
        input.profile.rehearsal.anchorEvidenceChecksumAlgorithm,
      plan,
    });
    const sourceAfter = await readFile(sourceFilePath);
    if (
      sourceAfter.byteLength !== sourceBefore.byteLength ||
      checksum(input.profile.source.checksumAlgorithm, sourceAfter) !==
        sourceChecksumBefore
    ) {
      throw new Error("Legacy source changed during the import rehearsal");
    }
    return Object.freeze({
      schemaVersion: 1,
      sourceRootPath: sourceRoot,
      sourceSnapshotId: snapshot.snapshotId,
      sourceChecksumIdentity: snapshot.checksumIdentity,
      sourceChecksumValue: snapshot.checksumValue,
      sourceByteLength: snapshot.byteLength,
      targetRootPath: targetRoot,
      rehearsalWorkspacePath: rehearsalRoot,
      reportPath: path.join(
        rehearsalRoot,
        input.profile.rehearsal.reportFileName,
      ),
      capturedAt: manifest.capturedAt,
      publication: written.publication,
      sourceUnchanged: true,
      issueCount: plan.inventory.issues.length,
      counts: written.report.counts,
    });
  } catch (error) {
    if (!targetExisted) {
      await rm(targetRoot, { recursive: true, force: true });
    }
    throw error;
  }
}
