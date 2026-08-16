import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { WorkActivityProjection } from "./work-activity-contract";
import {
  parseExportWorkRecordsCommand,
  prepareWorkRecordsExport,
} from "./work-records-export";

const workId = entityId<"Work">("work-a");
const documentId = entityId<"Document">("document-a");

const activity: WorkActivityProjection = Object.freeze({
  schemaVersion: 1,
  workId,
  activeSessionId: null,
  activeFocusCycleId: null,
  sessions: Object.freeze([
    Object.freeze({
      schemaVersion: 1,
      sessionId: entityId<"WritingSession">("session-before"),
      workId,
      documentId,
      state: "completed",
      startedAt: "2026-08-08T10:00:00.000Z",
      endedAt: "2026-08-08T11:00:00.000Z",
      activeDurationMs: 3_600_000,
      startRevisionId: null,
      endRevisionId: null,
      characterDelta: 10,
      note: "제외",
    }),
    Object.freeze({
      schemaVersion: 1,
      sessionId: entityId<"WritingSession">("session-selected"),
      workId,
      documentId,
      state: "completed",
      startedAt: "2026-08-09T10:00:00.000Z",
      endedAt: "2026-08-09T11:30:00.000Z",
      activeDurationMs: 5_400_000,
      startRevisionId: null,
      endRevisionId: null,
      characterDelta: 120,
      note: "쉼표, 따옴표 \"와\"\n줄바꿈",
    }),
    Object.freeze({
      schemaVersion: 1,
      sessionId: entityId<"WritingSession">("session-after"),
      workId,
      documentId: null,
      state: "completed",
      startedAt: "2026-08-10T10:00:00.000Z",
      endedAt: "2026-08-10T11:00:00.000Z",
      activeDurationMs: 3_600_000,
      startRevisionId: null,
      endRevisionId: null,
      characterDelta: null,
      note: "제외",
    }),
  ]),
  focusCycles: Object.freeze([]),
});

describe("Work records export", () => {
  it("serializes only the explicit Work period as canonical JSON", () => {
    const command = parseExportWorkRecordsCommand({
      schemaVersion: 1,
      workId,
      format: "json",
      fromDate: "2026-08-09",
      toDate: "2026-08-09",
    });
    const prepared = prepareWorkRecordsExport({
      command,
      workTitle: "기록: 작품",
      documents: [{ documentId, title: "1화" }],
      activity,
      dateKey: (timestamp) => timestamp.slice(0, 10),
    });

    expect(prepared.suggestedFileName).toBe("기록 작품-records.json");
    expect(prepared.mediaType).toBe("application/json");
    const value = JSON.parse(prepared.text) as {
      work: { workId: string; title: string };
      period: { fromDate: string; toDate: string };
      sessions: Array<Record<string, unknown>>;
    };
    expect(value.work).toEqual({ workId, title: "기록: 작품" });
    expect(value.period).toEqual({
      fromDate: "2026-08-09",
      toDate: "2026-08-09",
    });
    expect(value.sessions).toHaveLength(1);
    expect(value.sessions[0]).toMatchObject({
      sessionId: "session-selected",
      documentId,
      documentTitle: "1화",
      activeDurationMs: 5_400_000,
      characterDelta: 120,
    });
    expect(prepared.text.endsWith("\n")).toBe(true);
  });

  it("escapes the same selected rows in canonical CSV and rejects cross-Work input", () => {
    const command = parseExportWorkRecordsCommand({
      schemaVersion: 1,
      workId,
      format: "csv",
      fromDate: "2026-08-09",
      toDate: "2026-08-09",
    });
    const prepared = prepareWorkRecordsExport({
      command,
      workTitle: "기록 작품",
      documents: [{ documentId, title: "1화" }],
      activity,
      dateKey: (timestamp) => timestamp.slice(0, 10),
    });

    expect(prepared.mediaType).toBe("text/csv");
    expect(prepared.text).toContain(
      "sessionId,documentId,documentTitle,state,startedAt,endedAt,activeDurationMs,characterDelta,note",
    );
    expect(prepared.text).toContain('"쉼표, 따옴표 ""와""\n줄바꿈"');
    expect(prepared.text).not.toContain("session-before");
    expect(prepared.text).not.toContain("session-after");
    expect(prepared.text.endsWith("\r\n")).toBe(true);

    expect(() =>
      prepareWorkRecordsExport({
        command: { ...command, workId: entityId<"Work">("work-b") },
        workTitle: "다른 작품",
        documents: [],
        activity,
        dateKey: (timestamp) => timestamp.slice(0, 10),
      }),
    ).toThrow(/outside Work/u);
  });
});
