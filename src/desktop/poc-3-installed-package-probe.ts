import {
  createHash,
} from "node:crypto";
import {
  isAbsolute,
} from "node:path";

import {
  CaptureResumeCheckpointWithAnchors,
} from "../application/checkpoints/capture-resume-checkpoint-with-anchors";
import type {
  AppendRevisionInput,
  RevisionBlobProfile,
} from "../application/revisions/revision-store";
import type {
  BlobAddress,
  BlobMetadata,
} from "../application/storage/blob-store";
import type {
  Anchor,
  Document,
  EntityId,
  ResumeCheckpoint,
  Work,
} from "../domain/writing";
import {
  createWritingCatalog,
} from "../domain/writing";
import type {
  Poc3LedgerRecord,
} from "../domain/poc-3-storage-ledger";
import {
  createNodeImmutableBlobStore,
} from "../platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
  type NodeImmutableBlobStoreProfile,
} from "../platform/storage/node-immutable-blob-store-profile";
import {
  inspectNodeSqliteStorageIntegrity,
} from "../platform/storage/node-sqlite-integrity";
import {
  openNodeSqliteLedger,
} from "../platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
  type Poc3StorageOpenProfile,
} from "../platform/storage/node-sqlite-ledger-profile";
import type {
  NodeSqliteBackupCanonicalBytesAdapter,
  NodeSqliteBackupChecksumAdapter,
  NodeSqliteBackupCounts,
  NodeSqliteBackupFormat,
  NodeSqliteBackupLogicalChecksums,
  NodeSqliteBackupManifest,
  NodeSqliteBackupManifestCodec,
  NodeSqliteBackupSqliteOptions,
} from "../platform/storage/node-sqlite-backup";
import {
  createNodeSqliteBackupBundle,
  restoreNodeSqliteBackupBundle,
} from "../platform/storage/node-sqlite-backup";

type ProbeChecksumProfile = {
  readonly identity: string;
  readonly algorithm: string;
};

type ProbeRevisionBlobEntry = {
  readonly revisionId: string;
  readonly content: string;
  readonly encodedBytesBase64:
    string;
  readonly descriptor: {
    readonly contentHash: string;
    readonly length: number;
  };
  readonly address: BlobAddress;
  readonly blobRef: string;
  readonly appendMetadata:
    BlobMetadata;
  readonly temporaryEntryIdentity:
    string;
  readonly manifestMetadata: {
    readonly createdAt: string;
    readonly mediaType: string;
    readonly originalName: string;
  };
};

type ProbeBlobLayoutEntry = {
  readonly address: BlobAddress;
  readonly relativeSegments:
    readonly string[];
};

export type Poc3InstalledPackageProbeProfile = {
  readonly schemaVersion: 1;
  readonly runIdentity: string;
  readonly checksum:
    ProbeChecksumProfile;
  readonly storage: {
    readonly source:
      Poc3StorageOpenProfile;
    readonly target:
      Poc3StorageOpenProfile;
  };
  readonly blobStores: {
    readonly source:
      NodeImmutableBlobStoreProfile;
    readonly target:
      NodeImmutableBlobStoreProfile;
  };
  readonly revisionBlob: {
    readonly codecIdentity: string;
    readonly entries:
      readonly ProbeRevisionBlobEntry[];
  };
  readonly seed: {
    readonly initialRevisionInput:
      AppendRevisionInput;
    readonly records:
      readonly Poc3LedgerRecord[];
  };
  readonly appendRevisionInput:
    AppendRevisionInput;
  readonly catalog: {
    readonly works:
      readonly Work[];
    readonly documents:
      readonly Document[];
  };
  readonly checkpoint: {
    readonly checkpoint:
      ResumeCheckpoint;
    readonly cursorAnchor: Anchor;
    readonly expectedWorkRevision:
      number;
    readonly expectedResumeCheckpointId:
      EntityId<"ResumeCheckpoint">
      | null;
    readonly expectedDocumentRevisionId:
      EntityId<"DocumentRevision">;
  };
  readonly backup: {
    readonly temporaryBundleRoot:
      string;
    readonly finalBundleRoot:
      string;
    readonly databaseEntrySegments:
      readonly string[];
    readonly manifestEntrySegments:
      readonly string[];
    readonly manifestChecksumEntrySegments:
      readonly string[];
    readonly blobEntries:
      readonly ProbeBlobLayoutEntry[];
    readonly format:
      NodeSqliteBackupFormat;
    readonly sqlite:
      NodeSqliteBackupSqliteOptions;
    readonly checksum:
      ProbeChecksumProfile;
    readonly createdAt: string;
  };
  readonly restore: {
    readonly finalBundleRoot:
      string;
    readonly targetStagingRoot:
      string;
    readonly targetFinalRoot:
      string;
    readonly databaseEntrySegments:
      readonly string[];
    readonly blobEntries:
      readonly ProbeBlobLayoutEntry[];
    readonly expectedFormat:
      NodeSqliteBackupFormat;
    readonly preflight: {
      readonly identity: string;
      readonly authorized:
        boolean;
      readonly availableByteCount:
        number;
    };
  };
  readonly integrity: {
    readonly reportIdentity:
      string;
    readonly fingerprintAlgorithm:
      string;
  };
};

export type Poc3InstalledPackageProbeReceipt = {
  readonly schemaVersion: 1;
  readonly runIdentity: string;
  readonly runtime: {
    readonly mainProcessId: number;
    readonly processType: string;
    readonly platform: string;
    readonly electronVersion:
      string;
    readonly nodeVersion: string;
  };
  readonly identities: {
    readonly checksumIdentity:
      string;
    readonly checksumAlgorithm:
      string;
    readonly revisionBlobCodecIdentity:
      string;
    readonly workId: string;
    readonly documentId: string;
    readonly currentRevisionId:
      string;
    readonly checkpointId: string;
    readonly backupChecksumIdentity:
      string;
    readonly backupFormatIdentity:
      string;
    readonly backupFormatVersion:
      string;
  };
  readonly source: {
    readonly counts:
      NodeSqliteBackupCounts;
    readonly logicalChecksums:
      NodeSqliteBackupLogicalChecksums;
    readonly materializedContentChecksum:
      string;
    readonly checkpointPointerMatches:
      true;
  };
  readonly backup: {
    readonly publication:
      "published";
    readonly manifestChecksum:
      string;
    readonly blobCount: number;
  };
  readonly restore: {
    readonly publication:
      "published";
    readonly preflight: {
      readonly identity: string;
      readonly requiredByteCount:
        number;
      readonly authorized: true;
      readonly capacitySufficient:
        true;
    };
  };
  readonly target: {
    readonly counts:
      NodeSqliteBackupCounts;
    readonly logicalChecksums:
      NodeSqliteBackupLogicalChecksums;
    readonly integrityValid: true;
    readonly integrityFingerprint:
      string;
    readonly integrityCounts:
      Readonly<
        Record<string, number>
      >;
    readonly materializedContentChecksum:
      string;
    readonly currentRevisionMatches:
      true;
    readonly checkpointPointerMatches:
      true;
  };
};

type ScalarShape =
  | "string"
  | "nonEmptyString"
  | "safeInteger"
  | "nonNegativeSafeInteger"
  | "positiveSafeInteger"
  | "boolean"
  | "null";

type Shape =
  | ScalarShape
  | {
    readonly literal: unknown;
  }
  | {
    readonly array: Shape;
  }
  | {
    readonly object:
      Readonly<
        Record<string, Shape>
      >;
  }
  | {
    readonly dictionary:
      "metadata";
  };

const nonEmptyString =
  "nonEmptyString" as const;
const safeInteger =
  "safeInteger" as const;
const positiveSafeInteger =
  "positiveSafeInteger" as const;
const booleanShape =
  "boolean" as const;
const nullShape = "null" as const;
const stringShape =
  "string" as const;
const stringArray = Object.freeze({
  array: nonEmptyString,
});
const addressShape = Object.freeze({
  object: Object.freeze({
    checksumIdentity:
      nonEmptyString,
    checksumValue:
      nonEmptyString,
  }),
});
const metaShape = Object.freeze({
  object: Object.freeze({
    id: nonEmptyString,
    schemaVersion:
      positiveSafeInteger,
    revision: safeInteger,
    createdAt: nonEmptyString,
    updatedAt: nonEmptyString,
  }),
});
const appendRevisionShape =
  Object.freeze({
    object: Object.freeze({
      revisionId:
        nonEmptyString,
      workId: nonEmptyString,
      documentId:
        nonEmptyString,
      expectedCurrentRevisionId:
        nonEmptyString,
      content: stringShape,
      cause: nonEmptyString,
      createdAt:
        nonEmptyString,
      durableAt:
        nonEmptyString,
    }),
  });

function readRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} must be an object`,
    );
  }
  return value as Record<
    string,
    unknown
  >;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected =
    new Set<string>(fields);
  for (
    const field
    of Object.keys(input)
  ) {
    if (!expected.has(field)) {
      throw new Error(
        `Unsupported ${label} field: ${field}`,
      );
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(
        `${label} is missing ${field}`,
      );
    }
  }
}

function validateScalar(
  value: unknown,
  shape: ScalarShape,
  label: string,
): void {
  if (shape === "null") {
    if (value !== null) {
      throw new Error(
        `${label} must be null`,
      );
    }
    return;
  }
  if (
    shape === "string" ||
    shape === "nonEmptyString"
  ) {
    if (
      typeof value !== "string" ||
      (
        shape ===
          "nonEmptyString" &&
        value.length === 0
      )
    ) {
      throw new Error(
        `${label} must be a${
          shape ===
          "nonEmptyString"
            ? " non-empty"
            : ""
        } string`,
      );
    }
    return;
  }
  if (shape === "boolean") {
    if (
      typeof value !== "boolean"
    ) {
      throw new Error(
        `${label} must be a boolean`,
      );
    }
    return;
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    (
      shape ===
        "nonNegativeSafeInteger" &&
      value < 0
    ) ||
    (
      shape ===
        "positiveSafeInteger" &&
      value <= 0
    )
  ) {
    throw new Error(
      `${label} must be a ${shape}`,
    );
  }
}

function validateShape(
  value: unknown,
  shape: Shape,
  label: string,
): void {
  if (typeof shape === "string") {
    validateScalar(
      value,
      shape,
      label,
    );
    return;
  }
  if ("literal" in shape) {
    if (value !== shape.literal) {
      throw new Error(
        `${label} has an unsupported value`,
      );
    }
    return;
  }
  if ("array" in shape) {
    if (!Array.isArray(value)) {
      throw new Error(
        `${label} must be an array`,
      );
    }
    value.forEach((entry, index) =>
      validateShape(
        entry,
        shape.array,
        `${label}[${index}]`,
      ),
    );
    return;
  }
  const input = readRecord(
    value,
    label,
  );
  if ("dictionary" in shape) {
    for (
      const [field, entry]
      of Object.entries(input)
    ) {
      if (
        field.length === 0 ||
        !(
          entry === null ||
          typeof entry ===
            "string" ||
          typeof entry ===
            "boolean" ||
          (
            typeof entry ===
              "number" &&
            Number.isSafeInteger(
              entry,
            )
          )
        )
      ) {
        throw new Error(
          `${label} has an invalid metadata value`,
        );
      }
    }
    return;
  }
  const fields =
    Object.keys(shape.object);
  assertExactFields(
    input,
    fields,
    label,
  );
  for (
    const [field, fieldShape]
    of Object.entries(
      shape.object,
    )
  ) {
    validateShape(
      input[field],
      fieldShape,
      `${label}.${field}`,
    );
  }
}

function validateAbsolutePath(
  value: unknown,
  label: string,
): void {
  validateShape(
    value,
    nonEmptyString,
    label,
  );
  if (
    !isAbsolute(value as string)
  ) {
    throw new Error(
      `${label} must be absolute`,
    );
  }
}

function validateLedgerRecord(
  value: unknown,
  index: number,
): void {
  const label =
    `POC-3 installed-package probe profile.seed.records[${index}]`;
  const input = readRecord(
    value,
    label,
  );
  const kind = input.kind;
  if (
    typeof kind !== "string"
  ) {
    throw new Error(
      `${label}.kind must be a non-empty string`,
    );
  }
  const shapes: Readonly<
    Record<
      string,
      Readonly<Record<string, Shape>>
    >
  > = {
    studio: {
      kind: {
        literal: "studio",
      },
      id: nonEmptyString,
      displayName:
        nonEmptyString,
      locale: nonEmptyString,
      timezone:
        nonEmptyString,
      settingsRevision:
        safeInteger,
      createdAt:
        nonEmptyString,
    },
    work: {
      kind: {
        literal: "work",
      },
      id: nonEmptyString,
      schemaVersion:
        positiveSafeInteger,
      revision: safeInteger,
      createdAt:
        nonEmptyString,
      updatedAt:
        nonEmptyString,
      studioId:
        nonEmptyString,
      title: nonEmptyString,
      orderKey:
        nonEmptyString,
      settingsId:
        nonEmptyString,
    },
    activityPolicy: {
      kind: {
        literal:
          "activityPolicy",
      },
      id: nonEmptyString,
      schemaVersion:
        positiveSafeInteger,
      revision: safeInteger,
      createdAt:
        nonEmptyString,
      updatedAt:
        nonEmptyString,
      workId: nonEmptyString,
      idleTimeout:
        safeInteger,
      navigationGrace:
        safeInteger,
      hiddenWindowPolicy:
        nonEmptyString,
      activityClassRulesJson:
        nonEmptyString,
      autoStartEnabled:
        booleanShape,
      autoResumeFromIdle:
        booleanShape,
      recoveryPolicy:
        nonEmptyString,
    },
    focusPolicy: {
      kind: {
        literal:
          "focusPolicy",
      },
      id: nonEmptyString,
      schemaVersion:
        positiveSafeInteger,
      revision: safeInteger,
      createdAt:
        nonEmptyString,
      updatedAt:
        nonEmptyString,
      workId: nonEmptyString,
      phaseDefinitionsJson:
        nonEmptyString,
      backgroundPolicy:
        nonEmptyString,
      musicStartPolicy:
        nonEmptyString,
      completionPolicy:
        nonEmptyString,
      visibility:
        nonEmptyString,
    },
    workSettings: {
      kind: {
        literal:
          "workSettings",
      },
      id: nonEmptyString,
      workId: nonEmptyString,
      sceneRuleSetId:
        nonEmptyString,
      activityPolicyId:
        nonEmptyString,
      focusPolicyId:
        nonEmptyString,
      railPreferencesJson:
        nonEmptyString,
      revision: safeInteger,
    },
    blobManifest: {
      kind: {
        literal:
          "blobManifest",
      },
      blobRef:
        nonEmptyString,
      checksumIdentity:
        nonEmptyString,
      checksumValue:
        nonEmptyString,
      byteLength:
        positiveSafeInteger,
      createdAt:
        nonEmptyString,
      mediaType:
        nonEmptyString,
      originalName:
        nonEmptyString,
    },
    document: {
      kind: {
        literal: "document",
      },
      id: nonEmptyString,
      schemaVersion:
        positiveSafeInteger,
      revision: safeInteger,
      createdAt:
        nonEmptyString,
      updatedAt:
        nonEmptyString,
      workId: nonEmptyString,
      title: nonEmptyString,
      orderKey:
        nonEmptyString,
      manuscriptId:
        nonEmptyString,
    },
    documentRevision: {
      kind: {
        literal:
          "documentRevision",
      },
      id: nonEmptyString,
      workId: nonEmptyString,
      documentId:
        nonEmptyString,
      contentRef:
        nonEmptyString,
      contentHash:
        nonEmptyString,
      length:
        "nonNegativeSafeInteger",
      cause: nonEmptyString,
      createdAt:
        nonEmptyString,
      durableAt:
        nonEmptyString,
    },
    manuscript: {
      kind: {
        literal:
          "manuscript",
      },
      id: nonEmptyString,
      workId: nonEmptyString,
      documentId:
        nonEmptyString,
      currentRevisionId:
        nonEmptyString,
      durableRevisionId:
        nonEmptyString,
      updatedAt:
        nonEmptyString,
    },
  };
  const selected = shapes[kind];
  if (selected === undefined) {
    throw new Error(
      `${label}.kind has an unsupported value`,
    );
  }
  validateShape(
    input,
    {
      object: selected,
    },
    label,
  );
}

function deepFreezeClone(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map(
        deepFreezeClone,
      ),
    );
  }
  if (
    typeof value === "object" &&
    value !== null
  ) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value)
          .map(([key, entry]) => [
            key,
            deepFreezeClone(entry),
          ]),
      ),
    );
  }
  return value;
}

function validateProbeProfile(
  value: unknown,
): Record<string, unknown> {
  const label =
    "POC-3 installed-package probe profile";
  const input = readRecord(
    value,
    label,
  );
  assertExactFields(
    input,
    [
      "schemaVersion",
      "runIdentity",
      "checksum",
      "storage",
      "blobStores",
      "revisionBlob",
      "seed",
      "appendRevisionInput",
      "catalog",
      "checkpoint",
      "backup",
      "restore",
      "integrity",
    ],
    label,
  );
  validateShape(
    input.schemaVersion,
    {
      literal: 1,
    },
    `${label}.schemaVersion`,
  );
  validateShape(
    input.runIdentity,
    nonEmptyString,
    `${label}.runIdentity`,
  );
  validateShape(
    input.checksum,
    {
      object: {
        identity:
          nonEmptyString,
        algorithm:
          nonEmptyString,
      },
    },
    `${label}.checksum`,
  );

  const storage = readRecord(
    input.storage,
    `${label}.storage`,
  );
  assertExactFields(
    storage,
    [
      "source",
      "target",
    ],
    `${label}.storage`,
  );
  const sourceStorage =
    parsePoc3StorageOpenProfile(
      storage.source,
    );
  const targetStorage =
    parsePoc3StorageOpenProfile(
      storage.target,
    );
  validateAbsolutePath(
    sourceStorage.databasePath,
    `${label}.storage.source.databasePath`,
  );
  validateAbsolutePath(
    targetStorage.databasePath,
    `${label}.storage.target.databasePath`,
  );

  const blobStores = readRecord(
    input.blobStores,
    `${label}.blobStores`,
  );
  assertExactFields(
    blobStores,
    [
      "source",
      "target",
    ],
    `${label}.blobStores`,
  );
  const sourceBlob =
    parseNodeImmutableBlobStoreProfile(
      blobStores.source,
    );
  const targetBlob =
    parseNodeImmutableBlobStoreProfile(
      blobStores.target,
    );

  const revisionBlobShape:
    Shape = {
      object: {
        codecIdentity:
          nonEmptyString,
        entries: {
          array: {
            object: {
              revisionId:
                nonEmptyString,
              content:
                stringShape,
              encodedBytesBase64:
                nonEmptyString,
              descriptor: {
                object: {
                  contentHash:
                    nonEmptyString,
                  length:
                    "nonNegativeSafeInteger",
                },
              },
              address:
                addressShape,
              blobRef:
                nonEmptyString,
              appendMetadata: {
                dictionary:
                  "metadata",
              },
              temporaryEntryIdentity:
                nonEmptyString,
              manifestMetadata: {
                object: {
                  createdAt:
                    nonEmptyString,
                  mediaType:
                    nonEmptyString,
                  originalName:
                    nonEmptyString,
                },
              },
            },
          },
        },
      },
    };
  validateShape(
    input.revisionBlob,
    revisionBlobShape,
    `${label}.revisionBlob`,
  );

  const seed = readRecord(
    input.seed,
    `${label}.seed`,
  );
  assertExactFields(
    seed,
    [
      "initialRevisionInput",
      "records",
    ],
    `${label}.seed`,
  );
  validateShape(
    seed.initialRevisionInput,
    {
      object: {
        revisionId:
          nonEmptyString,
        workId: nonEmptyString,
        documentId:
          nonEmptyString,
        expectedCurrentRevisionId:
          nullShape,
        content: stringShape,
        cause: nonEmptyString,
        createdAt:
          nonEmptyString,
        durableAt:
          nonEmptyString,
      },
    },
    `${label}.seed.initialRevisionInput`,
  );
  validateShape(
    input.appendRevisionInput,
    appendRevisionShape,
    `${label}.appendRevisionInput`,
  );
  if (!Array.isArray(seed.records)) {
    throw new Error(
      `${label}.seed.records must be an array`,
    );
  }
  seed.records.forEach(
    validateLedgerRecord,
  );

  validateShape(
    input.catalog,
    {
      object: {
        works: {
          array: {
            object: {
              meta: metaShape,
              studioId:
                nonEmptyString,
              title:
                nonEmptyString,
              orderKey:
                nonEmptyString,
              settingsId:
                nonEmptyString,
            },
          },
        },
        documents: {
          array: {
            object: {
              meta: metaShape,
              workId:
                nonEmptyString,
              title:
                nonEmptyString,
              orderKey:
                nonEmptyString,
              manuscriptId:
                nonEmptyString,
            },
          },
        },
      },
    },
    `${label}.catalog`,
  );

  validateShape(
    input.checkpoint,
    {
      object: {
        checkpoint: {
          object: {
            meta: metaShape,
            workId:
              nonEmptyString,
            documentId:
              nonEmptyString,
            documentRevisionId:
              nonEmptyString,
            cursorAnchorId:
              nonEmptyString,
            workspaceMode:
              nonEmptyString,
            capturedAt:
              nonEmptyString,
          },
        },
        cursorAnchor: {
          object: {
            meta: metaShape,
            documentId:
              nonEmptyString,
            originRevisionId:
              nonEmptyString,
            resolvedRevisionId:
              nonEmptyString,
            startOffset:
              "nonNegativeSafeInteger",
            endOffset:
              "nonNegativeSafeInteger",
            exactQuote:
              stringShape,
            prefixContext:
              stringShape,
            suffixContext:
              stringShape,
            quoteHash:
              nonEmptyString,
            contextHash:
              nonEmptyString,
            status:
              nonEmptyString,
            resolutionEvidence: {
              object: {
                targetRevisionId:
                  nonEmptyString,
                method:
                  nonEmptyString,
                matchedEvidence: {
                  array:
                    nonEmptyString,
                },
                candidateOffsets: {
                  array:
                    "nonNegativeSafeInteger",
                },
                policyVersion:
                  nonEmptyString,
                assessedAt:
                  nonEmptyString,
              },
            },
          },
        },
        expectedWorkRevision:
          safeInteger,
        expectedResumeCheckpointId:
          nullShape,
        expectedDocumentRevisionId:
          nonEmptyString,
      },
    },
    `${label}.checkpoint`,
  );

  validateShape(
    input.backup,
    {
      object: {
        temporaryBundleRoot:
          nonEmptyString,
        finalBundleRoot:
          nonEmptyString,
        databaseEntrySegments:
          stringArray,
        manifestEntrySegments:
          stringArray,
        manifestChecksumEntrySegments:
          stringArray,
        blobEntries: {
          array: {
            object: {
              address:
                addressShape,
              relativeSegments:
                stringArray,
            },
          },
        },
        format: {
          object: {
            identity:
              nonEmptyString,
            version:
              nonEmptyString,
          },
        },
        sqlite: {
          object: {
            sourceDatabaseName:
              nonEmptyString,
            targetDatabaseName:
              nonEmptyString,
            pagesPerStep:
              positiveSafeInteger,
            standaloneSnapshotJournalMode:
              nonEmptyString,
          },
        },
        checksum: {
          object: {
            identity:
              nonEmptyString,
            algorithm:
              nonEmptyString,
          },
        },
        createdAt:
          nonEmptyString,
      },
    },
    `${label}.backup`,
  );
  validateShape(
    input.restore,
    {
      object: {
        finalBundleRoot:
          nonEmptyString,
        targetStagingRoot:
          nonEmptyString,
        targetFinalRoot:
          nonEmptyString,
        databaseEntrySegments:
          stringArray,
        blobEntries: {
          array: {
            object: {
              address:
                addressShape,
              relativeSegments:
                stringArray,
            },
          },
        },
        expectedFormat: {
          object: {
            identity:
              nonEmptyString,
            version:
              nonEmptyString,
          },
        },
        preflight: {
          object: {
            identity:
              nonEmptyString,
            authorized:
              booleanShape,
            availableByteCount:
              positiveSafeInteger,
          },
        },
      },
    },
    `${label}.restore`,
  );
  validateShape(
    input.integrity,
    {
      object: {
        reportIdentity:
          nonEmptyString,
        fingerprintAlgorithm:
          nonEmptyString,
      },
    },
    `${label}.integrity`,
  );

  for (
    const [pathLabel, pathValue]
    of [
      [
        "backup.temporaryBundleRoot",
        readRecord(
          input.backup,
          `${label}.backup`,
        ).temporaryBundleRoot,
      ],
      [
        "backup.finalBundleRoot",
        readRecord(
          input.backup,
          `${label}.backup`,
        ).finalBundleRoot,
      ],
      [
        "restore.finalBundleRoot",
        readRecord(
          input.restore,
          `${label}.restore`,
        ).finalBundleRoot,
      ],
      [
        "restore.targetStagingRoot",
        readRecord(
          input.restore,
          `${label}.restore`,
        ).targetStagingRoot,
      ],
      [
        "restore.targetFinalRoot",
        readRecord(
          input.restore,
          `${label}.restore`,
        ).targetFinalRoot,
      ],
    ] as const
  ) {
    validateAbsolutePath(
      pathValue,
      `${label}.${pathLabel}`,
    );
  }

  const checksum =
    readRecord(
      input.checksum,
      `${label}.checksum`,
    );
  if (
    sourceStorage
      .checksumIdentity !==
      checksum.identity ||
    targetStorage
      .checksumIdentity !==
      checksum.identity ||
    sourceBlob.checksum
      .identity !==
      checksum.identity ||
    targetBlob.checksum
      .identity !==
      checksum.identity ||
    sourceBlob.checksum
      .algorithm !==
      checksum.algorithm ||
    targetBlob.checksum
      .algorithm !==
      checksum.algorithm
  ) {
    throw new Error(
      `${label} checksum profiles must agree`,
    );
  }
  if (
    readRecord(
      input.restore,
      `${label}.restore`,
    ).finalBundleRoot !==
    readRecord(
      input.backup,
      `${label}.backup`,
    ).finalBundleRoot
  ) {
    throw new Error(
      `${label} backup and restore bundle roots must agree`,
    );
  }
  return input;
}

export function parsePoc3InstalledPackageProbeProfile(
  value: unknown,
): Poc3InstalledPackageProbeProfile {
  const validated =
    validateProbeProfile(value);
  return deepFreezeClone(
    validated,
  ) as Poc3InstalledPackageProbeProfile;
}

function assertProbeCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function addressKey(
  address: BlobAddress,
): string {
  return JSON.stringify([
    address.checksumIdentity,
    address.checksumValue,
  ]);
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

function createRevisionBlobRuntime(
  profile:
    Poc3InstalledPackageProbeProfile,
): {
  readonly blobProfile:
    RevisionBlobProfile;
  entryForRevisionId(
    revisionId: string,
  ): ProbeRevisionBlobEntry;
} {
  const byRevisionId =
    new Map<
      string,
      ProbeRevisionBlobEntry
    >();
  const byContent =
    new Map<
      string,
      ProbeRevisionBlobEntry
    >();
  const byEncodedBytes =
    new Map<
      string,
      ProbeRevisionBlobEntry
    >();
  const byAddress =
    new Map<
      string,
      ProbeRevisionBlobEntry
    >();
  const byBlobRef =
    new Map<
      string,
      ProbeRevisionBlobEntry
    >();
  for (
    const entry
    of profile.revisionBlob
      .entries
  ) {
    const decoded =
      Buffer.from(
        entry.encodedBytesBase64,
        "base64",
      );
    assertProbeCondition(
      decoded.toString("base64") ===
        entry
          .encodedBytesBase64,
      `Revision blob entry ${entry.revisionId} has invalid base64`,
    );
    assertProbeCondition(
      entry.descriptor.length ===
        entry.content.length,
      `Revision blob entry ${entry.revisionId} length does not match its content`,
    );
    const mappings:
      readonly [
        Map<
          string,
          ProbeRevisionBlobEntry
        >,
        string,
        string,
      ][] = [
        [
          byRevisionId,
          entry.revisionId,
          "revision ID",
        ],
        [
          byContent,
          entry.content,
          "content",
        ],
        [
          byEncodedBytes,
          entry
            .encodedBytesBase64,
          "encoded bytes",
        ],
        [
          byAddress,
          addressKey(
            entry.address,
          ),
          "address",
        ],
        [
          byBlobRef,
          entry.blobRef,
          "blob reference",
        ],
      ];
    for (
      const [mapping, key, label]
      of mappings
    ) {
      assertProbeCondition(
        !mapping.has(key),
        `Duplicate revision blob ${label}`,
      );
      mapping.set(key, entry);
    }
  }
  assertProbeCondition(
    byRevisionId.size > 0,
    "Revision blob profile entries must not be empty",
  );

  const requireMapped = (
    mapping:
      ReadonlyMap<
        string,
        ProbeRevisionBlobEntry
      >,
    key: string,
    label: string,
  ): ProbeRevisionBlobEntry => {
    const entry =
      mapping.get(key);
    if (entry === undefined) {
      throw new Error(
        `Caller profile has no revision blob entry for ${label}`,
      );
    }
    return entry;
  };
  const entryForAppend = (
    input: AppendRevisionInput,
  ): ProbeRevisionBlobEntry => {
    const entry =
      requireMapped(
        byRevisionId,
        input.revisionId,
        "append revision",
      );
    assertProbeCondition(
      entry.content ===
        input.content,
      `Revision blob content does not match append input ${input.revisionId}`,
    );
    return entry;
  };
  const blobProfile:
    RevisionBlobProfile =
    Object.freeze({
      codec: Object.freeze({
        identity:
          profile.revisionBlob
            .codecIdentity,
        encode: (
          content: string,
        ): Uint8Array =>
          Uint8Array.from(
            Buffer.from(
              requireMapped(
                byContent,
                content,
                "encoded content",
              )
                .encodedBytesBase64,
              "base64",
            ),
          ),
        decode: (
          bytes: Uint8Array,
        ): string =>
          requireMapped(
            byEncodedBytes,
            Buffer.from(
              bytes,
            ).toString(
              "base64",
            ),
            "decoded bytes",
          ).content,
        describe: (
          content: string,
        ) => {
          const descriptor =
            requireMapped(
              byContent,
              content,
              "described content",
            ).descriptor;
          return Object.freeze({
            contentHash:
              descriptor
                .contentHash,
            length:
              descriptor.length,
          });
        },
      }),
      blobRefForAddress: (
        address: BlobAddress,
      ): string =>
        requireMapped(
          byAddress,
          addressKey(address),
          "blob address",
        ).blobRef,
      addressForBlobRef: (
        blobRef: string,
      ): BlobAddress => {
        const address =
          requireMapped(
            byBlobRef,
            blobRef,
            "blob reference",
          ).address;
        return Object.freeze({
          ...address,
        });
      },
      metadataForAppend: (
        input: AppendRevisionInput,
      ): BlobMetadata =>
        entryForAppend(input)
          .appendMetadata,
      temporaryEntryIdentityForAppend:
        (
          input:
            AppendRevisionInput,
        ): string =>
          entryForAppend(input)
            .temporaryEntryIdentity,
      manifestMetadataForAppend:
        (
          input:
            AppendRevisionInput,
        ) =>
          entryForAppend(input)
            .manifestMetadata,
    });
  return Object.freeze({
    blobProfile,
    entryForRevisionId: (
      revisionId: string,
    ): ProbeRevisionBlobEntry =>
      requireMapped(
        byRevisionId,
        revisionId,
        "revision ID",
      ),
  });
}

function canonicalValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      canonicalValue,
    );
  }
  if (
    typeof value === "object" &&
    value !== null
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) =>
          left.localeCompare(
            right,
          ),
        )
        .map(([key, entry]) => [
          key,
          canonicalValue(entry),
        ]),
    );
  }
  return value;
}

function createCanonicalAdapters(
  checksum:
    ProbeChecksumProfile,
): {
  readonly canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter;
  readonly manifestCodec:
    NodeSqliteBackupManifestCodec;
  readonly checksum:
    NodeSqliteBackupChecksumAdapter;
} {
  const encoder =
    new TextEncoder();
  const decoder =
    new TextDecoder();
  const canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter =
    Object.freeze({
      encode: (
        value: unknown,
      ): Uint8Array =>
        encoder.encode(
          JSON.stringify(
            canonicalValue(value),
          ),
        ),
      decode: (
        bytes: Uint8Array,
      ): unknown =>
        JSON.parse(
          decoder.decode(bytes),
        ),
    });
  const manifestCodec:
    NodeSqliteBackupManifestCodec =
    Object.freeze({
      encodeCanonical: (
        manifest:
          NodeSqliteBackupManifest,
      ): Uint8Array =>
        canonicalBytes.encode(
          manifest,
        ),
      decodeCanonical: (
        bytes: Uint8Array,
      ):
        NodeSqliteBackupManifest =>
        canonicalBytes.decode(
          bytes,
        ) as
          NodeSqliteBackupManifest,
    });
  return Object.freeze({
    canonicalBytes,
    manifestCodec,
    checksum: Object.freeze({
      identity:
        checksum.identity,
      checksum: (
        bytes: Uint8Array,
      ): string =>
        createHash(
          checksum.algorithm,
        )
          .update(bytes)
          .digest("hex"),
    }),
  });
}

function createBlobLayoutLookup(
  entries:
    readonly ProbeBlobLayoutEntry[],
  label: string,
): (
  address: BlobAddress,
) => readonly string[] {
  const mapping =
    new Map<
      string,
      readonly string[]
    >();
  for (const entry of entries) {
    const key =
      addressKey(entry.address);
    assertProbeCondition(
      !mapping.has(key),
      `Duplicate ${label} blob layout address`,
    );
    mapping.set(
      key,
      entry.relativeSegments,
    );
  }
  return (
    address: BlobAddress,
  ): readonly string[] => {
    const segments =
      mapping.get(
        addressKey(address),
      );
    if (segments === undefined) {
      throw new Error(
        `Caller profile has no ${label} blob layout entry`,
      );
    }
    return segments;
  };
}

function checksumText(
  algorithm: string,
  text: string,
): string {
  return createHash(algorithm)
    .update(text)
    .digest("hex");
}

function sameCanonical(
  left: unknown,
  right: unknown,
): boolean {
  return (
    JSON.stringify(
      canonicalValue(left),
    ) ===
    JSON.stringify(
      canonicalValue(right),
    )
  );
}

export async function runPoc3InstalledPackageProbe(
  input: unknown,
): Promise<
  Poc3InstalledPackageProbeReceipt
> {
  const profile =
    parsePoc3InstalledPackageProbeProfile(
      input,
    );
  const processType = (
    process as NodeJS.Process & {
      readonly type?: string;
    }
  ).type;
  const electronVersion =
    process.versions.electron;
  assertProbeCondition(
    processType === "browser",
    "POC-3 installed-package probe must run in the Electron browser process",
  );
  assertProbeCondition(
    process.platform === "win32",
    "POC-3 installed-package probe must run on Windows",
  );
  assertProbeCondition(
    typeof electronVersion ===
      "string" &&
      electronVersion.length > 0,
    "Electron version is unavailable",
  );

  const revisionBlobRuntime =
    createRevisionBlobRuntime(
      profile,
    );
  const sourceBlobStore =
    await createNodeImmutableBlobStore(
      profile.blobStores.source,
    );
  let sourceLedger:
    Awaited<
      ReturnType<
        typeof openNodeSqliteLedger
      >
    > | undefined;
  let targetLedger:
    Awaited<
      ReturnType<
        typeof openNodeSqliteLedger
      >
    > | undefined;
  try {
    const initialEntry =
      revisionBlobRuntime
        .entryForRevisionId(
          profile.seed
            .initialRevisionInput
            .revisionId,
        );
    assertProbeCondition(
      initialEntry.content ===
        profile.seed
          .initialRevisionInput
          .content,
      "Initial revision blob entry does not match the seed input",
    );
    const initialBytes =
      Uint8Array.from(
        Buffer.from(
          initialEntry
            .encodedBytesBase64,
          "base64",
        ),
      );
    const initialPublication =
      await sourceBlobStore.append({
        bytes: initialBytes,
        metadata:
          initialEntry
            .appendMetadata,
        temporaryEntryIdentity:
          initialEntry
            .temporaryEntryIdentity,
      });
    assertProbeCondition(
      sameAddress(
        initialPublication
          .address,
        initialEntry.address,
      ),
      "Initial blob publication address does not match the caller profile",
    );
    assertProbeCondition(
      initialPublication
        .byteLength ===
        initialBytes.byteLength,
      "Initial blob publication byte length does not match",
    );

    sourceLedger =
      await openNodeSqliteLedger(
        profile.storage.source,
      );
    await sourceLedger.transaction(
      async (transaction) => {
        for (
          const record
          of profile.seed.records
        ) {
          transaction.write(
            record,
          );
        }
      },
    );
    const sourceRevisionStore =
      sourceLedger
        .createRevisionStore({
          blobStore:
            sourceBlobStore,
          blobProfile:
            revisionBlobRuntime
              .blobProfile,
        });
    const initialCurrent =
      await sourceRevisionStore
        .getCurrentRevision(
          profile
            .appendRevisionInput
            .documentId,
        );
    assertProbeCondition(
      initialCurrent?.id ===
        profile
          .appendRevisionInput
          .expectedCurrentRevisionId,
      "Seeded manuscript pointer does not match the append expectation",
    );
    const appendedRevision =
      await sourceRevisionStore
        .append(
          profile
            .appendRevisionInput,
        );
    assertProbeCondition(
      appendedRevision.id ===
        profile
          .appendRevisionInput
          .revisionId,
      "Appended revision identity does not match the caller profile",
    );
    const sourceMaterialized =
      await sourceRevisionStore
        .materialize(
          profile
            .appendRevisionInput
            .revisionId,
        );
    assertProbeCondition(
      sourceMaterialized ===
        profile
          .appendRevisionInput
          .content,
      "Source revision materialization does not match the caller content",
    );

    const catalog =
      createWritingCatalog(
        profile.catalog,
      );
    const sourceCheckpointTransaction =
      sourceLedger
        .createResumeCheckpointCaptureTransaction(
          {},
        );
    const checkpointCapture =
      new CaptureResumeCheckpointWithAnchors(
        {
          catalog,
          revisionStore:
            sourceRevisionStore,
          transaction:
            sourceCheckpointTransaction,
        },
      );
    const captured =
      await checkpointCapture.execute(
        profile.checkpoint,
      );
    const sourceCheckpointPointerMatches =
      captured.work
        .resumeCheckpointId ===
        profile.checkpoint
          .checkpoint.meta.id &&
      captured.checkpoint.meta.id ===
        profile.checkpoint
          .checkpoint.meta.id &&
      captured.checkpoint
        .documentRevisionId ===
        profile
          .appendRevisionInput
          .revisionId;
    assertProbeCondition(
      sourceCheckpointPointerMatches,
      "Atomic source checkpoint pointer capture did not match",
    );

    const adapters =
      createCanonicalAdapters(
        profile.backup
          .checksum,
      );
    const bundleBlobEntrySegments =
      createBlobLayoutLookup(
        profile.backup
          .blobEntries,
        "backup bundle",
      );
    const bundleLayout =
      Object.freeze({
        databaseEntrySegments:
          profile.backup
            .databaseEntrySegments,
        manifestEntrySegments:
          profile.backup
            .manifestEntrySegments,
        manifestChecksumEntrySegments:
          profile.backup
            .manifestChecksumEntrySegments,
        blobEntrySegments:
          bundleBlobEntrySegments,
      });
    const created =
      await createNodeSqliteBackupBundle(
        {
          sourceDatabasePath:
            profile.storage
              .source
              .databasePath,
          sourceBlobStore:
            sourceBlobStore,
          temporaryBundleRoot:
            profile.backup
              .temporaryBundleRoot,
          finalBundleRoot:
            profile.backup
              .finalBundleRoot,
          layout:
            bundleLayout,
          format:
            profile.backup
              .format,
          sqlite:
            profile.backup
              .sqlite,
          manifestCodec:
            adapters
              .manifestCodec,
          canonicalBytes:
            adapters
              .canonicalBytes,
          checksum:
            adapters.checksum,
          clock: Object.freeze({
            now: () =>
              profile.backup
                .createdAt,
          }),
        },
      );
    assertProbeCondition(
      created.publication ===
        "published",
      "Backup bundle was not published",
    );

    let requiredByteCount:
      number | undefined;
    let capacitySufficient:
      boolean | undefined;
    const targetBlobEntrySegments =
      createBlobLayoutLookup(
        profile.restore
          .blobEntries,
        "restore target",
      );
    const restored =
      await restoreNodeSqliteBackupBundle(
        {
          finalBundleRoot:
            profile.restore
              .finalBundleRoot,
          bundleLayout,
          targetStagingRoot:
            profile.restore
              .targetStagingRoot,
          targetFinalRoot:
            profile.restore
              .targetFinalRoot,
          targetLayout:
            Object.freeze({
              databaseEntrySegments:
                profile.restore
                  .databaseEntrySegments,
              blobEntrySegments:
                targetBlobEntrySegments,
            }),
          expectedFormat:
            profile.restore
              .expectedFormat,
          manifestCodec:
            adapters
              .manifestCodec,
          canonicalBytes:
            adapters
              .canonicalBytes,
          checksum:
            adapters.checksum,
          preflight:
            Object.freeze({
              preflight: async (
                preflightInput,
              ) => {
                assertProbeCondition(
                  requiredByteCount ===
                    undefined,
                  "Restore preflight was invoked more than once",
                );
                requiredByteCount =
                  preflightInput
                    .requiredByteCount;
                capacitySufficient =
                  profile.restore
                    .preflight
                    .availableByteCount >=
                  preflightInput
                    .requiredByteCount;
                assertProbeCondition(
                  profile.restore
                    .preflight
                    .authorized,
                  "Caller restore authorization was denied",
                );
                assertProbeCondition(
                  capacitySufficient,
                  "Caller restore capacity was insufficient",
                );
              },
            }),
        },
      );
    assertProbeCondition(
      restored.publication ===
        "published",
      "Restore target was not published",
    );
    assertProbeCondition(
      typeof requiredByteCount ===
        "number" &&
        requiredByteCount > 0 &&
        capacitySufficient === true,
      "Restore preflight receipt is incomplete",
    );
    assertProbeCondition(
      sameCanonical(
        restored.restoredCounts,
        created.manifest.counts,
      ),
      "Restored counts do not match the backup manifest",
    );
    assertProbeCondition(
      sameCanonical(
        restored
          .logicalChecksums,
        created.manifest
          .logicalChecksums,
      ),
      "Restored logical checksums do not match the backup manifest",
    );

    const targetBlobStore =
      await createNodeImmutableBlobStore(
        profile.blobStores
          .target,
      );
    targetLedger =
      await openNodeSqliteLedger(
        profile.storage.target,
      );
    const targetRevisionStore =
      targetLedger
        .createRevisionStore({
          blobStore:
            targetBlobStore,
          blobProfile:
            revisionBlobRuntime
              .blobProfile,
        });
    const targetMaterialized =
      await targetRevisionStore
        .materialize(
          profile
            .appendRevisionInput
            .revisionId,
        );
    assertProbeCondition(
      targetMaterialized ===
        profile
          .appendRevisionInput
          .content,
      "Restored revision materialization does not match the caller content",
    );
    const targetCurrent =
      await targetRevisionStore
        .getCurrentRevision(
          profile
            .appendRevisionInput
            .documentId,
        );
    const targetCurrentMatches =
      targetCurrent?.id ===
      profile.appendRevisionInput
        .revisionId;
    assertProbeCondition(
      targetCurrentMatches,
      "Restored manuscript pointer does not match the appended revision",
    );
    const targetCheckpointTransaction =
      targetLedger
        .createResumeCheckpointCaptureTransaction(
          {},
        );
    const targetWork =
      await targetCheckpointTransaction
        .getWork(
          profile.checkpoint
            .checkpoint.workId,
        );
    const targetCheckpoint =
      await targetCheckpointTransaction
        .getCheckpointById(
          profile.checkpoint
            .checkpoint.meta.id,
        );
    const targetCheckpointPointerMatches =
      targetWork
        ?.resumeCheckpointId ===
        profile.checkpoint
          .checkpoint.meta.id &&
      targetCheckpoint?.meta.id ===
        profile.checkpoint
          .checkpoint.meta.id &&
      targetCheckpoint
        .documentRevisionId ===
        profile
          .appendRevisionInput
          .revisionId;
    assertProbeCondition(
      targetCheckpointPointerMatches,
      "Restored checkpoint pointer readback does not match",
    );

    const integrity =
      await inspectNodeSqliteStorageIntegrity(
        {
          databasePath:
            profile.storage
              .target
              .databasePath,
          blobStore:
            targetBlobStore,
          reportIdentity:
            profile.integrity
              .reportIdentity,
          fingerprint: (
            canonicalReport,
          ): string =>
            checksumText(
              profile.integrity
                .fingerprintAlgorithm,
              canonicalReport,
            ),
        },
      );
    assertProbeCondition(
      integrity.valid,
      "Restored target integrity report is invalid",
    );
    const sourceMaterializedChecksum =
      checksumText(
        profile.checksum
          .algorithm,
        sourceMaterialized,
      );
    const targetMaterializedChecksum =
      checksumText(
        profile.checksum
          .algorithm,
        targetMaterialized,
      );
    assertProbeCondition(
      sourceMaterializedChecksum ===
        targetMaterializedChecksum,
      "Source and target materialized checksums do not match",
    );

    return deepFreezeClone({
      schemaVersion: 1,
      runIdentity:
        profile.runIdentity,
      runtime: {
        mainProcessId:
          process.pid,
        processType,
        platform:
          process.platform,
        electronVersion,
        nodeVersion:
          process.version,
      },
      identities: {
        checksumIdentity:
          profile.checksum
            .identity,
        checksumAlgorithm:
          profile.checksum
            .algorithm,
        revisionBlobCodecIdentity:
          profile.revisionBlob
            .codecIdentity,
        workId:
          profile.checkpoint
            .checkpoint.workId,
        documentId:
          profile.checkpoint
            .checkpoint
            .documentId,
        currentRevisionId:
          profile
            .appendRevisionInput
            .revisionId,
        checkpointId:
          profile.checkpoint
            .checkpoint.meta.id,
        backupChecksumIdentity:
          profile.backup
            .checksum.identity,
        backupFormatIdentity:
          profile.backup
            .format.identity,
        backupFormatVersion:
          profile.backup
            .format.version,
      },
      source: {
        counts:
          created.manifest.counts,
        logicalChecksums:
          created.manifest
            .logicalChecksums,
        materializedContentChecksum:
          sourceMaterializedChecksum,
        checkpointPointerMatches:
          true,
      },
      backup: {
        publication:
          created.publication,
        manifestChecksum:
          created
            .manifestChecksum
            .checksumValue,
        blobCount:
          created.manifest
            .blobs.length,
      },
      restore: {
        publication:
          restored.publication,
        preflight: {
          identity:
            profile.restore
              .preflight
              .identity,
          requiredByteCount,
          authorized: true,
          capacitySufficient:
            true,
        },
      },
      target: {
        counts:
          restored
            .restoredCounts,
        logicalChecksums:
          restored
            .logicalChecksums,
        integrityValid: true,
        integrityFingerprint:
          integrity.fingerprint,
        integrityCounts:
          integrity.counts,
        materializedContentChecksum:
          targetMaterializedChecksum,
        currentRevisionMatches:
          true,
        checkpointPointerMatches:
          true,
      },
    }) as
      Poc3InstalledPackageProbeReceipt;
  } finally {
    targetLedger?.close();
    sourceLedger?.close();
  }
}
