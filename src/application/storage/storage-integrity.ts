import {
  BlobContentMismatchError,
  BlobNotFoundError,
} from "./blob-store";
import type {
  BlobAddress,
  ImmutableBlobStore,
} from "./blob-store";

export type StorageIntegrityIdentity = {
  readonly checksumIdentity: string;
  readonly targetSchemaVersion:
    number;
};

export type StorageIntegrityBlobManifest = {
  readonly blobRef: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
};

export type StorageIntegrityRevisionReference = {
  readonly revisionId: string;
  readonly blobRef: string;
};

export type StorageIntegrityDatabaseSnapshot = {
  readonly integrityFailureCount:
    number;
  readonly foreignKeyViolationCount:
    number;
  readonly storageIdentities:
    readonly StorageIntegrityIdentity[];
  readonly userSchemaVersion: number;
  readonly blobManifests:
    readonly StorageIntegrityBlobManifest[];
  readonly revisionCount: number;
  readonly revisionReferences:
    readonly StorageIntegrityRevisionReference[];
};

export interface StorageIntegrityDatabaseSnapshotPort {
  captureConsistentSnapshot(
  ): Promise<
    StorageIntegrityDatabaseSnapshot
  >;
}

export type StorageIntegrityFindingKind =
  | "database-integrity"
  | "foreign-key-violation"
  | "storage-identity-mismatch"
  | "schema-version-mismatch"
  | "missing-manifest"
  | "missing-blob"
  | "corrupt-blob"
  | "manifest-mismatch"
  | "orphan-manifest"
  | "orphan-published-blob"
  | "orphan-corrupt-published-blob"
  | "temporary-remnant";

export type StorageIntegrityFinding = {
  readonly kind:
    StorageIntegrityFindingKind;
  readonly count?: number;
  readonly blobRef?: string;
  readonly checksumIdentity?:
    string;
  readonly checksumValue?: string;
  readonly byteLength?: number;
  readonly temporaryEntryIdentity?:
    string;
};

export type StorageIntegrityCounts = {
  readonly databaseIntegrityFailureCount:
    number;
  readonly foreignKeyViolationCount:
    number;
  readonly storageIdentityCount:
    number;
  readonly blobManifestCount: number;
  readonly revisionCount: number;
  readonly revisionReferenceCount:
    number;
  readonly publishedBlobCount:
    number;
  readonly temporaryRemnantCount:
    number;
};

export type StorageIntegrityReportBody = {
  readonly reportIdentity: string;
  readonly storageIdentities:
    readonly StorageIntegrityIdentity[];
  readonly userSchemaVersion: number;
  readonly counts:
    StorageIntegrityCounts;
  readonly findings:
    readonly StorageIntegrityFinding[];
  readonly valid: boolean;
};

export type StorageIntegrityReport =
  StorageIntegrityReportBody & {
    readonly fingerprint: string;
  };

export type InspectStorageIntegrityInput = {
  readonly databaseSnapshot:
    StorageIntegrityDatabaseSnapshotPort;
  readonly blobStore:
    ImmutableBlobStore;
  readonly reportIdentity: string;
  readonly fingerprint: (
    canonicalReport:
      string,
  ) => string;
};

function compareStrings(
  left: string,
  right: string,
): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function addressKey(
  address: BlobAddress,
): string {
  return JSON.stringify([
    address.checksumIdentity,
    address.checksumValue,
  ]);
}

function findingKey(
  finding:
    StorageIntegrityFinding,
): string {
  return JSON.stringify([
    finding.kind,
    finding.blobRef ?? null,
    finding.checksumIdentity ??
      null,
    finding.checksumValue ??
      null,
    finding
      .temporaryEntryIdentity ??
      null,
    finding.byteLength ?? null,
    finding.count ?? null,
  ]);
}

function freezeFinding(
  finding:
    StorageIntegrityFinding,
): StorageIntegrityFinding {
  return Object.freeze(finding);
}

function manifestFinding(
  kind:
    StorageIntegrityFindingKind,
  manifest:
    StorageIntegrityBlobManifest,
): StorageIntegrityFinding {
  return freezeFinding({
    kind,
    blobRef: manifest.blobRef,
    checksumIdentity:
      manifest.checksumIdentity,
    checksumValue:
      manifest.checksumValue,
    byteLength:
      manifest.byteLength,
  });
}

function sameAddress(
  left: BlobAddress,
  right: BlobAddress,
): boolean {
  return (
    left.checksumIdentity ===
      right.checksumIdentity &&
    left.checksumValue ===
      right.checksumValue
  );
}

export async function inspectStorageIntegrity(
  input:
    InspectStorageIntegrityInput,
): Promise<
  StorageIntegrityReport
> {
  const snapshot =
    await input.databaseSnapshot
      .captureConsistentSnapshot();
  const identities =
    Object.freeze(
      snapshot.storageIdentities
        .map((identity) =>
          Object.freeze({
            checksumIdentity:
              identity
                .checksumIdentity,
            targetSchemaVersion:
              identity
                .targetSchemaVersion,
          }),
        )
        .sort((left, right) =>
          compareStrings(
            JSON.stringify(left),
            JSON.stringify(right),
          ),
        ),
    );
  const findings:
    StorageIntegrityFinding[] = [];

  if (
    snapshot.integrityFailureCount >
    0
  ) {
    findings.push(
      freezeFinding({
        kind:
          "database-integrity",
        count:
          snapshot
            .integrityFailureCount,
      }),
    );
  }
  if (
    snapshot
      .foreignKeyViolationCount >
    0
  ) {
    findings.push(
      freezeFinding({
        kind:
          "foreign-key-violation",
        count:
          snapshot
            .foreignKeyViolationCount,
      }),
    );
  }
  if (identities.length !== 1) {
    findings.push(
      freezeFinding({
        kind:
          "storage-identity-mismatch",
        count: identities.length,
      }),
    );
  } else {
    const identity =
      identities[0];
    if (
      identity !== undefined &&
      identity
        .targetSchemaVersion !==
        snapshot
          .userSchemaVersion
    ) {
      findings.push(
        freezeFinding({
          kind:
            "schema-version-mismatch",
          count: 1,
        }),
      );
    }
  }

  const manifestsByReference =
    new Map<
      string,
      StorageIntegrityBlobManifest[]
    >();
  for (
    const manifest
    of snapshot.blobManifests
  ) {
    const matches =
      manifestsByReference.get(
        manifest.blobRef,
      ) ?? [];
    matches.push(manifest);
    manifestsByReference.set(
      manifest.blobRef,
      matches,
    );
  }
  const referencedBlobRefs =
    Object.freeze(
      [
        ...new Set(
          snapshot
            .revisionReferences
            .map(
              (reference) =>
                reference.blobRef,
            ),
        ),
      ].sort(compareStrings),
    );
  const reachableAddresses =
    new Set<string>();
  const referencedManifestIds =
    new Set(
      referencedBlobRefs,
    );

  for (
    const manifest
    of snapshot.blobManifests
  ) {
    if (
      !referencedManifestIds.has(
        manifest.blobRef,
      )
    ) {
      findings.push(
        manifestFinding(
          "orphan-manifest",
          manifest,
        ),
      );
    }
  }

  for (
    const blobRef
    of referencedBlobRefs
  ) {
    const manifests =
      manifestsByReference.get(
        blobRef,
      ) ?? [];
    if (manifests.length === 0) {
      findings.push(
        freezeFinding({
          kind:
            "missing-manifest",
          blobRef,
        }),
      );
      continue;
    }
    if (manifests.length !== 1) {
      findings.push(
        freezeFinding({
          kind:
            "manifest-mismatch",
          blobRef,
          count: manifests.length,
        }),
      );
      continue;
    }
    const manifest =
      manifests[0];
    if (manifest === undefined) {
      continue;
    }
    const address =
      Object.freeze({
        checksumIdentity:
          manifest
            .checksumIdentity,
        checksumValue:
          manifest.checksumValue,
      });
    reachableAddresses.add(
      addressKey(address),
    );

    const storageIdentity =
      identities[0];
    if (
      identities.length === 1 &&
      storageIdentity !==
        undefined &&
      manifest.checksumIdentity !==
        storageIdentity
          .checksumIdentity
    ) {
      findings.push(
        manifestFinding(
          "manifest-mismatch",
          manifest,
        ),
      );
      continue;
    }

    try {
      const read =
        await input.blobStore
          .readExact(address);
      if (
        !sameAddress(
          read.address,
          address,
        ) ||
        read.byteLength !==
          manifest.byteLength ||
        read.bytes.byteLength !==
          manifest.byteLength
      ) {
        findings.push(
          manifestFinding(
            "manifest-mismatch",
            manifest,
          ),
        );
      }
    } catch (error) {
      if (
        error instanceof
          BlobNotFoundError
      ) {
        findings.push(
          manifestFinding(
            "missing-blob",
            manifest,
          ),
        );
        continue;
      }
      if (
        error instanceof
          BlobContentMismatchError
      ) {
        findings.push(
          manifestFinding(
            "corrupt-blob",
            manifest,
          ),
        );
        continue;
      }
      throw error;
    }
  }

  const inventory =
    await input.blobStore
      .inventory({
        isReachable:
          async (address) =>
            reachableAddresses.has(
              addressKey(address),
            ),
      });
  for (
    const published
    of inventory.published
  ) {
    if (
      reachableAddresses.has(
        addressKey(
          published.address,
        ),
      )
    ) {
      continue;
    }
    findings.push(
      freezeFinding({
        kind:
          published.status ===
          "verified"
            ? "orphan-published-blob"
            : "orphan-corrupt-published-blob",
        checksumIdentity:
          published.address
            .checksumIdentity,
        checksumValue:
          published.address
            .checksumValue,
        byteLength:
          published.byteLength,
      }),
    );
  }
  for (
    const temporary
    of inventory.temporary
  ) {
    findings.push(
      freezeFinding({
        kind:
          "temporary-remnant",
        checksumIdentity:
          inventory
            .checksumIdentity,
        checksumValue:
          temporary
            .actualChecksumValue,
        byteLength:
          temporary.byteLength,
        temporaryEntryIdentity:
          temporary
            .temporaryEntryIdentity,
      }),
    );
  }

  const sortedFindings =
    Object.freeze(
      findings.sort(
        (left, right) =>
          compareStrings(
            findingKey(left),
            findingKey(right),
          ),
      ),
    );
  const counts:
    StorageIntegrityCounts =
    Object.freeze({
      databaseIntegrityFailureCount:
        snapshot
          .integrityFailureCount,
      foreignKeyViolationCount:
        snapshot
          .foreignKeyViolationCount,
      storageIdentityCount:
        identities.length,
      blobManifestCount:
        snapshot.blobManifests
          .length,
      revisionCount:
        snapshot.revisionCount,
      revisionReferenceCount:
        snapshot
          .revisionReferences
          .length,
      publishedBlobCount:
        inventory.published.length,
      temporaryRemnantCount:
        inventory.temporary.length,
    });
  const body:
    StorageIntegrityReportBody =
    Object.freeze({
      reportIdentity:
        input.reportIdentity,
      storageIdentities:
        identities,
      userSchemaVersion:
        snapshot.userSchemaVersion,
      counts,
      findings:
        sortedFindings,
      valid:
        sortedFindings.length ===
        0,
    });
  const canonicalReport =
    JSON.stringify(body);

  return Object.freeze({
    ...body,
    fingerprint:
      input.fingerprint(
        canonicalReport,
      ),
  });
}
