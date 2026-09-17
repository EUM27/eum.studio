import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import type { Poc3LedgerRecord } from "../../domain/poc-3-storage-ledger";
import { openNodeSqliteLedger } from "../../platform/storage/node-sqlite-ledger";
import { parsePoc3StorageOpenProfile } from "../../platform/storage/node-sqlite-ledger-profile";
import { createLocalContextPlanner, type LocalContextPlanner } from "./local-context-planner";

const now = "2026-08-29T00:00:00.000Z";
const meta = (id: string) => ({ id, schemaVersion: 21, revision: 1, createdAt: now, updatedAt: now } as const);

function records(): readonly Poc3LedgerRecord[] {
  return [
    { kind: "studio", id: "studio-1", displayName: "이음", locale: "ko-KR", timezone: "Asia/Seoul", settingsRevision: 1, createdAt: now },
    { kind: "work", ...meta("work-1"), studioId: "studio-1", title: "작품", orderKey: "a", settingsId: "settings-1" },
    { kind: "activityPolicy", ...meta("activity-1"), workId: "work-1", idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
    { kind: "focusPolicy", ...meta("focus-1"), workId: "work-1", phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
    { kind: "workSettings", id: "settings-1", workId: "work-1", sceneRuleSetId: "rules-1", activityPolicyId: "activity-1", focusPolicyId: "focus-1", railPreferencesJson: "{}", revision: 1 },
    { kind: "character", ...meta("character-1"), workId: "work-1", name: "윤서", aliases: [], role: "기록관", summary: "북문을 조사한다", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "" },
    { kind: "character", ...meta("character-2"), workId: "work-1", name: "민호", aliases: [], role: "", summary: "", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "" },
    { kind: "characterRelation", ...meta("relation-1"), workId: "work-1", fromCharacterId: "character-1", toCharacterId: "character-2", relationKind: "동료", description: "함께 조사한다" },
    { kind: "loreEntry", ...meta("lore-1"), workId: "work-1", title: "북문", content: "밤에 닫힌다", category: "장소", aliases: [], enabled: true },
    { kind: "plotThread", ...meta("plot-1"), workId: "work-1", title: "북문 조사", stage: "planned", summary: "북문으로 간다", note: "" },
    { kind: "foreshadowLine", ...meta("foreshadow-1"), workId: "work-1", title: "잠긴 문", note: "열쇠를 회수한다" },
    { kind: "continuityThread", ...meta("thread-1"), schemaVersion: 1, workId: "work-1", threadKind: "open-question", title: "누가 문을 잠갔는가", note: "답이 남음", status: "open", openedAt: now, resolvedAt: null, subjectRefs: [] },
    { kind: "characterKnowledge", ...meta("knowledge-1"), schemaVersion: 1, workId: "work-1", characterId: "character-1", statement: "열쇠는 북문을 연다", stance: "believes", truthStatus: "unknown", status: "active", supersedesKnowledgeId: null, supersededByKnowledgeId: null, retiredReason: null, aboutRefs: [] },
    { kind: "work", ...meta("work-2"), studioId: "studio-1", title: "외부", orderKey: "b", settingsId: "settings-2" },
    { kind: "activityPolicy", ...meta("activity-2"), workId: "work-2", idleTimeout: 1, navigationGrace: 1, hiddenWindowPolicy: "pause", activityClassRulesJson: "{}", autoStartEnabled: false, autoResumeFromIdle: false, recoveryPolicy: "manual" },
    { kind: "focusPolicy", ...meta("focus-2"), workId: "work-2", phaseDefinitionsJson: "[]", backgroundPolicy: "pause", musicStartPolicy: "manual", completionPolicy: "manual", visibility: "work" },
    { kind: "workSettings", id: "settings-2", workId: "work-2", sceneRuleSetId: "rules-2", activityPolicyId: "activity-2", focusPolicyId: "focus-2", railPreferencesJson: "{}", revision: 1 },
    { kind: "character", ...meta("character-outside"), workId: "work-2", name: "외부", aliases: [], role: "", summary: "", appearance: "", personality: "", speech: "", goal: "", conflict: "", note: "" },
  ];
}

type Fixture = Readonly<{ root: string; database: DatabaseSync; ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>; planner: LocalContextPlanner }>;
const fixtures: Fixture[] = [];

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "eum-context-planner-"));
  const databasePath = path.join(root, "workspace.sqlite3");
  const ledger = await openNodeSqliteLedger(parsePoc3StorageOpenProfile({
    databasePath, checksumIdentity: "eum-studio-ledger-sha256-v1",
    requestedSettings: {
      journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
      synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
      foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
    }, targetSchemaVersion: 21,
  }));
  await ledger.transaction(async (transaction) => { for (const record of records()) transaction.write(record); });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.prepare(`INSERT INTO assistant_context_receipts (
    id,schema_version,request_id,work_id,conversation_id,capability,destination_id,
    read_ranges_json,transmitted_ranges_json,read_character_count,
    transmitted_character_count,grant_ids_json,created_at
  ) VALUES ('receipt-1',1,'request-1','work-1','conversation-1','canon.review',
    'provider-1','[]','[]',12,8,'[]',?)`).run(now);
  let id = 0;
  const planner = createLocalContextPlanner({
    database, ledger, now: () => `2026-08-29T00:00:${String(++id).padStart(2, "0")}.000Z`,
    createId: () => `context-generated-${++id}`,
  });
  const value = Object.freeze({ root, database, ledger, planner });
  fixtures.push(value);
  return value;
}

afterEach(async () => {
  while (fixtures.length > 0) {
    const value = fixtures.pop()!;
    value.database.close(); value.ledger.close();
    await rm(value.root, { recursive: true, force: true });
  }
});

describe("LocalContextPlanner", () => {
  it("projects virtual relevant defaults without prewriting rows and plans current Work context", async () => {
    const value = await fixture();
    const initial = value.planner.listPolicies({ schemaVersion: 1, workId: "work-1" as never });
    expect(initial.policies.length).toBeGreaterThanOrEqual(8);
    expect(initial.policies.every((policy) => policy.mode === "relevant" && policy.revision === 0)).toBe(true);
    expect(value.database.prepare(`SELECT COUNT(*) AS count FROM assistant_entity_context_policies`).get())
      .toEqual({ count: 0 });

    const required = await value.planner.savePolicy({ schemaVersion: 1, workId: "work-1" as never, entity: { kind: "character", id: "character-1" as never }, expectedRevision: null, mode: "required" });
    await value.planner.savePolicy({ schemaVersion: 1, workId: "work-1" as never, entity: { kind: "lore-entry", id: "lore-1" as never }, expectedRevision: null, mode: "withheld" });
    expect(required).toMatchObject({ revision: 1, mode: "required" });

    const input = { schemaVersion: 1 as const, workId: "work-1" as never, capability: "canon.review" as const, sourceRange: null, sceneId: null, povCharacterId: "character-1" as never, userQuery: "북문", tokenBudget: 1000 };
    const first = value.planner.plan(input);
    const second = value.planner.plan(input);
    expect(first).toEqual(second);
    if (first.status !== "planned") throw new Error("Expected planned context");
    expect(first.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: { kind: "character", id: "character-1" }, inclusionReason: "required-policy" }),
      expect.objectContaining({ entity: { kind: "continuity-thread", id: "thread-1" }, inclusionReason: "open-continuity" }),
      expect.objectContaining({ entity: { kind: "character-knowledge", id: "knowledge-1" }, inclusionReason: "pov-knowledge" }),
    ]));
    expect(first.excluded).toContainEqual(expect.objectContaining({ entity: { kind: "lore-entry", id: "lore-1" }, reason: "withheld-policy" }));
    expect(value.planner.plan({ ...input, tokenBudget: 0 })).toMatchObject({ status: "required-context-over-budget" });
  });

  it("persists immutable receipt-linked manifests and safe activity projections", async () => {
    const value = await fixture();
    const plan = value.planner.plan({ schemaVersion: 1, workId: "work-1" as never, capability: "canon.review", sourceRange: null, sceneId: null, povCharacterId: "character-1" as never, userQuery: "", tokenBudget: 1000 });
    if (plan.status !== "planned") throw new Error("Expected planned context");
    const manifest = await value.planner.recordManifest({ workId: "work-1" as never, receiptId: "receipt-1" as never, plan });
    expect(manifest).toMatchObject({ receiptId: "receipt-1", entries: plan.entries });
    const activity = await value.planner.recordActivity({
      workId: "work-1" as never, receiptId: "receipt-1" as never,
      manifestId: manifest.manifestId, providerId: "provider-1", modelId: "model-1",
      startedAt: now, completedAt: "2026-08-29T00:00:01.000Z",
      stageDurationsMs: { plan: 3, authorize: 2, connector: 10, persist: 1 },
      candidateCount: 2,
    });
    expect(activity).toMatchObject({ capability: "canon.review", readCharacterCount: 12, transmittedCharacterCount: 8, candidateCount: 2 });
    expect(value.planner.listManifests({ schemaVersion: 1, workId: "work-1" as never }).manifests).toHaveLength(1);
    expect(value.planner.listActivities({ schemaVersion: 1, workId: "work-1" as never }).activities).toHaveLength(1);
    expect(JSON.stringify(activity)).not.toMatch(/prompt|reasoning|api.?key|원고 전체/iu);
  });

  it("rejects outside-Work policies and receipt mismatches", async () => {
    const value = await fixture();
    await expect(value.planner.savePolicy({ schemaVersion: 1, workId: "work-1" as never, entity: { kind: "character", id: "character-outside" as never }, expectedRevision: null, mode: "required" }))
      .rejects.toThrow(/outside Work/u);
    const plan = value.planner.plan({ schemaVersion: 1, workId: "work-2" as never, capability: "canon.review", sourceRange: null, sceneId: null, povCharacterId: null, userQuery: "", tokenBudget: 100 });
    if (plan.status !== "planned") throw new Error("Expected planned context");
    await expect(value.planner.recordManifest({ workId: "work-2" as never, receiptId: "receipt-1" as never, plan }))
      .rejects.toThrow(/receipt/u);
  });
});
