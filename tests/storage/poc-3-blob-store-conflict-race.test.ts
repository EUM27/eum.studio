import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  link,
  mkdtemp,
  readFile,
  rm,
  unlink,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  join,
} from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BlobPublicationConflictError,
} from "../../src/application/storage/blob-store";
import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";

type FaultStage =
  | "partial-write"
  | "sync"
  | "publish";

type BlobFixtureManifest = {
  readonly layout: {
    readonly publishedDirectorySegmentCount:
      number;
    readonly temporaryDirectorySegmentCount:
      number;
    readonly shardWidths:
      readonly number[];
  };
  readonly counts: {
    readonly partialWriteDivisor:
      number;
  };
  readonly materials: {
    readonly checksumAlgorithms:
      readonly string[];
    readonly byteText:
      readonly string[];
  };
  readonly faultStages:
    readonly FaultStage[];
};

async function readFixture(): Promise<
  BlobFixtureManifest
> {
  return JSON.parse(
    await readFile(
      new URL(
        "../fixtures/storage/poc-3-blob-store.manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as BlobFixtureManifest;
}

describe(
  "POC-3 immutable publication conflict race",
  () => {
    it(
      "errors and preserves the temporary object when an EEXIST target disappears before exact verification",
      async () => {
        const fixture =
          await readFixture();
        const algorithm =
          fixture.materials
            .checksumAlgorithms[0];
        const publishStage =
          fixture.faultStages.find(
            (stage) =>
              stage === "publish",
          );
        if (
          algorithm === undefined ||
          publishStage ===
            undefined
        ) {
          throw new Error(
            "Caller fixture requires checksum and publish-stage materials",
          );
        }
        const temporaryRoot =
          await mkdtemp(
            join(
              tmpdir(),
              randomUUID(),
            ),
          );
        const profile =
          parseNodeImmutableBlobStoreProfile({
            rootDirectoryPath:
              join(
                temporaryRoot,
                randomUUID(),
              ),
            checksum: {
              identity:
                randomUUID(),
              algorithm,
            },
            publishedLayout: {
              directorySegments:
                Array.from(
                  {
                    length:
                      fixture.layout
                        .publishedDirectorySegmentCount,
                  },
                  randomUUID,
                ),
              shardWidths:
                fixture.layout
                  .shardWidths,
              fileNamePrefix:
                randomUUID(),
              fileNameSuffix:
                randomUUID(),
            },
            temporaryLayout: {
              directorySegments:
                Array.from(
                  {
                    length:
                      fixture.layout
                        .temporaryDirectorySegmentCount,
                  },
                  randomUUID,
                ),
            },
          });
        const bytes =
          new TextEncoder().encode(
            [
              randomUUID(),
              ...fixture.materials
                .byteText,
              randomUUID(),
            ].join(randomUUID()),
          );
        const checksumValue =
          createHash(algorithm)
            .update(bytes)
            .digest("hex");
        let shardOffset = 0;
        const shardSegments =
          profile.publishedLayout
            .shardWidths.map(
              (width) => {
                const shard =
                  checksumValue.slice(
                    shardOffset,
                    shardOffset +
                      width,
                  );
                shardOffset += width;
                return shard;
              },
            );
        const publishedPath =
          join(
            profile.rootDirectoryPath,
            ...profile
              .publishedLayout
              .directorySegments,
            ...shardSegments,
            `${
              profile.publishedLayout
                .fileNamePrefix
            }${checksumValue}${
              profile.publishedLayout
                .fileNameSuffix
            }`,
          );
        const temporaryEntryIdentity =
          randomUUID();
        const temporaryPath =
          join(
            profile.rootDirectoryPath,
            ...profile
              .temporaryLayout
              .directorySegments,
            temporaryEntryIdentity,
          );
        const partialWriteByteCount =
          Math.floor(
            bytes.byteLength /
              fixture.counts
                .partialWriteDivisor,
          );
        let beforeConflictCount = 0;
        let afterConflictCount = 0;

        try {
          const store =
            await createNodeImmutableBlobStore(
              profile,
              {
                faultInjection: {
                  stage: publishStage,
                  partialWriteByteCount,
                  inject: async () => {
                    beforeConflictCount += 1;
                    await link(
                      temporaryPath,
                      publishedPath,
                    );
                  },
                },
                publicationConflictInjection: {
                  inject: async () => {
                    afterConflictCount += 1;
                    await unlink(
                      publishedPath,
                    );
                  },
                },
              },
            );

          await expect(
            store.append({
              bytes,
              metadata: {
                [randomUUID()]:
                  randomUUID(),
              },
              temporaryEntryIdentity,
            }),
          ).rejects.toBeInstanceOf(
            BlobPublicationConflictError,
          );
          expect(
            beforeConflictCount,
          ).toBe(1);
          expect(
            afterConflictCount,
          ).toBe(1);
          expect(
            new Uint8Array(
              await readFile(
                temporaryPath,
              ),
            ),
          ).toEqual(bytes);
          const inventory =
            await store.inventory({
              isReachable:
                async () => false,
            });
          expect(
            inventory.published,
          ).toEqual([]);
          expect(
            inventory.temporary,
          ).toEqual([
            expect.objectContaining({
              temporaryEntryIdentity,
              byteLength:
                bytes.byteLength,
            }),
          ]);
        } finally {
          await rm(
            temporaryRoot,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );
  },
);
