import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { parseAssistantContextManifestProjection } from "../../src/application/continuity/assistant-context-manifest";
import { planAssistantContext, type ContextPlannerCandidate } from "../../src/application/continuity/context-planner";
import { entityId } from "../../src/domain/writing";
import fixture from "../fixtures/context-planner-performance-profile.json";

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))]!;
}

describe("Context Planner performance", () => {
  it("measures deterministic 1,000-candidate planning and manifest projection", async () => {
    const workId = entityId<"Work">("work-performance");
    const candidates: ContextPlannerCandidate[] = Array.from(
      { length: fixture.measurement.candidateCount },
      (_, index) => Object.freeze({
        workId,
        entity: Object.freeze({ kind: "character" as const, id: entityId<"Character">(`character-${String(index).padStart(4, "0")}`) }),
        entityRevision: 1 + (index % 5),
        policyMode: index < fixture.measurement.requiredCount
          ? "required" as const
          : index < fixture.measurement.requiredCount + fixture.measurement.withheldCount
            ? "withheld" as const
            : "relevant" as const,
        inclusionReason: index % 3 === 0 ? "current-scene" as const : "recent-change" as const,
        priority: index % 3 === 0 ? "direct" as const : "recent" as const,
        estimatedTokenCount: 1,
        userSelected: false,
        userSelectionAuthorized: false,
        currentSceneRelated: index % 3 === 0,
        exactSourceOverlap: index % 7 === 0,
        current: true,
        updatedAt: `2026-08-29T00:${String(index % 60).padStart(2, "0")}:00.000Z`,
      }),
    );
    const input = Object.freeze({
      schemaVersion: 1 as const,
      workId,
      capability: "canon.review" as const,
      sourceRange: null,
      sceneId: null,
      povCharacterId: null,
      userQuery: "",
      tokenBudget: fixture.measurement.tokenBudget,
    });
    const plannerMs: number[] = [];
    const manifestProjectionMs: number[] = [];
    let canonical = "";
    let selectedCount = 0;
    for (let iteration = 0; iteration < fixture.measurement.iterationCount; iteration += 1) {
      const ordered = iteration % 2 === 0 ? candidates : [...candidates].reverse();
      let started = performance.now();
      const plan = planAssistantContext(input, ordered);
      plannerMs.push(performance.now() - started);
      if (plan.status !== "planned") throw new Error("Expected planned context");
      selectedCount = plan.entries.length;
      const serialized = JSON.stringify(plan);
      if (canonical.length === 0) canonical = serialized;
      expect(serialized).toBe(canonical);
      started = performance.now();
      const manifest = parseAssistantContextManifestProjection({
        schemaVersion: 1,
        manifestId: `manifest-${iteration}`,
        receiptId: `receipt-${iteration}`,
        workId,
        entries: plan.entries,
        excluded: plan.excluded,
        estimatedTokenCount: plan.estimatedTokenCount,
        createdAt: "2026-08-29T00:00:00.000Z",
      });
      manifestProjectionMs.push(performance.now() - started);
      expect(manifest.entries).toHaveLength(plan.entries.length);
    }
    const report = {
      schemaVersion: 1,
      fixtureUse: fixture.fixtureUse,
      environment: { platform: process.platform, architecture: process.arch, node: process.version },
      rowCounts: {
        candidates: fixture.measurement.candidateCount,
        required: fixture.measurement.requiredCount,
        withheld: fixture.measurement.withheldCount,
        selected: selectedCount,
      },
      tokenBudget: fixture.measurement.tokenBudget,
      databaseBytes: { measured: false, growth: null, reason: "pure-application-harness" },
      timings: {
        plannerMs: { raw: plannerMs, p50: percentile(plannerMs, 0.5), p95: percentile(plannerMs, 0.95) },
        manifestProjectionMs: { raw: manifestProjectionMs, p50: percentile(manifestProjectionMs, 0.5), p95: percentile(manifestProjectionMs, 0.95) },
      },
      deterministicAcrossReverseOrder: true,
      rendererCommitCount: { measured: false, value: null, reason: "application-harness" },
    };
    const artifactPath = path.resolve("docs/verification/canon-continuity-gates-2-8/gate-4-context-performance.json");
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(JSON.parse(await readFile(artifactPath, "utf8"))).toEqual(report);
  });
});
