import { describe, expect, it } from "vitest";

import {
  deriveDocumentCompletionDate,
  parseDocumentCompletionProjection,
  parseSetDocumentCompletionCommand,
} from "./document-completion";

describe("Document completion contract", () => {
  it("parses an explicit completion command and a current completion projection", () => {
    expect(parseSetDocumentCompletionCommand({
      schemaVersion: 1,
      workId: "work-1",
      documentId: "document-1",
      expectedCompletionRevision: 0,
      expectedDocumentRevisionId: "revision-1",
      completed: true,
    })).toMatchObject({
      expectedCompletionRevision: 0,
      expectedDocumentRevisionId: "revision-1",
      completed: true,
    });

    expect(parseDocumentCompletionProjection({
      schemaVersion: 1,
      workId: "work-1",
      documentId: "document-1",
      revision: 1,
      completedAt: "2026-08-21T15:30:00.000Z",
      completedDate: "2026-08-22",
      completedTimeZone: "Asia/Seoul",
      completedDocumentRevisionId: "revision-1",
      state: "current",
      updatedAt: "2026-08-21T15:30:00.000Z",
    })).toMatchObject({
      revision: 1,
      completedDate: "2026-08-22",
      state: "current",
    });
  });

  it("parses the absent-row incomplete projection", () => {
    expect(parseDocumentCompletionProjection({
      schemaVersion: 1,
      workId: "work-1",
      documentId: "document-1",
      revision: 0,
      completedAt: null,
      completedDate: null,
      completedTimeZone: null,
      completedDocumentRevisionId: null,
      state: "incomplete",
      updatedAt: null,
    })).toMatchObject({ revision: 0, state: "incomplete" });
  });

  it("derives the completion calendar date in the Work runtime time zone", () => {
    const completedAt = "2026-08-21T15:30:00.000Z";
    expect(deriveDocumentCompletionDate(completedAt, "Asia/Seoul")).toBe(
      "2026-08-22",
    );
    expect(
      deriveDocumentCompletionDate(completedAt, "America/Los_Angeles"),
    ).toBe("2026-08-21");
    expect(
      deriveDocumentCompletionDate(
        "2026-01-31T15:30:00.000Z",
        "Asia/Seoul",
      ),
    ).toBe("2026-02-01");
    expect(
      deriveDocumentCompletionDate(
        "2026-12-31T15:30:00.000Z",
        "Asia/Seoul",
      ),
    ).toBe("2027-01-01");
    expect(
      deriveDocumentCompletionDate(
        "2026-03-08T04:30:00.000Z",
        "America/New_York",
      ),
    ).toBe("2026-03-07");
    expect(
      deriveDocumentCompletionDate(
        "2026-03-08T07:30:00.000Z",
        "America/New_York",
      ),
    ).toBe("2026-03-08");

    const stored = parseDocumentCompletionProjection({
      schemaVersion: 1,
      workId: "work-1",
      documentId: "document-1",
      revision: 1,
      completedAt,
      completedDate: "2026-08-22",
      completedTimeZone: "Asia/Seoul",
      completedDocumentRevisionId: "revision-1",
      state: "current",
      updatedAt: completedAt,
    });
    expect(stored.completedDate).toBe("2026-08-22");
  });
});
