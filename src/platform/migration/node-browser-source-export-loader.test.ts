import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { parseLegacyBrowserSourceExportProfile } from "../../application/migration/browser-source-export";
import { loadNodeBrowserSourceExport } from "./node-browser-source-export-loader";

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("node browser source export loader", () => {
  it("loads only an explicit bundle path and emits complete redacted branch receipts", async () => {
    const root = await mkdtemp(
      join(tmpdir(), `eum-browser-export-${randomUUID()}-`),
    );
    cleanupRoots.push(root);
    const bundlePath = join(root, "browser-export.json");
    const manuscript = "원고 원문은 영수증에 노출하지 않습니다.";
    const apiSecret = "never-report-this-api-secret";
    const profile = parseLegacyBrowserSourceExportProfile({
      schemaVersion: 1,
      formatIdentity: "browser-export",
      formatVersion: "1",
      checksumIdentity: "sha256-v1",
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
      localStorageRoutes: [
        {
          matchKind: "prefix",
          matchValue: "manuscript:",
          sourceCollection: "manuscripts",
          sourceIdentityKind: "suffix",
          valueKind: "text",
          ownershipKind: "document-index",
        },
        {
          matchKind: "prefix",
          matchValue: "work-copy:",
          sourceCollection: "workSnapshots",
          sourceIdentityKind: "suffix",
          valueKind: "json-or-text",
          ownershipKind: "none",
        },
      ],
      indexedDbRoutes: [{
        databaseName: "work-db",
        storeName: "works",
        sourceCollection: "workSnapshots",
        ownershipField: "id",
        required: true,
      }],
    });
    const bundle = {
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
        { key: "manuscript:document-a", value: manuscript },
        {
          key: "provider-settings",
          value: JSON.stringify({ apiKey: apiSecret, model: "model-a" }),
        },
        {
          key: "work-copy:work-a",
          value: JSON.stringify({ id: "work-a", title: "local copy" }),
        },
      ],
      indexedDatabases: [{
        databaseName: "work-db",
        version: 1,
        stores: [{
          storeName: "works",
          records: [{
            key: "work-a",
            value: { id: "work-a", title: "database copy" },
          }],
        }],
      }],
    };
    await writeFile(bundlePath, `${JSON.stringify(bundle)}\n`, "utf8");

    const result = await loadNodeBrowserSourceExport({
      bundlePath,
      profile,
    });

    const sourceBytes = await readFile(bundlePath);
    expect(result.receipt.bundleChecksumValue).toBe(
      createHash("sha256").update(sourceBytes).digest("hex"),
    );
    expect(result.receipt.bundleByteLength).toBe(sourceBytes.byteLength);
    expect(result.capture.coverage).toEqual({
      sourceEntryCount: 5,
      capturedEntryCount: 5,
      uncoveredEntryCount: 0,
    });
    expect(result.receipt.entryReceipts).toHaveLength(5);
    expect(result.branches.map((branch) => branch.sourceLocator)).toEqual([
      "browser-export:localStorage",
      "browser-export:indexedDB:work-db/works",
    ]);
    expect(result.branchInventory.conflictCandidates).toHaveLength(1);
    expect(
      result.branchInventory.conflictCandidates[0]?.selectedSnapshotId,
    ).toBeNull();
    expect(result.capture.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceCollection: "manuscripts",
        sourceIdentity: "document-a",
        ownershipRef: "work-a",
        value: manuscript,
      }),
      expect.objectContaining({
        sourceIdentity: "provider-settings",
        disposition: "secret-redacted",
        value: { apiKey: "[REDACTED]", model: "model-a" },
      }),
    ]));
    const receiptJson = JSON.stringify(result.receipt);
    expect(receiptJson).not.toContain(manuscript);
    expect(receiptJson).not.toContain(apiSecret);
    expect(receiptJson).not.toContain(bundlePath);
  });
});
