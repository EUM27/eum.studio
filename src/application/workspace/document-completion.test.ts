import { describe, expect, it } from "vitest";

import {
  deriveDocumentCompletionDate,
  parseClearDocumentCompletionCommand,
  parseCompleteDocumentCommand,
  parseDocumentCompletionOccurrence,
  parseDocumentCompletionProjection,
} from "./document-completion";

describe("Document completion contract", () => {
  it("parses an explicit completion command and a current completion projection", () => {
    expect(parseCompleteDocumentCommand({
      schemaVersion: 1,
      workId: "work-1",
      documentId: "document-1",
      expectedCompletionRevision: 0,
      expectedDocumentRevisionId: "revision-1",
    })).toMatchObject({
      expectedCompletionRevision: 0,
      expectedDocumentRevisionId: "revision-1",
    });

    expect(parseClearDocumentCompletionCommand({
      schemaVersion: 1,
      workId: "work-1",
      documentId: "document-1",
      expectedCompletionRevision: 1,
    })).toMatchObject({ expectedCompletionRevision: 1 });

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

  it("rejects impossible dates, non-IANA zones, and local timestamps", () => {
    expect(() => parseDocumentCompletionProjection({
      schemaVersion: 1,
      workId: "work-1",
      documentId: "document-1",
      revision: 1,
      completedAt: "2026-08-21T15:30:00.000Z",
      completedDate: "2026-02-31",
      completedTimeZone: "Asia/Seoul",
      completedDocumentRevisionId: "revision-1",
      state: "current",
      updatedAt: "2026-08-21T15:30:00.000Z",
    })).toThrow("real calendar date");

    expect(() => deriveDocumentCompletionDate(
      "2026-08-21T15:30:00.000Z",
      "Not/A_Time_Zone",
    )).toThrow("valid IANA time zone");

    expect(() => deriveDocumentCompletionDate(
      "2026-08-21T15:30:00",
      "Asia/Seoul",
    )).toThrow("absolute instant");
  });

  it("parses the current-versus-edited state on a completion occurrence", () => {
    expect(parseDocumentCompletionOccurrence({
      occurrenceId: "document-completion:document-1",
      workId: "work-1",
      documentId: "document-1",
      documentTitle: "1화",
      kind: "document-completion",
      label: "1화 완료",
      date: "2026-08-21",
      time: null,
      completed: true,
      completedAt: "2026-08-21T15:30:00.000Z",
      completedDocumentRevisionId: "revision-1",
      state: "edited-after-completion",
    })).toMatchObject({ state: "edited-after-completion" });
  });
});
