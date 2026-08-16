import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { encodeDurableText } from "../application/persistence/change-batch";
import {
  createLegacyLoreDryRunPlan,
  type LegacyLoreDryRunPlan,
  type LegacyLoreTargetIdentityInput,
} from "../application/migration/legacy-lore-dry-run";
import {
  parseRawJsonInventory,
  type RawJsonInventoryProfile,
} from "../application/migration/raw-json-inventory";
import type {
  LegacyBrowserSourceExportProfile,
} from "../application/migration/browser-source-export";
import {
  inventoryMigrationSourceBranches,
  type MigrationSourceInspection,
} from "../application/migration/source-branch-inventory";
import type {
  LegacyLoreImportRehearsalSummary,
} from "../application/migration/legacy-lore-import-contract";
import type {
  LegacyLoreImportProfile,
} from "../application/migration/legacy-lore-import-profile";
import type {
  ConnectorMetadataReceipt,
  SourceArchiveManifest,
  SourceSnapshotReceipt,
} from "../application/migration/source-archive";
import { exportNodeSourceArchive } from "../platform/migration/node-source-archive-exporter";
import {
  loadNodeBrowserSourceExport,
  type LoadNodeBrowserSourceExportResult,
} from "../platform/migration/node-browser-source-export-loader";
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

async function readExistingArchive(input: {
  readonly archiveRoot: string;
  readonly profile: LegacyLoreImportProfile;
  readonly expectedCaptures: readonly {
    readonly sourceLocator: string;
    readonly rawEntrySegments: readonly string[];
  }[];
}): Promise<{
  readonly manifest: SourceArchiveManifest;
  readonly snapshots: readonly SourceSnapshotReceipt[];
}> {
  const manifestValue: unknown = JSON.parse(
    await readFile(
      archiveEntryPath(input.archiveRoot, input.profile.source.manifestEntrySegments),
      "utf8",
    ),
  );
  const manifest = readRecord(manifestValue, "Source archive manifest");
  const format = readRecord(manifest.format, "Source archive format");
  const snapshots = manifest.snapshots;
  const connectorMetadata = manifest.connectorMetadata;
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
    snapshots.length !== input.expectedCaptures.length ||
    !Array.isArray(connectorMetadata) ||
    connectorMetadata.length !== input.profile.source.connectorProbes.length
  ) {
    throw new Error("Existing source archive does not match the import profile");
  }
  const snapshotByLocator = new Map<string, SourceSnapshotReceipt>();
  for (const [index, value] of snapshots.entries()) {
    const label = `Source snapshot[${index}]`;
    const snapshot = readRecord(value, label);
    const parsedSnapshot = Object.freeze({
      snapshotId: readString(snapshot, "snapshotId", label),
      sourceKind: "file" as const,
      sourceLocator: readString(snapshot, "sourceLocator", label),
      capturedAt: readString(snapshot, "capturedAt", label),
      byteLength: snapshot.byteLength,
      checksumIdentity: readString(snapshot, "checksumIdentity", label),
      checksumValue: readString(snapshot, "checksumValue", label),
      rawEntry: readString(snapshot, "rawEntry", label),
    });
    if (
      snapshot.sourceKind !== "file" ||
      parsedSnapshot.checksumIdentity !== input.profile.source.checksumIdentity ||
      typeof parsedSnapshot.byteLength !== "number" ||
      !Number.isSafeInteger(parsedSnapshot.byteLength) ||
      parsedSnapshot.byteLength < 0 ||
      snapshotByLocator.has(parsedSnapshot.sourceLocator)
    ) {
      throw new Error("Existing source snapshot does not match the import profile");
    }
    snapshotByLocator.set(
      parsedSnapshot.sourceLocator,
      parsedSnapshot as SourceSnapshotReceipt,
    );
  }
  const parsedSnapshots = input.expectedCaptures.map((capture) => {
    const snapshot = snapshotByLocator.get(capture.sourceLocator);
    if (
      snapshot === undefined ||
      snapshot.rawEntry !== capture.rawEntrySegments.join("/")
    ) {
      throw new Error("Existing source snapshot does not match the import profile");
    }
    return snapshot;
  });
  const metadataByIdentity = new Map<string, ConnectorMetadataReceipt>();
  for (const [index, value] of connectorMetadata.entries()) {
    const label = `Connector metadata[${index}]`;
    const metadata = readRecord(value, label);
    const connectorKind = readString(metadata, "connectorKind", label);
    const credentialKind = readString(metadata, "credentialKind", label);
    if (typeof metadata.present !== "boolean") {
      throw new Error("Existing connector metadata does not match the import profile");
    }
    const identity = JSON.stringify([connectorKind, credentialKind]);
    if (metadataByIdentity.has(identity)) {
      throw new Error("Existing connector metadata does not match the import profile");
    }
    metadataByIdentity.set(identity, Object.freeze({
      connectorKind,
      credentialKind,
      present: metadata.present,
    }));
  }
  for (const probe of input.profile.source.connectorProbes) {
    if (
      !metadataByIdentity.has(
        JSON.stringify([probe.connectorKind, probe.credentialKind]),
      )
    ) {
      throw new Error("Existing connector metadata does not match the import profile");
    }
  }
  return Object.freeze({
    manifest: manifestValue as SourceArchiveManifest,
    snapshots: Object.freeze(parsedSnapshots),
  });
}

function targetIdentity(
  algorithm: string,
  identity: LegacyLoreTargetIdentityInput,
): string {
  return checksum(algorithm, canonicalBytes(identity));
}

function rawInventoryProfile(
  secretLikeFieldFragments: readonly string[],
): RawJsonInventoryProfile {
  return Object.freeze({
    dynamicObjectPaths: Object.freeze([
      "$.manuscripts",
      "$.recentWork",
      "$.factTemplatesByEpisode",
    ]),
    knownObjectFields: Object.freeze([
      Object.freeze({
        objectPath: "$",
        fields: Object.freeze([
          "library",
          "manuscripts",
          "recentWork",
          "factTemplatesByEpisode",
          "sessionLogs",
          "books",
          "entries",
          "characters",
          "plotThreads",
          "protectedTerms",
          "fragments",
          "templateSchemas",
          "schemaVersion",
          "editorTypography",
          "appSettings",
          "inspirationPools",
          "sceneRuleSets",
        ]),
      }),
      Object.freeze({
        objectPath: "$.library",
        fields: Object.freeze(["works", "episodeFolders", "episodes"]),
      }),
      Object.freeze({
        objectPath: "$.library.works[]",
        fields: Object.freeze([
          "id",
          "title",
          "description",
          "episodeIds",
          "createdAt",
          "updatedAt",
        ]),
      }),
      Object.freeze({
        objectPath: "$.library.episodeFolders[]",
        fields: Object.freeze([
          "id",
          "workId",
          "parentId",
          "title",
          "index",
          "createdAt",
          "updatedAt",
        ]),
      }),
      Object.freeze({
        objectPath: "$.library.episodes[]",
        fields: Object.freeze([
          "id",
          "workId",
          "folderId",
          "title",
          "index",
          "createdAt",
          "updatedAt",
        ]),
      }),
      Object.freeze({
        objectPath: "$.recentWork.*",
        fields: Object.freeze(["episodeId", "cursor", "updatedAt"]),
      }),
      Object.freeze({
        objectPath: "$.sessionLogs[]",
        fields: Object.freeze([
          "id",
          "workId",
          "episodeId",
          "mode",
          "createdAt",
          "startedAt",
          "endedAt",
          "durationMs",
          "charDelta",
          "focusCompletion",
          "focusTargetMs",
          "memo",
          "eventBlockId",
        ]),
      }),
      ...["books", "entries", "characters", "plotThreads", "fragments"]
        .map((collection) => Object.freeze({
          objectPath: `$.${collection}[]`,
          fields: Object.freeze([]),
        })),
    ]),
    secretLikeFieldFragments: Object.freeze([...secretLikeFieldFragments]),
  });
}

function createPlanForSource(input: {
  readonly profile: LegacyLoreImportProfile;
  readonly snapshot: SourceSnapshotReceipt;
  readonly capturedAt: string;
  readonly payload: unknown;
}): LegacyLoreDryRunPlan {
  return createLegacyLoreDryRunPlan({
    mapperVersion: input.profile.rehearsal.mapperVersion,
    sourceSnapshotId: input.snapshot.snapshotId,
    sourceSnapshotChecksumValue: input.snapshot.checksumValue,
    createdAt: input.capturedAt,
    resumeWorkspaceMode: input.profile.rehearsal.resumeWorkspaceMode,
    completedWritingSessionState:
      input.profile.rehearsal.completedWritingSessionState,
    secretLikeFieldFragments:
      input.profile.rehearsal.secretLikeFieldFragments,
    secretRedactionValue: input.profile.rehearsal.secretRedactionValue,
    payload: input.payload,
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
}

export async function runLegacyLoreImportRehearsal(input: {
  readonly sourceRootPath: string;
  readonly targetRootPath: string;
  readonly studioDisplayName: string;
  readonly locale: string;
  readonly timezone: string;
  readonly profile: LegacyLoreImportProfile;
  readonly browserExportBundlePath?: string;
  readonly browserExportProfile?: LegacyBrowserSourceExportProfile;
}): Promise<LegacyLoreImportRehearsalSummary> {
  if (!path.isAbsolute(input.sourceRootPath) || !path.isAbsolute(input.targetRootPath)) {
    throw new Error("Legacy source and rehearsal target paths must be absolute");
  }
  const sourceRoot = path.resolve(input.sourceRootPath);
  const targetRoot = path.resolve(input.targetRootPath);
  assertSeparateRoots(sourceRoot, targetRoot);
  if (
    (input.browserExportBundlePath === undefined) !==
      (input.browserExportProfile === undefined)
  ) {
    throw new Error("Browser export bundle path and profile must be provided together");
  }
  const fileSealedSources = await Promise.all(
    input.profile.source.captures.map(async (capture) => {
      const sourcePath = path.resolve(
        sourceRoot,
        ...capture.sourceFileSegments,
      );
      const bytes = await readFile(sourcePath);
      return Object.freeze({
        capture,
        sourcePath,
        bytes,
        checksumValue: checksum(
          input.profile.source.checksumAlgorithm,
          bytes,
        ),
      });
    }),
  );
  let browserSource: LoadNodeBrowserSourceExportResult | null = null;
  let browserSealedSource: {
    readonly capture: {
      readonly sourceLocator: string;
      readonly rawEntrySegments: readonly string[];
    };
    readonly sourcePath: string;
    readonly bytes: Uint8Array;
    readonly checksumValue: string;
  } | null = null;
  if (
    input.browserExportBundlePath !== undefined &&
    input.browserExportProfile !== undefined
  ) {
    if (!path.isAbsolute(input.browserExportBundlePath)) {
      throw new Error("Browser export bundle path must be absolute");
    }
    const bundlePath = path.resolve(input.browserExportBundlePath);
    if (contains(targetRoot, bundlePath) || contains(bundlePath, targetRoot)) {
      throw new Error("Browser export bundle and rehearsal target must not overlap");
    }
    browserSource = await loadNodeBrowserSourceExport({
      bundlePath,
      profile: input.browserExportProfile,
    });
    const bytes = await readFile(bundlePath);
    if (
      bytes.byteLength !== browserSource.receipt.bundleByteLength ||
      checksum(input.browserExportProfile.checksumAlgorithm, bytes) !==
        browserSource.receipt.bundleChecksumValue
    ) {
      throw new Error("Browser export bundle changed while it was loaded");
    }
    browserSealedSource = Object.freeze({
      capture: input.browserExportProfile.bundleArchive,
      sourcePath: bundlePath,
      bytes,
      checksumValue: checksum(
        input.profile.source.checksumAlgorithm,
        bytes,
      ),
    });
  }
  const sealedSources = Object.freeze([
    ...fileSealedSources,
    ...(browserSealedSource === null ? [] : [browserSealedSource]),
  ]);
  const archiveCaptures = Object.freeze(sealedSources.map((source) =>
    Object.freeze({
      sourceLocator: source.capture.sourceLocator,
      rawEntrySegments: source.capture.rawEntrySegments,
    })
  ));
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
    let snapshots: readonly SourceSnapshotReceipt[];
    if (targetExisted) {
      ({ manifest, snapshots } = await readExistingArchive({
        archiveRoot,
        profile: input.profile,
        expectedCaptures: archiveCaptures,
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
        captures: sealedSources.map((source) => ({
          sourcePath: source.sourcePath,
          sourceLocator: source.capture.sourceLocator,
          archiveEntrySegments: source.capture.rawEntrySegments,
        })),
        connectorProbes: input.profile.source.connectorProbes.map((probe) => ({
          sourcePath: path.resolve(sourceRoot, ...probe.sourceFileSegments),
          connectorKind: probe.connectorKind,
          credentialKind: probe.credentialKind,
        })),
        manifestEntrySegments: input.profile.source.manifestEntrySegments,
        temporaryArchiveRootPath: path.join(
          targetRoot,
          `.${input.profile.source.archiveDirectoryName}.${randomUUID()}.tmp`,
        ),
        finalArchiveRootPath: archiveRoot,
      });
      manifest = exported.manifest;
      snapshots = manifest.snapshots;
    }

    const snapshotByLocator = new Map(
      snapshots.map((snapshot) => [snapshot.sourceLocator, snapshot]),
    );
    const archivedBytesByLocator = new Map<string, Uint8Array>();
    for (const source of sealedSources) {
      const snapshot = snapshotByLocator.get(source.capture.sourceLocator);
      if (
        snapshot === undefined ||
        snapshot.checksumValue !== source.checksumValue ||
        snapshot.byteLength !== source.bytes.byteLength
      ) {
        throw new Error("Current legacy source differs from the sealed snapshot");
      }
      const archivedBytes = await readFile(
        archiveEntryPath(archiveRoot, source.capture.rawEntrySegments),
      );
      if (
        archivedBytes.byteLength !== snapshot.byteLength ||
        checksum(input.profile.source.checksumAlgorithm, archivedBytes) !==
          snapshot.checksumValue
      ) {
        throw new Error("Sealed legacy source bytes do not match their receipt");
      }
      archivedBytesByLocator.set(source.capture.sourceLocator, archivedBytes);
    }
    const sourcePlans = input.profile.source.captures.map((capture) => {
      const snapshot = snapshotByLocator.get(capture.sourceLocator);
      const archivedBytes = archivedBytesByLocator.get(capture.sourceLocator);
      if (snapshot === undefined || archivedBytes === undefined) {
        throw new Error("Configured source was not captured");
      }
      const parsed = parseRawJsonInventory(
        archivedBytes,
        rawInventoryProfile(
          input.profile.rehearsal.secretLikeFieldFragments,
        ),
      );
      return Object.freeze({
        capture,
        snapshot,
        rawJsonInventory: parsed.report,
        plan: createPlanForSource({
          profile: input.profile,
          snapshot,
          capturedAt: manifest.capturedAt,
          payload: parsed.value,
        }),
      });
    });
    const mappingSource = sourcePlans.find(
      (source) =>
        source.capture.sourceLocator ===
        input.profile.source.mappingSourceLocator,
    );
    if (mappingSource === undefined) {
      throw new Error("Configured mapping source was not captured");
    }
    const snapshot = mappingSource.snapshot;
    const plan = mappingSource.plan;
    const browserSourceInventories = browserSource === null
      ? []
      : browserSource.branches.map((branch) => {
        const branchItems = browserSource.capture.items
          .filter((item) => item.sourceLocator === branch.sourceLocator)
          .map((item) => Object.freeze({
            sourceCollection: item.sourceCollection,
            sourceIdentity: item.sourceIdentity,
            sourceOccurrence: item.sourceOccurrence,
            ownershipRef: item.ownershipRef,
            disposition: item.disposition,
            redactedFieldCount: item.redactedFieldCount,
            value: item.value,
          }));
        const inventory = parseRawJsonInventory(
          canonicalBytes(branchItems),
          rawInventoryProfile(
            input.profile.rehearsal.secretLikeFieldFragments,
          ),
        );
        return Object.freeze({
          snapshotId: branch.snapshotId,
          sourceLocator: branch.sourceLocator,
          branchKind: branch.branchKind,
          rawJsonInventory: inventory.report,
        });
      });
    const sourceBranches = Object.freeze([
      ...sourcePlans.map((source) => Object.freeze({
        snapshotId: source.snapshot.snapshotId,
        sourceLocator: source.capture.sourceLocator,
        branchKind: source.capture.branchKind,
        items: Object.freeze(source.plan.rawItems.map((item) =>
          Object.freeze({
            sourceCollection: item.sourceCollection,
            sourceIdentity: item.sourceIdentity,
            sourceOccurrence: item.sourceOccurrence,
            ownershipRef: item.ownershipRef,
            checksumIdentity: item.checksumIdentity,
            checksumValue: item.checksumValue,
          })
        )),
      })),
      ...(browserSource?.branches ?? []),
    ]);
    const sourceInspection: MigrationSourceInspection = Object.freeze({
      sourceInventories: Object.freeze([
        ...sourcePlans.map((source) => Object.freeze({
          snapshotId: source.snapshot.snapshotId,
          sourceLocator: source.capture.sourceLocator,
          branchKind: source.capture.branchKind,
          rawJsonInventory: source.rawJsonInventory,
        })),
        ...browserSourceInventories,
      ]),
      branchInventory: inventoryMigrationSourceBranches(sourceBranches),
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
      sourceInspection,
      ...(browserSource === null
        ? {}
        : { browserSourceReceipt: browserSource.receipt }),
    });
    for (const source of sealedSources) {
      const sourceAfter = await readFile(source.sourcePath);
      if (
        sourceAfter.byteLength !== source.bytes.byteLength ||
        checksum(input.profile.source.checksumAlgorithm, sourceAfter) !==
          source.checksumValue
      ) {
        throw new Error("Legacy source changed during the import rehearsal");
      }
    }
    return Object.freeze({
      schemaVersion: 1,
      sourceRootPath: sourceRoot,
      sourceSnapshotId: snapshot.snapshotId,
      sourceChecksumIdentity: snapshot.checksumIdentity,
      sourceChecksumValue: snapshot.checksumValue,
      sourceByteLength: snapshot.byteLength,
      sourceSnapshots: Object.freeze(snapshots.map((sourceSnapshot) =>
        Object.freeze({
          sourceSnapshotId: sourceSnapshot.snapshotId,
          sourceLocator: sourceSnapshot.sourceLocator,
          checksumIdentity: sourceSnapshot.checksumIdentity,
          checksumValue: sourceSnapshot.checksumValue,
          byteLength: sourceSnapshot.byteLength,
        })
      )),
      connectorMetadata: Object.freeze(manifest.connectorMetadata.map(
        (metadata) => Object.freeze({ ...metadata }),
      )),
      browserSourceReceipt: browserSource?.receipt ?? null,
      sourceInspection,
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
