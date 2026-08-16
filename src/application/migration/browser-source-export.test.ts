import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseLegacyBrowserSourceExportBundle,
  parseLegacyBrowserSourceExportProfile,
  parseLegacyBrowserSourceExportReceipt,
} from "./browser-source-export";

describe("legacy browser source export", () => {
  it("parses a value-free browser source receipt", () => {
    const receipt = parseLegacyBrowserSourceExportReceipt({
      schemaVersion: 1,
      formatIdentity: "browser-export",
      formatVersion: "1",
      exportedAt: "2026-08-10T00:00:00.000Z",
      sourceOrigin: "http://localhost",
      bundleByteLength: 100,
      bundleChecksumIdentity: "sha256-v1",
      bundleChecksumValue: "bundle-checksum",
      coverage: {
        sourceEntryCount: 1,
        capturedEntryCount: 1,
        uncoveredEntryCount: 0,
      },
      branchReceipts: [{
        snapshotId: "snapshot-a",
        sourceLocator: "browser-export:localStorage",
        branchKind: "local-storage",
        itemCount: 1,
      }],
      entryReceipts: [{
        snapshotId: "snapshot-a",
        sourceLocator: "browser-export:localStorage",
        branchKind: "local-storage",
        sourceCollection: "manuscripts",
        sourceIdentity: "document-a",
        sourceOccurrence: 0,
        ownershipRef: "work-a",
        disposition: "captured",
        redactedFieldCount: 0,
        checksumIdentity: "sha256-v1",
        checksumValue: "entry-checksum",
      }],
    });

    expect(receipt.coverage.capturedEntryCount).toBe(1);
    expect(receipt.entryReceipts[0]).not.toHaveProperty("value");
  });

  it("parses the checked-in legacy browser export profile", async () => {
    const profile = parseLegacyBrowserSourceExportProfile(JSON.parse(
      await readFile(
        join(process.cwd(), "config", "legacy-browser-source-export.json"),
        "utf8",
      ),
    ));

    expect(profile.formatIdentity).toBe("eum-browser-source-export");
    expect(profile.bundleArchive).toEqual({
      sourceLocator: "browser-export:bundle",
      rawEntrySegments: ["raw", "browser-source-export.json"],
    });
    expect(profile.localStorageOwnershipIndex.key).toBe(
      "eum-editor:library:v2",
    );
    expect(profile.localStorageRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        matchKind: "prefix",
        matchValue: "eum-editor:manuscript:v2:",
        sourceCollection: "manuscripts",
      }),
    ]));
    expect(profile.indexedDbRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        databaseName: "eum-work-store",
        storeName: "works",
        required: true,
      }),
      expect.objectContaining({
        databaseName: "eum-publishing-store",
        storeName: "publishing-state",
        required: true,
      }),
    ]));
  });

  it("keeps every exported localStorage and IndexedDB entry while redacting secret-like values", () => {
    const profile = parseLegacyBrowserSourceExportProfile({
      schemaVersion: 1,
      formatIdentity: "browser-export",
      formatVersion: "1",
      checksumIdentity: "sha256-canonical-json-utf8-v1",
      checksumAlgorithm: "sha256",
      secretLikeFieldFragments: ["apiKey", "accessToken", "secret"],
      secretRedactionValue: "[REDACTED]",
      bundleArchive: {
        sourceLocator: "browser-export:bundle",
        rawEntrySegments: ["raw", "browser-source-export.json"],
      },
      localStorageOwnershipIndex: {
        key: "library-key",
        worksField: "works",
        documentsField: "episodes",
        workIdField: "id",
        documentIdField: "id",
        documentWorkIdField: "workId",
      },
      localStorageRoutes: [{
        matchKind: "prefix",
        matchValue: "manuscript:",
        sourceCollection: "manuscripts",
        sourceIdentityKind: "suffix",
        valueKind: "text",
        ownershipKind: "document-index",
      }],
      indexedDbRoutes: [
        {
          databaseName: "work-db",
          storeName: "works",
          sourceCollection: "workSnapshots",
          ownershipField: "id",
          required: true,
        },
        {
          databaseName: "work-db",
          storeName: "backups",
          sourceCollection: "workBackups",
          ownershipField: "workId",
          required: true,
        },
        {
          databaseName: "publishing-db",
          storeName: "state",
          sourceCollection: "publishingSnapshots",
          ownershipField: null,
          required: true,
        },
      ],
    });
    const capture = parseLegacyBrowserSourceExportBundle({
      formatIdentity: "browser-export",
      formatVersion: "1",
      exportedAt: "2026-08-10T00:00:00.000Z",
      sourceOrigin: "http://localhost",
      localStorageEntries: [
        {
          key: "library-key",
          value: JSON.stringify({
            works: [{ id: "work-a" }],
            episodes: [{ id: "document-a", workId: "work-a" }],
          }),
        },
        { key: "manuscript:document-a", value: "원고 그대로" },
        { key: "provider", value: JSON.stringify({ apiKey: "nested-secret", model: "m" }) },
        { key: "secret-apiKey", value: "top-level-secret" },
      ],
      indexedDatabases: [
        {
          databaseName: "work-db",
          version: 1,
          stores: [
            {
              storeName: "works",
              records: [{ key: "work-a", value: { id: "work-a", title: "작품" } }],
            },
            {
              storeName: "backups",
              records: [{ key: "backup-a", value: { id: "backup-a", workId: "work-a" } }],
            },
            {
              storeName: "future-store",
              records: [{ key: "future-a", value: { futureField: true } }],
            },
          ],
        },
        {
          databaseName: "publishing-db",
          version: 1,
          stores: [{
            storeName: "state",
            records: [{ key: "current", value: { submissions: [] } }],
          }],
        },
      ],
    }, profile);

    expect(capture.coverage).toEqual({
      sourceEntryCount: 8,
      capturedEntryCount: 8,
      uncoveredEntryCount: 0,
    });
    expect(capture.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        branchKind: "local-storage",
        sourceCollection: "manuscripts",
        sourceIdentity: "document-a",
        ownershipRef: "work-a",
        disposition: "captured",
        value: "원고 그대로",
      }),
      expect.objectContaining({
        sourceIdentity: "provider",
        disposition: "secret-redacted",
        redactedFieldCount: 1,
        value: { apiKey: "[REDACTED]", model: "m" },
      }),
      expect.objectContaining({
        sourceIdentity: "secret-apiKey",
        disposition: "secret-redacted",
        redactedFieldCount: 1,
        value: "[REDACTED]",
      }),
      expect.objectContaining({
        branchKind: "indexed-db",
        sourceCollection: "workSnapshots",
        ownershipRef: "work-a",
      }),
      expect.objectContaining({
        branchKind: "indexed-db",
        sourceCollection: "indexedDb",
        sourceIdentity: "future-a",
        ownershipRef: null,
      }),
    ]));
    expect(capture.items).toHaveLength(capture.coverage.sourceEntryCount);
  });
});
