import { describe, expect, it } from "vitest";

import { planAssistantContext, type ContextPlannerCandidate } from "./context-planner";

const candidate = (input: Partial<ContextPlannerCandidate> & Pick<ContextPlannerCandidate, "entity">): ContextPlannerCandidate => ({
  workId: "work-1" as never,
  entityRevision: 1,
  policyMode: "relevant",
  inclusionReason: "recent-change",
  priority: "recent",
  estimatedTokenCount: 2,
  userSelected: false,
  userSelectionAuthorized: false,
  currentSceneRelated: false,
  exactSourceOverlap: false,
  current: true,
  updatedAt: "2026-08-29T00:00:00.000Z",
  ...input,
});

const planInput = {
  schemaVersion: 1 as const,
  workId: "work-1" as never,
  capability: "canon.review" as const,
  sourceRange: null,
  sceneId: null,
  povCharacterId: null,
  userQuery: "",
  tokenBudget: 10,
};

describe("planAssistantContext", () => {
  it("is deterministic across input order and follows explicit tie-breakers", () => {
    const candidates = [
      candidate({ entity: { kind: "lore-entry", id: "lore-z" as never }, currentSceneRelated: true, priority: "direct", inclusionReason: "current-scene" }),
      candidate({ entity: { kind: "character", id: "character-b" as never }, userSelected: true, userSelectionAuthorized: true, priority: "direct", inclusionReason: "user-selected" }),
      candidate({ entity: { kind: "character", id: "character-a" as never }, policyMode: "required", priority: "supporting", inclusionReason: "recent-change" }),
      candidate({ entity: { kind: "continuity-thread", id: "thread-a" as never }, priority: "continuity", inclusionReason: "open-continuity" }),
    ];
    const first = planAssistantContext(planInput, candidates);
    const second = planAssistantContext(planInput, [...candidates].reverse());
    expect(first).toEqual(second);
    if (first.status !== "planned") throw new Error("Expected planned context");
    expect(first.entries.map((entry) => entry.kind === "entity" ? `${entry.entity.kind}:${entry.entity.id}` : entry.digestId)).toEqual([
      "character:character-a",
      "character:character-b",
      "lore-entry:lore-z",
      "continuity-thread:thread-a",
    ]);
    expect(first.entries[0]).toMatchObject({ inclusionReason: "required-policy" });
  });

  it("excludes withheld, outside-Work, stale-derived, and duplicate candidates", () => {
    const entity = { kind: "lore-entry" as const, id: "lore-1" as never };
    const result = planAssistantContext(planInput, [
      candidate({ entity, policyMode: "withheld", inclusionReason: "direct-relation", priority: "direct" }),
      candidate({ entity: { kind: "character", id: "outside" as never }, workId: "work-2" as never }),
      candidate({ entity: { kind: "character-knowledge", id: "stale" as never }, current: false, inclusionReason: "pov-knowledge" }),
      candidate({ entity: { kind: "character", id: "duplicate" as never }, userSelected: true, userSelectionAuthorized: true, inclusionReason: "user-selected", priority: "direct" }),
      candidate({ entity: { kind: "character", id: "duplicate" as never }, inclusionReason: "recent-change", priority: "recent" }),
    ]);
    if (result.status !== "planned") throw new Error("Expected planned context");
    expect(result.entries).toHaveLength(1);
    expect(result.excluded.map((entry) => entry.reason)).toEqual(expect.arrayContaining([
      "withheld-policy", "outside-work", "stale-derived", "duplicate",
    ]));
  });

  it("allows an explicitly authorized user selection to override withheld for one plan", () => {
    const result = planAssistantContext(planInput, [candidate({
      entity: { kind: "lore-entry", id: "lore-1" as never },
      policyMode: "withheld",
      userSelected: true,
      userSelectionAuthorized: true,
      inclusionReason: "user-selected",
      priority: "direct",
    })]);
    expect(result).toMatchObject({ status: "planned", entries: [{ inclusionReason: "user-selected" }] });
  });

  it("returns an explicit failure when required context exceeds budget", () => {
    const result = planAssistantContext({ ...planInput, tokenBudget: 3 }, [
      candidate({ entity: { kind: "character", id: "a" as never }, policyMode: "required", estimatedTokenCount: 2 }),
      candidate({ entity: { kind: "lore-entry", id: "b" as never }, policyMode: "required", estimatedTokenCount: 2 }),
    ]);
    expect(result).toMatchObject({
      status: "required-context-over-budget",
      tokenBudget: 3,
      requiredTokenCount: 4,
    });
  });

  it("never truncates an entity and can include a later whole candidate that fits", () => {
    const result = planAssistantContext({ ...planInput, tokenBudget: 3 }, [
      candidate({ entity: { kind: "character", id: "large" as never }, priority: "direct", estimatedTokenCount: 4 }),
      candidate({ entity: { kind: "lore-entry", id: "small" as never }, priority: "recent", estimatedTokenCount: 2 }),
    ]);
    if (result.status !== "planned") throw new Error("Expected planned context");
    expect(result.entries).toMatchObject([{ entity: { id: "small" } }]);
    expect(result.excluded).toMatchObject([{ entity: { id: "large" }, reason: "over-budget" }]);
  });
});
