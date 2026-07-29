import {
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import {
  join,
} from "node:path";
import {
  tmpdir,
} from "node:os";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseNodeImmutableBlobStoreProfile,
} from "../../src/platform/storage/node-immutable-blob-store-profile";
import {
  createNodeImmutableBlobStore,
} from "../../src/platform/storage/node-immutable-blob-store";

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
  "POC-3 immutable blob write faults",
  () => {
    it(
      "leaves existing objects unchanged and inventories each failed temporary remnant without retry",
      async () => {
        const fixture =
          await readFixture();
        const algorithm =
          fixture.materials
            .checksumAlgorithms[0];
        if (
          algorithm === undefined
        ) {
          throw new Error(
            "Caller fixture requires a checksum algorithm material",
          );
        }

        for (
          const stage
          of fixture.faultStages
        ) {
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
          const existingBytes =
            new TextEncoder().encode(
              [
                randomUUID(),
                ...fixture.materials
                  .byteText,
              ].join(randomUUID()),
            );
          const failedBytes =
            new TextEncoder().encode(
              [
                randomUUID(),
                ...fixture.materials
                  .byteText,
                randomUUID(),
              ].join(randomUUID()),
            );
          const partialWriteByteCount =
            Math.floor(
              failedBytes.byteLength /
                fixture.counts
                  .partialWriteDivisor,
            );
          const temporaryEntryIdentity =
            randomUUID();
          const injectedFailure =
            new Error(randomUUID());
          let injectionCount = 0;

          try {
            const normalStore =
              await createNodeImmutableBlobStore(
                profile,
              );
            await normalStore.append({
              bytes: existingBytes,
              metadata: {
                [randomUUID()]:
                  randomUUID(),
              },
              temporaryEntryIdentity:
                randomUUID(),
            });
            const before =
              await normalStore.inventory({
                isReachable:
                  async () => false,
              });
            const faultStore =
              await createNodeImmutableBlobStore(
                profile,
                {
                  faultInjection: {
                    stage,
                    partialWriteByteCount,
                    inject: async () => {
                      injectionCount += 1;
                      throw injectedFailure;
                    },
                  },
                },
              );

            await expect(
              faultStore.append({
                bytes: failedBytes,
                metadata: {
                  [randomUUID()]:
                    randomUUID(),
                },
                temporaryEntryIdentity,
              }),
            ).rejects.toBe(
              injectedFailure,
            );
            expect(
              injectionCount,
            ).toBe(1);
            const after =
              await faultStore.inventory({
                isReachable:
                  async () => false,
              });

            expect(
              after.published,
            ).toEqual(
              before.published,
            );
            expect(
              after.temporary,
            ).toHaveLength(1);
            expect(
              after.temporary[0],
            ).toMatchObject({
              temporaryEntryIdentity,
              byteLength:
                stage ===
                "partial-write"
                  ? partialWriteByteCount
                  : failedBytes
                      .byteLength,
            });
          } finally {
            await rm(
              temporaryRoot,
              {
                recursive: true,
                force: true,
              },
            );
          }
        }
      },
    );
  },
);
