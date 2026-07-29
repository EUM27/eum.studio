import {
  createHash,
  getHashes,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  join,
} from "node:path";

import type {
  Poc3InstalledPackageManifest,
} from "./poc-3-installed-package-profile";

type RuntimeClock = {
  instant(): string;
  revision(): number;
};

type RevisionCodecEntry = {
  readonly revisionId: string;
  readonly content: string;
  readonly encodedBytesBase64:
    string;
  readonly descriptor: {
    readonly contentHash: string;
    readonly length: number;
  };
  readonly address: {
    readonly checksumIdentity:
      string;
    readonly checksumValue: string;
  };
  readonly blobRef: string;
  readonly appendMetadata:
    Readonly<
      Record<
        string,
        string
      >
    >;
  readonly temporaryEntryIdentity:
    string;
  readonly manifestMetadata: {
    readonly createdAt: string;
    readonly mediaType: string;
    readonly originalName: string;
  };
};

export type RuntimeProbeFixture = {
  readonly profile:
    Readonly<Record<string, unknown>>;
  readonly expected: {
    readonly runIdentity: string;
    readonly workId: string;
    readonly documentId: string;
    readonly revisionId: string;
    readonly checkpointId: string;
    readonly counts: {
      readonly workCount: 1;
      readonly documentCount: 1;
      readonly revisionCount: 2;
      readonly resumeCheckpointCount:
        1;
      readonly writingSessionCount:
        0;
    };
    readonly materializedChecksum:
      string;
  };
  readonly forbiddenArtifactValues:
    readonly string[];
};

function digest(
  algorithm: string,
  bytes: string | Uint8Array,
): string {
  return createHash(algorithm)
    .update(bytes)
    .digest("hex");
}

function createRuntimeClock():
  RuntimeClock {
  let offset = 0;
  const startedAt =
    Date.now() +
    randomInt(1, 1_000);
  return Object.freeze({
    instant: () =>
      new Date(
        startedAt + offset++,
      ).toISOString(),
    revision: () =>
      startedAt + offset++,
  });
}

function runtimeJson(): string {
  return JSON.stringify({
    [randomUUID()]: randomUUID(),
  });
}

function runtimeSegments(
  depth: number,
): readonly string[] {
  return Object.freeze(
    Array.from(
      { length: depth },
      randomUUID,
    ),
  );
}

function selectCommonChecksumAlgorithm(
  electronAlgorithms:
    readonly string[],
  shardWidths:
    readonly number[],
): string {
  const minimumHexLength =
    shardWidths.reduce(
      (total, width) =>
        total + width,
      0,
    );
  const nodeAlgorithms =
    new Set(getHashes());
  const candidates =
    electronAlgorithms.filter(
      (algorithm) => {
        if (
          !nodeAlgorithms.has(
            algorithm,
          )
        ) {
          return false;
        }
        try {
          return (
            digest(
              algorithm,
              randomUUID(),
            ).length >=
            minimumHexLength
          );
        } catch {
          return false;
        }
      },
    );
  const selected =
    candidates[
      randomInt(candidates.length)
    ];
  if (selected === undefined) {
    throw new Error(
      "Caller found no common Electron/test checksum algorithm",
    );
  }
  return selected;
}

function createCodecEntry(
  input: {
    readonly revisionId:
      string;
    readonly content: string;
    readonly encodedByteLength:
      number;
    readonly checksumIdentity:
      string;
    readonly checksumAlgorithm:
      string;
    readonly clock: RuntimeClock;
  },
): RevisionCodecEntry {
  const bytes = randomBytes(
    input.encodedByteLength,
  );
  return Object.freeze({
    revisionId: input.revisionId,
    content: input.content,
    encodedBytesBase64:
      bytes.toString("base64"),
    descriptor: Object.freeze({
      contentHash: digest(
        input.checksumAlgorithm,
        bytes,
      ),
      length:
        input.content.length,
    }),
    address: Object.freeze({
      checksumIdentity:
        input.checksumIdentity,
      checksumValue: digest(
        input.checksumAlgorithm,
        bytes,
      ),
    }),
    blobRef: randomUUID(),
    appendMetadata:
      Object.freeze({
        [randomUUID()]:
          randomUUID(),
      }),
    temporaryEntryIdentity:
      randomUUID(),
    manifestMetadata:
      Object.freeze({
        createdAt:
          input.clock.instant(),
        mediaType: randomUUID(),
        originalName:
          randomUUID(),
      }),
  });
}

function publishedBlobSegments(
  profile: {
    readonly publishedLayout: {
      readonly directorySegments:
        readonly string[];
      readonly shardWidths:
        readonly number[];
      readonly fileNamePrefix:
        string;
      readonly fileNameSuffix:
        string;
    };
  },
  checksumValue: string,
): readonly string[] {
  let offset = 0;
  const shards =
    profile.publishedLayout
      .shardWidths
      .map((width) => {
        const shard =
          checksumValue.slice(
            offset,
            offset + width,
          );
        offset += width;
        return shard;
      });
  return Object.freeze([
    ...profile.publishedLayout
      .directorySegments,
    ...shards,
    `${
      profile.publishedLayout
        .fileNamePrefix
    }${checksumValue}${
      profile.publishedLayout
        .fileNameSuffix
    }`,
  ]);
}

export function createRuntimeProbeFixture(
  input: {
    readonly temporaryParentPath:
      string;
    readonly electronHashAlgorithms:
      readonly string[];
    readonly manifest:
      Poc3InstalledPackageManifest;
    readonly secretCanary: string;
  },
): RuntimeProbeFixture {
  const fixture =
    input.manifest.probeFixture;
  const clock = createRuntimeClock();
  const checksumAlgorithm =
    selectCommonChecksumAlgorithm(
      input.electronHashAlgorithms,
      fixture.publishedShardWidths,
    );
  const checksumIdentity =
    randomUUID();
  const codecIdentity =
    randomUUID();
  const runIdentity = randomUUID();
  const studioId = randomUUID();
  const workId = randomUUID();
  const activityPolicyId =
    randomUUID();
  const focusPolicyId =
    randomUUID();
  const settingsId = randomUUID();
  const documentId = randomUUID();
  const manuscriptId =
    randomUUID();
  const initialRevisionId =
    randomUUID();
  const revisionId = randomUUID();
  const anchorId = randomUUID();
  const checkpointId =
    randomUUID();
  const sourceDatabasePath =
    join(
      input.temporaryParentPath,
      randomUUID(),
    );
  const sourceBlobRootPath =
    join(
      input.temporaryParentPath,
      randomUUID(),
    );
  const temporaryBundleRoot =
    join(
      input.temporaryParentPath,
      randomUUID(),
    );
  const finalBundleRoot =
    join(
      input.temporaryParentPath,
      randomUUID(),
    );
  const targetStagingRoot =
    join(
      input.temporaryParentPath,
      randomUUID(),
    );
  const targetFinalRoot =
    join(
      input.temporaryParentPath,
      randomUUID(),
    );
  const databaseEntrySegments =
    runtimeSegments(
      fixture.layoutSegmentDepth,
    );
  const manifestEntrySegments =
    runtimeSegments(
      fixture.layoutSegmentDepth,
    );
  const manifestChecksumEntrySegments =
    runtimeSegments(
      fixture.layoutSegmentDepth,
    );
  const targetDatabaseEntrySegments =
    runtimeSegments(
      fixture.layoutSegmentDepth,
    );
  const targetDatabasePath =
    join(
      targetFinalRoot,
      ...targetDatabaseEntrySegments,
    );
  const initialContent =
    Array.from(
      {
        length: randomInt(2, 6),
      },
      randomUUID,
    ).join(randomUUID());
  const nextContent =
    Array.from(
      {
        length: randomInt(2, 6),
      },
      randomUUID,
    ).join(randomUUID());
  const initialEntry =
    createCodecEntry({
      revisionId:
        initialRevisionId,
      content: initialContent,
      encodedByteLength:
        fixture
          .encodedBlobByteLength,
      checksumIdentity,
      checksumAlgorithm,
      clock,
    });
  const nextEntry =
    createCodecEntry({
      revisionId,
      content: nextContent,
      encodedByteLength:
        fixture
          .encodedBlobByteLength +
        randomInt(1, 32),
      checksumIdentity,
      checksumAlgorithm,
      clock,
    });
  if (
    initialEntry.address
      .checksumValue ===
    nextEntry.address.checksumValue
  ) {
    throw new Error(
      "Caller-generated blob checksums collided",
    );
  }
  const sourceBlobStoreProfile =
    Object.freeze({
      rootDirectoryPath:
        sourceBlobRootPath,
      checksum: Object.freeze({
        identity:
          checksumIdentity,
        algorithm:
          checksumAlgorithm,
      }),
      publishedLayout:
        Object.freeze({
          directorySegments:
            runtimeSegments(
              fixture
                .layoutSegmentDepth,
            ),
          shardWidths:
            Object.freeze([
              ...fixture
                .publishedShardWidths,
            ]),
          fileNamePrefix:
            randomUUID(),
          fileNameSuffix:
            randomUUID(),
        }),
      temporaryLayout:
        Object.freeze({
          directorySegments:
            runtimeSegments(
              fixture
                .layoutSegmentDepth,
            ),
        }),
    });
  const targetBlobStoreProfile =
    Object.freeze({
      rootDirectoryPath:
        targetFinalRoot,
      checksum: Object.freeze({
        identity:
          checksumIdentity,
        algorithm:
          checksumAlgorithm,
      }),
      publishedLayout:
        Object.freeze({
          directorySegments:
            runtimeSegments(
              fixture
                .layoutSegmentDepth,
            ),
          shardWidths:
            Object.freeze([
              ...fixture
                .publishedShardWidths,
            ]),
          fileNamePrefix:
            randomUUID(),
          fileNameSuffix:
            randomUUID(),
        }),
      temporaryLayout:
        Object.freeze({
          directorySegments:
            runtimeSegments(
              fixture
                .layoutSegmentDepth,
            ),
        }),
    });
  const workMeta = Object.freeze({
    id: workId,
    schemaVersion:
      fixture.targetSchemaVersion,
    revision: clock.revision(),
    createdAt: clock.instant(),
    updatedAt: clock.instant(),
  });
  const documentMeta =
    Object.freeze({
      id: documentId,
      schemaVersion:
        fixture
          .targetSchemaVersion,
      revision: clock.revision(),
      createdAt: clock.instant(),
      updatedAt: clock.instant(),
    });
  const work = Object.freeze({
    meta: workMeta,
    studioId,
    title: randomUUID(),
    orderKey: randomUUID(),
    settingsId,
  });
  const document =
    Object.freeze({
      meta: documentMeta,
      workId,
      title: randomUUID(),
      orderKey: randomUUID(),
      manuscriptId,
    });
  const initialRevisionInput =
    Object.freeze({
      revisionId:
        initialRevisionId,
      workId,
      documentId,
      expectedCurrentRevisionId:
        null,
      content: initialContent,
      cause: randomUUID(),
      createdAt: clock.instant(),
      durableAt: clock.instant(),
    });
  const appendRevisionInput =
    Object.freeze({
      revisionId,
      workId,
      documentId,
      expectedCurrentRevisionId:
        initialRevisionId,
      content: nextContent,
      cause: randomUUID(),
      createdAt: clock.instant(),
      durableAt: clock.instant(),
    });
  const meta = (
    id: string,
  ) => Object.freeze({
    id,
    schemaVersion:
      fixture.targetSchemaVersion,
    revision: clock.revision(),
    createdAt: clock.instant(),
    updatedAt: clock.instant(),
  });
  const seedRecords =
    Object.freeze([
      Object.freeze({
        kind: "studio",
        id: studioId,
        displayName: randomUUID(),
        locale: randomUUID(),
        timezone: randomUUID(),
        settingsRevision:
          clock.revision(),
        createdAt: clock.instant(),
      }),
      Object.freeze({
        kind: "work",
        ...workMeta,
        studioId,
        title: work.title,
        orderKey: work.orderKey,
        settingsId,
      }),
      Object.freeze({
        kind: "activityPolicy",
        ...meta(activityPolicyId),
        workId,
        idleTimeout:
          clock.revision(),
        navigationGrace:
          clock.revision(),
        hiddenWindowPolicy:
          randomUUID(),
        activityClassRulesJson:
          runtimeJson(),
        autoStartEnabled:
          randomInt(2) === 1,
        autoResumeFromIdle:
          randomInt(2) === 1,
        recoveryPolicy:
          randomUUID(),
      }),
      Object.freeze({
        kind: "focusPolicy",
        ...meta(focusPolicyId),
        workId,
        phaseDefinitionsJson:
          runtimeJson(),
        backgroundPolicy:
          randomUUID(),
        musicStartPolicy:
          randomUUID(),
        completionPolicy:
          randomUUID(),
        visibility: randomUUID(),
      }),
      Object.freeze({
        kind: "workSettings",
        id: settingsId,
        workId,
        sceneRuleSetId:
          randomUUID(),
        activityPolicyId,
        focusPolicyId,
        railPreferencesJson:
          runtimeJson(),
        revision: clock.revision(),
      }),
      Object.freeze({
        kind: "blobManifest",
        blobRef:
          initialEntry.blobRef,
        checksumIdentity,
        checksumValue:
          initialEntry.address
            .checksumValue,
        byteLength:
          Buffer.from(
            initialEntry
              .encodedBytesBase64,
            "base64",
          ).byteLength,
        ...initialEntry
          .manifestMetadata,
      }),
      Object.freeze({
        kind: "document",
        ...documentMeta,
        workId,
        title: document.title,
        orderKey:
          document.orderKey,
        manuscriptId,
      }),
      Object.freeze({
        kind:
          "documentRevision",
        id: initialRevisionId,
        workId,
        documentId,
        contentRef:
          initialEntry.blobRef,
        contentHash:
          initialEntry.descriptor
            .contentHash,
        length:
          initialEntry.descriptor
            .length,
        cause:
          initialRevisionInput
            .cause,
        createdAt:
          initialRevisionInput
            .createdAt,
        durableAt:
          initialRevisionInput
            .durableAt,
      }),
      Object.freeze({
        kind: "manuscript",
        id: manuscriptId,
        workId,
        documentId,
        currentRevisionId:
          initialRevisionId,
        durableRevisionId:
          initialRevisionId,
        updatedAt:
          initialRevisionInput
            .durableAt,
      }),
    ]);
  const cursorOffset =
    randomInt(
      nextEntry.descriptor.length +
        1,
    );
  const anchorMeta =
    meta(anchorId);
  const cursorAnchor =
    Object.freeze({
      meta: anchorMeta,
      documentId,
      originRevisionId:
        revisionId,
      resolvedRevisionId:
        revisionId,
      startOffset: cursorOffset,
      endOffset: cursorOffset,
      exactQuote: "",
      prefixContext: "",
      suffixContext: "",
      quoteHash: digest(
        checksumAlgorithm,
        randomBytes(
          randomInt(1, 32),
        ),
      ),
      contextHash: digest(
        checksumAlgorithm,
        randomBytes(
          randomInt(1, 32),
        ),
      ),
      status:
        fixture.anchor.status,
      resolutionEvidence:
        Object.freeze({
          targetRevisionId:
            revisionId,
          method:
            fixture.anchor
              .resolutionMethod,
          matchedEvidence:
            Object.freeze([
              ...fixture.anchor
                .matchedEvidence,
            ]),
          candidateOffsets:
            Object.freeze([
              cursorOffset,
            ]),
          policyVersion:
            randomUUID(),
          assessedAt:
            clock.instant(),
        }),
    });
  const capturedAt =
    clock.instant();
  const checkpoint =
    Object.freeze({
      meta: meta(checkpointId),
      workId,
      documentId,
      documentRevisionId:
        revisionId,
      cursorAnchorId: anchorId,
      workspaceMode:
        randomUUID(),
      capturedAt,
    });
  const codecEntries =
    Object.freeze([
      initialEntry,
      nextEntry,
    ]);
  const bundleBlobEntries =
    Object.freeze(
      codecEntries.map(
        (entry) =>
          Object.freeze({
            address:
              entry.address,
            relativeSegments:
              runtimeSegments(
                fixture
                  .layoutSegmentDepth,
              ),
          }),
      ),
    );
  const targetBlobEntries =
    Object.freeze(
      codecEntries.map(
        (entry) =>
          Object.freeze({
            address:
              entry.address,
            relativeSegments:
              publishedBlobSegments(
                targetBlobStoreProfile,
                entry.address
                  .checksumValue,
              ),
          }),
      ),
    );
  const backupFormat =
    Object.freeze({
      identity: randomUUID(),
      version: randomUUID(),
    });
  const preflightIdentity =
    randomUUID();
  const profile =
    Object.freeze({
      schemaVersion: 1,
      runIdentity,
      checksum: Object.freeze({
        identity:
          checksumIdentity,
        algorithm:
          checksumAlgorithm,
      }),
      storage: Object.freeze({
        source: Object.freeze({
          databasePath:
            sourceDatabasePath,
          checksumIdentity,
          requestedSettings:
            fixture
              .requestedSettings,
          targetSchemaVersion:
            fixture
              .targetSchemaVersion,
        }),
        target: Object.freeze({
          databasePath:
            targetDatabasePath,
          checksumIdentity,
          requestedSettings:
            fixture
              .requestedSettings,
          targetSchemaVersion:
            fixture
              .targetSchemaVersion,
        }),
      }),
      blobStores: Object.freeze({
        source:
          sourceBlobStoreProfile,
        target:
          targetBlobStoreProfile,
      }),
      revisionBlob:
        Object.freeze({
          codecIdentity,
          entries: codecEntries,
        }),
      seed: Object.freeze({
        initialRevisionInput,
        records: seedRecords,
      }),
      appendRevisionInput,
      catalog: Object.freeze({
        works: Object.freeze([
          work,
        ]),
        documents:
          Object.freeze([
            document,
          ]),
      }),
      checkpoint: Object.freeze({
        checkpoint,
        cursorAnchor,
        expectedWorkRevision:
          workMeta.revision,
        expectedResumeCheckpointId:
          null,
        expectedDocumentRevisionId:
          revisionId,
      }),
      backup: Object.freeze({
        temporaryBundleRoot,
        finalBundleRoot,
        databaseEntrySegments,
        manifestEntrySegments,
        manifestChecksumEntrySegments,
        blobEntries:
          bundleBlobEntries,
        format: backupFormat,
        sqlite:
          fixture.backupSqlite,
        checksum:
          Object.freeze({
            identity:
              randomUUID(),
            algorithm:
              checksumAlgorithm,
          }),
        createdAt:
          clock.instant(),
      }),
      restore: Object.freeze({
        finalBundleRoot,
        targetStagingRoot,
        targetFinalRoot,
        databaseEntrySegments:
          targetDatabaseEntrySegments,
        blobEntries:
          targetBlobEntries,
        expectedFormat:
          backupFormat,
        preflight:
          Object.freeze({
            identity:
              preflightIdentity,
            authorized:
              fixture
                .restorePreflightAuthorized,
            availableByteCount:
              Number.MAX_SAFE_INTEGER -
              randomInt(
                1,
                1_000,
              ),
          }),
      }),
      integrity: Object.freeze({
        reportIdentity:
          randomUUID(),
        fingerprintAlgorithm:
          checksumAlgorithm,
      }),
    });
  return Object.freeze({
    profile,
    expected: Object.freeze({
      runIdentity,
      workId,
      documentId,
      revisionId,
      checkpointId,
      counts: Object.freeze({
        workCount: 1,
        documentCount: 1,
        revisionCount: 2,
        resumeCheckpointCount:
          1,
        writingSessionCount: 0,
      }),
      materializedChecksum:
        digest(
          checksumAlgorithm,
          nextContent,
        ),
    }),
    forbiddenArtifactValues:
      Object.freeze([
        initialContent,
        nextContent,
        sourceDatabasePath,
        sourceBlobRootPath,
        temporaryBundleRoot,
        finalBundleRoot,
        targetStagingRoot,
        targetFinalRoot,
        targetDatabasePath,
        input.secretCanary,
      ]),
  });
}
