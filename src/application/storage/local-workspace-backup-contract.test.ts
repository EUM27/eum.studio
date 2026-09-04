import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseLocalWorkspaceBackupActionResult,
  parseLocalWorkspaceBackupStatusProjection,
} from "./local-workspace-backup-contract";

describe("local workspace backup contract", () => {
  it("parses a persisted verified backup and a completed action", () => {
    const summary = {
      schemaVersion: 1,
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
  });
});
