import { describe, expect, it } from "vitest";

import {
  parseContinuityOverviewProjection,
  parseContinuityThreadProjection,
  parseCreateContinuityThreadCommand,
  parseDismissContinuityThreadCommand,
  parseListContinuityThreadsCommand,
  parseResolveContinuityThreadCommand,
  parseUpdateContinuityThreadCommand,
} from "./continuity-thread-contract";

const range = Object.freeze({
  documentId: "document-1",
  documentRevisionId: "revision-1",
  from: 4,
  to: 12,
});

const evidence = Object.freeze({
  anchorId: "anchor-1",
  documentId: range.documentId,
  documentRevisionId: range.documentRevisionId,
  exactText: "약속을 지켰다",
  integrity: "resolved",
  range: { from: range.from, to: range.to },
});

const thread = Object.freeze({
  schemaVersion: 1,
  threadId: "thread-1",
  revision: 2,
  workId: "work-1",
  kind: "promise",
  title: "북문에서 다시 만나기",
  note: "다음 회차에서 확인",
  subjectRefs: [{ kind: "character", id: "character-1" }],
  status: "resolved",
  openedEvidence: [evidence],
  resolutionEvidence: [{ ...evidence, anchorId: "anchor-2" }],
  history: [{
    transitionId: "transition-1",
    threadId: "thread-1",
    kind: "resolved",
    revisionBefore: 1,
    revisionAfter: 2,
    resolutionMode: "evidence",
    reason: "원문에서 해결됨",
    evidenceAnchorIds: ["anchor-2"],
    createdAt: "2026-08-29T02:00:00.000Z",
  }],
  openedAt: "2026-08-29T01:00:00.000Z",
  resolvedAt: "2026-08-29T02:00:00.000Z",
  updatedAt: "2026-08-29T02:00:00.000Z",
});

describe("Continuity thread contract", () => {
  it("parses strict manual create, update, list, resolve, and dismiss commands", () => {
    expect(parseCreateContinuityThreadCommand({
      schemaVersion: 1,
      workId: "work-1",
      kind: "promise",
      title: "북문에서 다시 만나기",
      note: "다음 회차에서 확인",
      subjectRefs: [{ kind: "character", id: "character-1" }],
      openedEvidenceRange: range,
    })).toMatchObject({ kind: "promise", openedEvidenceRange: range });
    expect(parseUpdateContinuityThreadCommand({
      schemaVersion: 1,
      workId: "work-1",
      threadId: "thread-1",
      expectedRevision: 1,
      kind: "open-question",
      title: "누가 문을 열었는가",
      note: "답을 확인",
      subjectRefs: [],
    })).toMatchObject({ expectedRevision: 1, kind: "open-question" });
    expect(parseListContinuityThreadsCommand({
      schemaVersion: 1,
      workId: "work-1",
      status: "open",
    }).status).toBe("open");
    expect(parseResolveContinuityThreadCommand({
      schemaVersion: 1,
      workId: "work-1",
      threadId: "thread-1",
      expectedRevision: 1,
      resolutionMode: "evidence",
      resolutionEvidenceRange: range,
      reason: "원문에서 해결됨",
    }).resolutionMode).toBe("evidence");
    expect(parseDismissContinuityThreadCommand({
      schemaVersion: 1,
      workId: "work-1",
      threadId: "thread-1",
      expectedRevision: 1,
      reason: "작가 판단으로 추적 종료",
    }).reason).toContain("추적 종료");
  });

  it("requires resolution evidence only for evidence mode and rejects duplicate subjects", () => {
    expect(() => parseResolveContinuityThreadCommand({
      schemaVersion: 1,
      workId: "work-1",
      threadId: "thread-1",
      expectedRevision: 1,
      resolutionMode: "evidence",
      resolutionEvidenceRange: null,
      reason: "해결",
    })).toThrow(/evidence mode/u);
    expect(() => parseResolveContinuityThreadCommand({
      schemaVersion: 1,
      workId: "work-1",
      threadId: "thread-1",
      expectedRevision: 1,
      resolutionMode: "manual",
      resolutionEvidenceRange: range,
      reason: "직접 종료",
    })).toThrow(/manual mode/u);
    expect(() => parseCreateContinuityThreadCommand({
      schemaVersion: 1,
      workId: "work-1",
      kind: "promise",
      title: "중복",
      note: "",
      subjectRefs: [
        { kind: "character", id: "character-1" },
        { kind: "character", id: "character-1" },
      ],
      openedEvidenceRange: null,
    })).toThrow(/duplicate/u);
  });

  it("parses immutable evidence and transition history with status invariants", () => {
    expect(parseContinuityThreadProjection(thread)).toEqual(thread);
    expect(() => parseContinuityThreadProjection({
      ...thread,
      status: "open",
    })).toThrow(/resolvedAt/u);
    expect(() => parseContinuityThreadProjection({
      ...thread,
      history: [{ ...thread.history[0], threadId: "thread-2" }],
    })).toThrow(/another thread/u);
  });

  it("keeps continuity, Plot, Foreshadow, and Character goal sources as projections", () => {
    const overview = parseContinuityOverviewProjection({
      schemaVersion: 1,
      workId: "work-1",
      threads: [thread],
      projectedSources: [
        {
          sourceKind: "plot-thread",
          entity: { kind: "plot-thread", id: "plot-1" },
          revision: 3,
          title: "성문 진입",
          note: "예정 전개",
          active: true,
        },
        {
          sourceKind: "foreshadow-line",
          entity: { kind: "foreshadow-line", id: "foreshadow-1" },
          revision: 2,
          title: "낡은 열쇠",
          note: "회수 대기",
          active: true,
        },
        {
          sourceKind: "character-goal",
          entity: { kind: "character", id: "character-1" },
          revision: 4,
          title: "윤서의 목표",
          note: "기록을 되찾는다",
          active: true,
        },
      ],
    });

    expect(overview.threads).toHaveLength(1);
    expect(overview.projectedSources.map((entry) => entry.sourceKind)).toEqual([
      "plot-thread",
      "foreshadow-line",
      "character-goal",
    ]);
  });
});

