import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  entityId,
} from "../../domain/writing";
import type {
  StartupRecoveryCandidate,
  StartupRecoveryState,
} from "./prepare-startup-recovery";
import {
  assertApplyStartupRecoveryMatchesCandidate,
  createApplyStartupRecoveryCommand,
  parseApplyStartupRecoveryCommand,
  parseApplyStartupRecoveryAcknowledgement,
  parseStartupRecoveryProjection,
  projectStartupRecovery,
} from "./startup-recovery-contract";

function createCandidate(): StartupRecoveryCandidate {
  const safeReplayThroughByteOffset =
    randomInt(1, 1_024);
  const sourceJournalEndByteOffset =
    safeReplayThroughByteOffset +
    randomInt(0, 1_024);
  const checksumVerifiedPrefixByteLength =
    safeReplayThroughByteOffset +
    randomInt(
      0,
      sourceJournalEndByteOffset -
        safeReplayThroughByteOffset +
        1,
    );
  const documentId =
    entityId<"Document">(randomUUID());
  return {
    sourceJournalEndByteOffset,
    checksumVerifiedPrefixByteLength,
    safeReplayThroughByteOffset,
    affectedDocuments: [
      {
        workId: entityId<"Work">(randomUUID()),
        documentId,
        baseRevisionId:
          entityId<"DocumentRevision">(
            randomUUID(),
          ),
        recoveredText: randomUUID(),
        nextSequence: randomInt(0, 10_000),
      },
    ],
    appliedBatchIds: [
      entityId<"ChangeBatch">(randomUUID()),
    ],
    duplicateBatchIds: [
      entityId<"ChangeBatch">(randomUUID()),
    ],
    safePayloads: [
      crypto.getRandomValues(
        new Uint8Array(randomInt(1, 64)),
      ),
    ],
    issues: [
      {
        source: "journal-frame-tail",
        byteOffset:
          checksumVerifiedPrefixByteLength,
        byteLength:
          sourceJournalEndByteOffset -
          checksumVerifiedPrefixByteLength,
        reason: randomUUID(),
      },
    ],
  };
}

function firstAffectedDocument(
  candidate: StartupRecoveryCandidate,
) {
  const document = candidate.affectedDocuments[0];
  if (document === undefined) {
    throw new Error(
      "Expected an affected recovery document",
    );
  }
  return document;
}

describe("startup recovery contract", () => {
  it("projects an exact pending preview without raw payload or physical storage data", () => {
    const candidate = createCandidate();
    const state: StartupRecoveryState = {
      status: "recovery-pending",
      candidate,
      issues: candidate.issues,
    };
    const applyAvailable = Math.random() >= 0.5;

    const result = projectStartupRecovery(
      state,
      applyAvailable,
    );

    expect(result).toEqual({
      schemaVersion: 1,
      status: "recovery-pending",
      applyAvailable,
      candidate: {
        sourceJournalEndByteOffset:
          candidate.sourceJournalEndByteOffset,
        checksumVerifiedPrefixByteLength:
          candidate.checksumVerifiedPrefixByteLength,
        safeReplayThroughByteOffset:
          candidate.safeReplayThroughByteOffset,
        affectedDocuments:
          candidate.affectedDocuments,
        appliedBatchIds: candidate.appliedBatchIds,
        duplicateBatchIds:
          candidate.duplicateBatchIds,
        issues: candidate.issues,
      },
      issues: candidate.issues,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("safePayloads");
    expect(serialized).not.toContain("journalPath");
    expect(serialized).not.toContain("contentPath");
    expect(serialized).not.toContain(
      "checksumAlgorithm",
    );
  });

  it("strictly parses a projected pending recovery response and rejects hidden payload fields", () => {
    const candidate = createCandidate();
    const projection = projectStartupRecovery(
      {
        status: "recovery-pending",
        candidate,
        issues: candidate.issues,
      },
      true,
    );

    expect(
      parseStartupRecoveryProjection(projection),
    ).toEqual(projection);
    if (projection.status !== "recovery-pending") {
      throw new Error(
        "Expected a pending projection",
      );
    }
    expect(() =>
      parseStartupRecoveryProjection({
        ...projection,
        candidate: {
          ...projection.candidate,
          safePayloads: candidate.safePayloads,
        },
      }),
    ).toThrow(/Unsupported/);
  });

  it.each(["clean", "read-only-error"] as const)(
    "strictly parses a %s recovery projection",
    (status) => {
      const issue = {
        source: "compaction-publication" as const,
        reason: randomUUID(),
      };
      const projection =
        status === "clean"
          ? {
              schemaVersion: 1,
              status,
              issues: [],
            }
          : {
              schemaVersion: 1,
              status,
              issues: [issue],
            };

      expect(
        parseStartupRecoveryProjection(projection),
      ).toEqual(projection);
    },
  );

  it("strictly parses a journal read issue without exposing a physical path", () => {
    const projection = {
      schemaVersion: 1,
      status: "read-only-error",
      issues: [
        {
          source: "journal-read",
          reason: randomUUID(),
        },
      ],
    } as const;

    expect(
      parseStartupRecoveryProjection(projection),
    ).toEqual(projection);
    expect(JSON.stringify(projection)).not.toContain(
      "journalPath",
    );
  });

  it("strictly parses an exact recovery apply acknowledgement", () => {
    const acknowledgement = {
      schemaVersion: 1,
      status: "applied",
      compactionId: randomUUID(),
      consumedThroughByteOffset: randomInt(
        0,
        10_000,
      ),
      reclamation:
        Math.random() >= 0.5
          ? ("completed" as const)
          : ("pending" as const),
    };

    expect(
      parseApplyStartupRecoveryAcknowledgement(
        acknowledgement,
      ),
    ).toEqual(acknowledgement);
    expect(() =>
      parseApplyStartupRecoveryAcknowledgement({
        ...acknowledgement,
        reclamation: randomUUID(),
      }),
    ).toThrow(/reclamation/);
  });

  it.each([
    {
      state: {
        status: "clean",
        issues: [],
      } satisfies StartupRecoveryState,
      expected: {
        schemaVersion: 1,
        status: "clean",
        issues: [],
      },
    },
    {
      state: {
        status: "read-only-error",
        issues: [
          {
            source: "journal-frame-tail",
            byteOffset: 0,
            byteLength: randomInt(1, 64),
            reason: randomUUID(),
          },
        ],
      } satisfies StartupRecoveryState,
      expected: null,
    },
  ])(
    "projects $state.status without inventing an apply candidate",
    ({ state, expected }) => {
      const result = projectStartupRecovery(
        state,
        false,
      );

      expect(result).toEqual(
        expected ?? {
          schemaVersion: 1,
          status: "read-only-error",
          issues: state.issues,
        },
      );
      expect("candidate" in result).toBe(false);
      expect("applyAvailable" in result).toBe(false);
    },
  );

  it("creates and strictly parses the exact current candidate approval tuple", () => {
    const candidate = createCandidate();
    const document =
      firstAffectedDocument(candidate);

    const command =
      createApplyStartupRecoveryCommand(candidate);
    const parsed =
      parseApplyStartupRecoveryCommand(command);

    expect(parsed).toEqual({
      schemaVersion: 1,
      expectedSourceJournalEndByteOffset:
        candidate.sourceJournalEndByteOffset,
      expectedSafeReplayThroughByteOffset:
        candidate.safeReplayThroughByteOffset,
      documents: [
        {
          workId: document.workId,
          documentId: document.documentId,
          expectedBaseRevisionId:
            document.baseRevisionId,
          expectedNextSequence:
            document.nextSequence,
        },
      ],
    });
    expect(
      assertApplyStartupRecoveryMatchesCandidate(
        parsed,
        candidate,
      ),
    ).toBeUndefined();
  });

  it.each([
    "expectedSourceJournalEndByteOffset",
    "expectedSafeReplayThroughByteOffset",
    "documents",
  ])("rejects a missing command %s", (field) => {
    const command = {
      ...createApplyStartupRecoveryCommand(
        createCandidate(),
      ),
    };
    Reflect.deleteProperty(command, field);

    expect(() =>
      parseApplyStartupRecoveryCommand(command),
    ).toThrow(field);
  });

  it("rejects unsupported command and document fields", () => {
    const command =
      createApplyStartupRecoveryCommand(
        createCandidate(),
      );
    const document = command.documents[0];
    if (document === undefined) {
      throw new Error("Expected an approval document");
    }

    expect(() =>
      parseApplyStartupRecoveryCommand({
        ...command,
        [randomUUID()]: randomUUID(),
      }),
    ).toThrow(/Unsupported/);
    expect(() =>
      parseApplyStartupRecoveryCommand({
        ...command,
        documents: [
          {
            ...document,
            [randomUUID()]: randomUUID(),
          },
        ],
      }),
    ).toThrow(/Unsupported/);
  });

  it.each([
    "source-boundary",
    "safe-boundary",
    "work",
    "document",
    "base-revision",
    "next-sequence",
  ])(
    "rejects an approval whose %s differs from the current candidate",
    (difference) => {
      const candidate = createCandidate();
      const command =
        createApplyStartupRecoveryCommand(candidate);
      const document = command.documents[0];
      if (document === undefined) {
        throw new Error(
          "Expected an approval document",
        );
      }
      const changedDocument = {
        ...document,
        ...(difference === "work"
          ? { workId: randomUUID() }
          : {}),
        ...(difference === "document"
          ? { documentId: randomUUID() }
          : {}),
        ...(difference === "base-revision"
          ? { expectedBaseRevisionId: randomUUID() }
          : {}),
        ...(difference === "next-sequence"
          ? {
              expectedNextSequence:
                document.expectedNextSequence + 1,
            }
          : {}),
      };
      const changed = {
        ...command,
        ...(difference === "source-boundary"
          ? {
              expectedSourceJournalEndByteOffset:
                command
                  .expectedSourceJournalEndByteOffset +
                1,
            }
          : {}),
        ...(difference === "safe-boundary"
          ? {
              expectedSafeReplayThroughByteOffset:
                command
                  .expectedSafeReplayThroughByteOffset -
                1,
            }
          : {}),
        documents: [changedDocument],
      };

      expect(() =>
        assertApplyStartupRecoveryMatchesCandidate(
          parseApplyStartupRecoveryCommand(changed),
          candidate,
        ),
      ).toThrow(/candidate/i);
    },
  );
});
