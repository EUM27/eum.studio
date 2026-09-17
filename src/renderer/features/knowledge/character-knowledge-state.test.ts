import { describe, expect, it } from "vitest";

import { filterCharacterKnowledge } from "./character-knowledge-state";

const entry = (input: Readonly<{ id: string; characterId: string; stance: string; truth: string; status: string; statement: string }>) => ({
  schemaVersion: 1, knowledgeId: input.id, revision: 1, workId: "work-1",
  characterId: input.characterId, statement: input.statement, stance: input.stance,
  truthStatus: input.truth, aboutRefs: [], evidence: [], status: input.status,
  supersedesKnowledgeId: null,
  supersededByKnowledgeId: input.status === "superseded" ? "next" : null,
  createdAt: "2026-08-29T00:00:00.000Z", updatedAt: "2026-08-29T00:00:00.000Z",
}) as never;

describe("filterCharacterKnowledge", () => {
  it("combines current/history, Character, stance, truth, and query filters", () => {
    const entries = [
      entry({ id: "a", characterId: "c1", stance: "believes", truth: "false", status: "active", statement: "북문은 안전하다" }),
      entry({ id: "b", characterId: "c1", stance: "knows", truth: "true", status: "superseded", statement: "열쇠는 북문을 연다" }),
      entry({ id: "c", characterId: "c2", stance: "knows", truth: "true", status: "active", statement: "남문은 잠겼다" }),
    ];
    expect(filterCharacterKnowledge(entries, {
      status: "current", characterId: "c1", stance: "believes",
      truthStatus: "false", query: "안전",
    }).map((value) => value.knowledgeId)).toEqual(["a"]);
    expect(filterCharacterKnowledge(entries, {
      status: "history", characterId: null, stance: "all",
      truthStatus: "all", query: "",
    }).map((value) => value.knowledgeId)).toEqual(["b"]);
  });
});
