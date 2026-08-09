import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseLocalWorkspaceBackupProfile } from "./local-workspace-backup-profile";

describe("local workspace backup profile", () => {
  it("parses the checked-in backup format and layout", () => {
    const profile = parseLocalWorkspaceBackupProfile(
      JSON.parse(
        readFileSync(
          path.join(process.cwd(), "config", "local-workspace-backup.json"),
          "utf8",
        ),
      ),
    );

    expect(profile).toMatchObject({
      schemaVersion: 1,
      checksum: { identity: "eum-studio-ledger-sha256-v1" },
      sqlite: { sourceDatabaseName: "main", targetDatabaseName: "main" },
      restoreLayout: {
        databaseEntrySegments: ["workspace.sqlite3"],
      },
    });
  });
});
