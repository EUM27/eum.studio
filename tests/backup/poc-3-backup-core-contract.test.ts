import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  StorageBackupManifestData,
  StorageBackupPort,
  StorageBackupReportData,
} from "../../src/application/storage/storage-backup";
import {
  createNodeSqliteBackupBundle,
  restoreNodeSqliteBackupBundle,
} from "../../src/platform/storage/node-sqlite-backup";

describe(
  "POC-3 backup core public boundary",
  () => {
    it(
      "keeps application backup manifests and reports opaque",
      () => {
        const manifest:
          StorageBackupManifestData =
          Object.freeze({
            formatIdentity:
              crypto.randomUUID(),
          });
        const report:
          StorageBackupReportData =
          Object.freeze({
            operationIdentity:
              crypto.randomUUID(),
          });
        const port:
          StorageBackupPort =
          Object.freeze({
            create: async () =>
              report,
            restore: async () =>
              report,
          });

        expect(
          Object.keys(manifest),
        ).toContain(
          "formatIdentity",
        );
        expect(port.create).toBeTypeOf(
          "function",
        );
      },
    );

    it(
      "exports explicit platform create and restore operations",
      () => {
        expect(
          createNodeSqliteBackupBundle,
        ).toBeTypeOf("function");
        expect(
          restoreNodeSqliteBackupBundle,
        ).toBeTypeOf("function");
      },
    );
  },
);
