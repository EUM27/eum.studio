import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseStartFocusCycleCommand,
  parseWorkActivityProjection,
} from "./work-activity-contract";

describe("work activity contract", () => {
  it("takes focus duration and phase from the command instead of a product constant", () => {
    const targetDurationMs = 37 * 60 * 1_000;
    expect(
      parseStartFocusCycleCommand({
        schemaVersion: 1,
        workId: randomUUID(),
        documentId: randomUUID(),
        phaseRef: "초고 다듬기",
        targetDurationMs,
        note: "",
      }),
    ).toMatchObject({ phaseRef: "초고 다듬기", targetDurationMs });
  });

  it("parses persisted writing and focus records for one Work", () => {
    const workId = randomUUID();
    const sessionId = randomUUID();
    const focusCycleId = randomUUID();
    const now = new Date().toISOString();
    const projection = parseWorkActivityProjection({
      schemaVersion: 1,
      workId,
      activeSessionId: sessionId,
      activeFocusCycleId: focusCycleId,
      sessions: [
        {
          schemaVersion: 1,
          sessionId,
          workId,
          documentId: randomUUID(),
          state: "active",
          startedAt: now,
          endedAt: null,
          activeDurationMs: 0,
          startRevisionId: randomUUID(),
          endRevisionId: null,
          characterDelta: null,
          note: "",
        },
      ],
      focusCycles: [
        {
          schemaVersion: 1,
          focusCycleId,
          workId,
          sessionId,
          state: "running",
          phaseRef: "집필",
          targetDurationMs: 60_000,
          startedAt: now,
          deadlineAt: new Date(Date.parse(now) + 60_000).toISOString(),
          remainingDurationMs: null,
          pauseReason: null,
          completedAt: null,
          note: "",
        },
      ],
    });

    expect(projection).toMatchObject({
      workId,
      activeSessionId: sessionId,
      activeFocusCycleId: focusCycleId,
    });
  });
});
