import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseLegacyLoreImportProfile } from "./legacy-lore-import-profile";

describe("legacy lore import profile", () => {
  it("parses the checked-in read-only source and rehearsal layout", () => {
    const profile = parseLegacyLoreImportProfile(
      JSON.parse(
        readFileSync(
          path.join(process.cwd(), "config", "legacy-lore-import.json"),
          "utf8",
        ),
      ),
    );

    expect(profile).toMatchObject({
      schemaVersion: 1,
      source: {
        mappingSourceLocator: "data/lorebooks.json",
        captures: [
          {
            branchKind: "live-file",
            sourceFileSegments: ["data", "lorebooks.json"],
            sourceLocator: "data/lorebooks.json",
            rawEntrySegments: ["raw", "lorebooks.json"],
          },
          {
            branchKind: "backup-file",
            sourceFileSegments: ["data", "lorebooks.json.bak"],
            sourceLocator: "data/lorebooks.json.bak",
            rawEntrySegments: ["raw", "lorebooks.json.bak"],
          },
        ],
        connectorProbes: expect.arrayContaining([
          {
            sourceFileSegments: ["data", "spotify-auth.json"],
            connectorKind: "spotify",
            credentialKind: "oauth-token-envelope",
          },
        ]),
        archiveDirectoryName: "source-archive",
      },
      rehearsal: {
        directoryName: "rehearsal-workspace",
        mapperVersion: "legacy-lore-v1",
      },
    });
  });
});
