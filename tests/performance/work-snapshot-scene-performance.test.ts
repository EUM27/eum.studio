import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  deriveWorkSnapshotSlots,
  parseWorkSnapshotSceneSelectionPlan,
} from "../../src/application/revisions/work-snapshot-scene-plan";
import type { WorkSnapshotProjection } from "../../src/application/revisions/work-version-contract";
import { entityId } from "../../src/domain/writing";
import fixture from "../fixtures/work-snapshot-scene-performance-profile.json";

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))
  ]!;
}

describe("WorkSnapshot Scene comparison performance", () => {
  it("measures named-slot projection and a large read-only Scene selection plan", async () => {
    const snapshots: WorkSnapshotProjection[] = Array.from(
      { length: fixture.measurement.slotCount * fixture.measurement.snapshotsPerSlot },
      (_, index) => {
        const slotIndex = Math.floor(index / fixture.measurement.snapshotsPerSlot);
        const historyIndex = index % fixture.measurement.snapshotsPerSlot;
        return {
          schemaVersion: 1,
          workSnapshotId: entityId<"WorkSnapshot">(`snapshot-${String(index).padStart(4, "0")}`),
          workId: entityId<"Work">("work-performance"),
          label: `slot-${String(slotIndex).padStart(3, "0")}`,
          cause: `measurement-${historyIndex}`,
          manifestHash: `manifest-${String(index).padStart(4, "0")}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
          documentRevisions: [],
        };
      },
    );
    const planInput = {
      schemaVersion: 1,
      workId: "work-performance",
      workSnapshotId: "snapshot-0999",
      slotName: "slot-099",
      mode: "read-only-selection-plan",
      automaticMergeAllowed: false,
      canApply: false,
      applyCommand: null,
      snapshotSceneMetadataAvailable: true,
      scenes: Array.from({ length: fixture.measurement.sceneCount }, (_, index) => ({
        sceneId: `scene-${String(index).padStart(4, "0")}`,
        status: index % 3 === 0 ? "changed" : "unchanged",
        selected: index % 5 === 0,
        snapshotSegments: [
          {
            documentId: `document-${String(index % 50).padStart(3, "0")}`,
            documentRevisionId: `snapshot-revision-${String(index).padStart(4, "0")}`,
            documentTitle: `회차 ${index % 50}`,
            range: { from: index * 10, to: index * 10 + 8 },
            excerpt: `snapshot excerpt ${index}`,
          },
        ],
        currentSegments: [
          {
            documentId: `document-${String(index % 50).padStart(3, "0")}`,
            documentRevisionId: `current-revision-${String(index).padStart(4, "0")}`,
            documentTitle: `회차 ${index % 50}`,
            range: { from: index * 11, to: index * 11 + 9 },
            excerpt: `current excerpt ${index}`,
          },
        ],
      })),
    };
    const slotTimings: number[] = [];
    const planTimings: number[] = [];
    let slotCount = 0;
    let selectedSceneCount = 0;
    for (let iteration = 0; iteration < fixture.measurement.iterationCount; iteration += 1) {
      const slotStarted = performance.now();
      const slots = deriveWorkSnapshotSlots(iteration % 2 === 0 ? snapshots : [...snapshots].reverse());
      slotTimings.push(performance.now() - slotStarted);
      slotCount = slots.length;
      expect(slots.every((slot) => slot.history.length === fixture.measurement.snapshotsPerSlot - 1)).toBe(true);

      const planStarted = performance.now();
      const plan = parseWorkSnapshotSceneSelectionPlan(planInput);
      planTimings.push(performance.now() - planStarted);
      selectedSceneCount = plan.scenes.filter((scene) => scene.selected).length;
      expect(plan.automaticMergeAllowed).toBe(false);
      expect(plan.canApply).toBe(false);
      expect(plan.applyCommand).toBeNull();
    }

    const report = {
      schemaVersion: 1,
      fixtureUse: fixture.fixtureUse,
      environment: {
        platform: process.platform,
        architecture: process.arch,
        node: process.version,
      },
      rowCounts: {
        snapshots: snapshots.length,
        slots: slotCount,
        scenes: fixture.measurement.sceneCount,
        selectedScenes: selectedSceneCount,
      },
      timings: {
        namedSlotProjectionMs: {
          raw: slotTimings,
          p50: percentile(slotTimings, 0.5),
          p95: percentile(slotTimings, 0.95),
        },
        readOnlyScenePlanParseMs: {
          raw: planTimings,
          p50: percentile(planTimings, 0.5),
          p95: percentile(planTimings, 0.95),
        },
      },
      automaticMergeAllowed: false,
      applyCommandGenerated: false,
      databaseBytes: {
        measured: false,
        growth: null,
        reason: "pure-application-harness",
      },
      rendererCommitCount: {
        measured: false,
        value: null,
        reason: "application-harness",
      },
    };
    const artifactPath = path.resolve(
      "docs/verification/canon-continuity-gates-2-8/gate-7-work-snapshot-scene-performance.json",
    );
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(JSON.parse(await readFile(artifactPath, "utf8"))).toEqual(report);
  });
});
