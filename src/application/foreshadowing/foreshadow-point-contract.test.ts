import { describe, expect, it } from "vitest";

import {
  deriveForeshadowLineResolution,
  parseCreateForeshadowPointCommand,
  parseForeshadowPointListProjection,
  parseForeshadowPointProfile,
  parseForeshadowPointProjection,
} from "./foreshadow-point-contract";

describe("foreshadow point contract", () => {
  it("parses data-driven roles and derives payoff from the configured role", () => {
    const profile = parseForeshadowPointProfile({
      schemaVersion: 1,
      defaultRoleId: "seed",
      payoffRoleId: "answer",
      roles: [
        { id: "seed", label: "씨앗" },
        { id: "echo", label: "메아리" },
        { id: "answer", label: "응답" },
      ],
    });
    expect(profile.roles.map((role) => role.label)).toEqual([
      "씨앗",
      "메아리",
      "응답",
    ]);
    expect(deriveForeshadowLineResolution({
      points: [{ roleId: "seed" }, { roleId: "echo" }],
      payoffRoleId: profile.payoffRoleId,
    })).toBe("unresolved");
    expect(deriveForeshadowLineResolution({
      points: [{ roleId: "answer" }],
      payoffRoleId: profile.payoffRoleId,
    })).toBe("resolved");
  });

  it("preserves the exact directional selection and selected text", () => {
    expect(parseCreateForeshadowPointCommand({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      documentId: "document-a",
      selection: { anchor: 14, head: 3 },
      exactText: "  그대로\n",
      roleId: "plant",
      note: "첫 단서",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      documentId: "document-a",
      selection: { anchor: 14, head: 3 },
      exactText: "  그대로\n",
      roleId: "plant",
      note: "첫 단서",
    });
  });

  it("rejects empty selections and stored payoff state", () => {
    expect(() => parseCreateForeshadowPointCommand({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      documentId: "document-a",
      selection: { anchor: 3, head: 3 },
      exactText: "본문",
      roleId: "plant",
      note: "",
    })).toThrow("selection must not be empty");
    expect(() => parseCreateForeshadowPointCommand({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      documentId: "document-a",
      selection: { anchor: 5, head: 3 },
      exactText: "본문",
      roleId: "payoff",
      note: "",
      resolution: "resolved",
    })).toThrow("Unsupported CreateForeshadowPointCommand field: resolution");
  });

  it("requires ranges only for resolved source Anchors", () => {
    const base = {
      schemaVersion: 1,
      pointId: "point-a",
      revision: 1,
      workId: "work-a",
      lineId: "line-a",
      sourceDocumentId: "document-a",
      sourceDocumentRevisionId: "revision-a",
      sourceAnchorId: "anchor-a",
      roleId: "plant",
      note: "",
      exactText: "정확한 원문",
      createdAt: "2026-08-10T00:00:00.000Z",
    };
    expect(parseForeshadowPointProjection({
      ...base,
      integrity: "resolved",
      range: { from: 3, to: 9 },
    }).range).toEqual({ from: 3, to: 9 });
    expect(parseForeshadowPointProjection({
      ...base,
      integrity: "needsReview",
      range: null,
    }).integrity).toBe("needsReview");
    expect(() => parseForeshadowPointProjection({
      ...base,
      integrity: "broken",
      range: { from: 3, to: 9 },
    })).toThrow("range must be null when unresolved");
  });

  it("rejects a point list containing another Work", () => {
    expect(() => parseForeshadowPointListProjection({
      schemaVersion: 1,
      workId: "work-a",
      points: [{
        schemaVersion: 1,
        pointId: "point-b",
        revision: 1,
        workId: "work-b",
        lineId: "line-b",
        sourceDocumentId: "document-b",
        sourceDocumentRevisionId: "revision-b",
        sourceAnchorId: "anchor-b",
        roleId: "plant",
        note: "",
        exactText: "다른 작품",
        integrity: "resolved",
        range: { from: 0, to: 5 },
        createdAt: "2026-08-10T00:00:00.000Z",
      }],
    })).toThrow("outside Work work-a");
  });
});
