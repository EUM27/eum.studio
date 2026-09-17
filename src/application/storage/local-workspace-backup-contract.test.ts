import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseCreateLocalWorkspaceBackupCommand,
  parseLocalWorkspaceBackupSummary,
  parseLocalWorkspaceBackupActionResult,
  parseLocalWorkspaceBackupStatusProjection,
} from "./local-workspace-backup-contract";

describe("local workspace backup contract", () => {
  it("accepts only explicit supported backup scopes", () => {
    expect(parseCreateLocalWorkspaceBackupCommand(undefined).mode).toBe("complete");
    expect(parseCreateLocalWorkspaceBackupCommand({ schemaVersion: 1, mode: "manuscript-only" }).mode).toBe("manuscript-only");
    for (const value of [null, {}, { schemaVersion: 1, mode: "automatic" }, { schemaVersion: 1, mode: "manuscript-only", extra: true }]) {
      expect(() => parseCreateLocalWorkspaceBackupCommand(value)).toThrow();
    }
  });
  it("parses a persisted verified backup and a completed action", () => {
    const summary = {
      schemaVersion: 1,
      mode: "complete",
      bundlePath: `C:\\${randomUUID()}`,
      targetPath: null,
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      lastAction: "created",
      counts: {
        workCount: 1,
        documentCount: 2,
        revisionCount: 3,
        resumeCheckpointCount: 1,
        writingSessionCount: 4,
      },
      media: {
        managedFileCount: 2,
        externalReferenceCount: 1,
        disconnectedExternalReferenceCount: 1,
        managedByteLength: 4096,
      },
    } as const;

    expect(
      parseLocalWorkspaceBackupStatusProjection({
        schemaVersion: 1,
        lastVerified: summary,
      }).lastVerified,
    ).toEqual(summary);
    expect(
      parseLocalWorkspaceBackupActionResult({
        schemaVersion: 1,
        status: "completed",
        summary,
      }),
    ).toEqual({ schemaVersion: 1, status: "completed", summary });

    const legacySummary: Record<string, unknown> = { ...summary };
    delete legacySummary.media;
    delete legacySummary.mode;
    expect(
      parseLocalWorkspaceBackupStatusProjection({
        schemaVersion: 1,
        lastVerified: legacySummary,
      }).lastVerified?.media,
    ).toEqual({
      managedFileCount: 0,
      externalReferenceCount: 0,
      disconnectedExternalReferenceCount: 0,
      managedByteLength: 0,
    });
    expect(parseLocalWorkspaceBackupSummary(legacySummary).mode).toBe("legacy");
    expect(() => parseLocalWorkspaceBackupSummary({ ...summary, mode: null })).toThrow();
    expect(() => parseLocalWorkspaceBackupSummary({ ...summary, mode: "manuscript-only" })).toThrow("cannot claim included media");
  });
});
