import { randomUUID } from "node:crypto";
import type { PomodoroPhase,PomodoroPolicyPlan,PomodoroProjection } from "../../../application/activity/pomodoro-contract";
import { parsePomodoroPolicyPlan,parsePomodoroProjection } from "../../../application/activity/pomodoro-contract";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";
import { readNullableIdentity,readNullableInteger,readNullableString,readRequiredInteger,readRequiredString,readString,readTimestamp } from "./scalars";

export type StoredWritingSessionRow = {
  readonly sessionId: EntityId<"WritingSession">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document"> | null;
  readonly state: "active" | "completed";
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly startRevisionId: EntityId<"DocumentRevision"> | null;
  readonly endRevisionId: EntityId<"DocumentRevision"> | null;
  readonly note: string;
};

export type StoredActivityIntervalRow = {
  readonly sessionId: EntityId<"WritingSession">;
  readonly startedAt: string;
  readonly endedAt: string;
};

export type StoredFocusCycleRow = {
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly workId: EntityId<"Work">;
  readonly sessionId: EntityId<"WritingSession"> | null;
  readonly policyId: string;
  readonly state: "running" | "paused" | "completed" | "stopped";
  readonly phaseRef: string;
  readonly targetDurationMs: number;
  readonly startedAt: string;
  readonly deadlineAt: string | null;
  readonly remainingAtPause: number | null;
  readonly pauseReason: string | null;
  readonly completedAt: string | null;
  readonly note: string;
};

export type StoredFocusPolicyRow = {
  readonly policyId: string;
  readonly workId: EntityId<"Work">;
  readonly phaseDefinitionsJson: string;
  readonly completionPolicy: string;
};

export const WORK_ACTIVITY_POLICY_ROWS_SQL = `
SELECT
  ws.activity_policy_id AS "activityPolicyId",
  ws.focus_policy_id AS "focusPolicyId"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
WHERE w.id = ? AND w.retired_at IS NULL
`;

export const CURRENT_FOCUS_POLICY_ROW_SQL = `
SELECT
  fp.id AS "policyId",
  fp.work_id AS "workId",
  fp.phase_definitions_json AS "phaseDefinitionsJson",
  fp.completion_policy AS "completionPolicy"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
JOIN focus_policies AS fp
  ON fp.work_id = ws.work_id
  AND fp.id = ws.focus_policy_id
WHERE w.id = ? AND w.retired_at IS NULL
`;

export const FOCUS_POLICY_ROW_BY_ID_SQL = `
SELECT
  id AS "policyId",
  work_id AS "workId",
  phase_definitions_json AS "phaseDefinitionsJson",
  completion_policy AS "completionPolicy"
FROM focus_policies
WHERE work_id = ? AND id = ? AND retired_at IS NULL
`;

export const WRITING_SESSION_ROWS_SQL = `
SELECT
  id AS "sessionId",
  work_id AS "workId",
  document_id AS "documentId",
  state AS "state",
  started_at AS "startedAt",
  ended_at AS "endedAt",
  start_revision_id AS "startRevisionId",
  end_revision_id AS "endRevisionId",
  COALESCE(note, '') AS "note"
FROM writing_sessions
WHERE work_id = ? AND retired_at IS NULL
ORDER BY started_at DESC, id DESC
`;

export const ACTIVITY_INTERVAL_ROWS_SQL = `
SELECT
  session_id AS "sessionId",
  started_at AS "startedAt",
  ended_at AS "endedAt"
FROM activity_intervals
WHERE work_id = ?
ORDER BY started_at ASC, id ASC
`;

export const FOCUS_CYCLE_ROWS_SQL = `
SELECT
  id AS "focusCycleId",
  work_id AS "workId",
  session_id AS "sessionId",
  policy_id AS "policyId",
  state AS "state",
  pause_reason AS "pauseReason",
  phase_ref AS "phaseRef",
  target_duration AS "targetDurationMs",
  started_at AS "startedAt",
  deadline_at AS "deadlineAt",
  remaining_at_pause AS "remainingAtPause",
  completed_at AS "completedAt",
  COALESCE(note, '') AS "note"
FROM focus_cycles
WHERE work_id = ? AND retired_at IS NULL
ORDER BY created_at DESC, id DESC
`;

export function readWorkActivityPolicyIds(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): {
  readonly activityPolicyId: string;
  readonly focusPolicyId: string;
} {
  const rows = database.prepare(WORK_ACTIVITY_POLICY_ROWS_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(`Work activity settings are missing: ${workId}`);
  }
  const row = rows[0] ?? {};
  return Object.freeze({
    activityPolicyId: readRequiredString(
      row,
      "activityPolicyId",
      "Work activity settings",
    ),
    focusPolicyId: readRequiredString(
      row,
      "focusPolicyId",
      "Work activity settings",
    ),
  });
}

export function parseStoredFocusPolicyRow(
  row: Record<string, unknown>,
  label: string,
): StoredFocusPolicyRow {
  return Object.freeze({
    policyId: readRequiredString(row, "policyId", label),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    phaseDefinitionsJson: readRequiredString(
      row,
      "phaseDefinitionsJson",
      label,
    ),
    completionPolicy: readRequiredString(row, "completionPolicy", label),
  });
}

export function readCurrentFocusPolicyRow(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): StoredFocusPolicyRow {
  const rows = database.prepare(CURRENT_FOCUS_POLICY_ROW_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(`Current Work focus policy is missing: ${workId}`);
  }
  return parseStoredFocusPolicyRow(
    rows[0] ?? {},
    "Current Work focus policy",
  );
}

export function readFocusPolicyRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  policyId: string,
): StoredFocusPolicyRow {
  const rows = database
    .prepare(FOCUS_POLICY_ROW_BY_ID_SQL)
    .all(workId, policyId);
  if (rows.length !== 1) {
    throw new Error(`Unknown Work focus policy: ${workId}/${policyId}`);
  }
  return parseStoredFocusPolicyRow(rows[0] ?? {}, "Work focus policy");
}

export function readPomodoroPolicyPlan(
  policy: StoredFocusPolicyRow,
): PomodoroPolicyPlan | null {
  let definitions: unknown;
  try {
    definitions = JSON.parse(policy.phaseDefinitionsJson) as unknown;
  } catch {
    throw new Error(`Focus policy definitions are invalid JSON: ${policy.policyId}`);
  }
  if (!Array.isArray(definitions)) {
    throw new Error(`Focus policy definitions must be an array: ${policy.policyId}`);
  }
  const header = definitions[0];
  if (
    header === undefined ||
    typeof header !== "object" ||
    header === null ||
    Array.isArray(header) ||
    (header as Record<string, unknown>).kind !== "pomodoro"
  ) {
    return null;
  }
  return parsePomodoroPolicyPlan({
    phaseDefinitionsJson: policy.phaseDefinitionsJson,
    completionPolicy: policy.completionPolicy,
  });
}

export function readStoredWritingSessionRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredWritingSessionRow[] {
  return Object.freeze(
    database.prepare(WRITING_SESSION_ROWS_SQL).all(workId).map((row, index) => {
      const label = `WritingSession rows[${index}]`;
      const state = readRequiredString(row, "state", label);
      if (state !== "active" && state !== "completed") {
        throw new Error(`${label}.state is unsupported`);
      }
      const endedAt = readNullableString(row, "endedAt", label);
      const startRevisionId = readNullableIdentity<"DocumentRevision">(
        row,
        "startRevisionId",
        label,
      );
      const endRevisionId = readNullableIdentity<"DocumentRevision">(
        row,
        "endRevisionId",
        label,
      );
      return Object.freeze({
        sessionId: entityId<"WritingSession">(
          readRequiredString(row, "sessionId", label),
        ),
        workId: entityId<"Work">(readRequiredString(row, "workId", label)),
        documentId: readNullableIdentity<"Document">(
          row,
          "documentId",
          label,
        ),
        state,
        startedAt: readRequiredString(row, "startedAt", label),
        endedAt,
        startRevisionId,
        endRevisionId,
        note: readString(row, "note", label),
      });
    }),
  );
}

export function readStoredActivityIntervalRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredActivityIntervalRow[] {
  return Object.freeze(
    database.prepare(ACTIVITY_INTERVAL_ROWS_SQL).all(workId).map((row, index) => {
      const label = `ActivityInterval rows[${index}]`;
      return Object.freeze({
        sessionId: entityId<"WritingSession">(
          readRequiredString(row, "sessionId", label),
        ),
        startedAt: readRequiredString(row, "startedAt", label),
        endedAt: readRequiredString(row, "endedAt", label),
      });
    }),
  );
}

export function readStoredFocusCycleRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredFocusCycleRow[] {
  return Object.freeze(
    database.prepare(FOCUS_CYCLE_ROWS_SQL).all(workId).map((row, index) => {
      const label = `FocusCycle rows[${index}]`;
      const state = readRequiredString(row, "state", label);
      if (
        state !== "running" &&
        state !== "paused" &&
        state !== "completed" &&
        state !== "stopped"
      ) {
        throw new Error(`${label}.state is unsupported`);
      }
      return Object.freeze({
        focusCycleId: entityId<"FocusCycle">(
          readRequiredString(row, "focusCycleId", label),
        ),
        workId: entityId<"Work">(readRequiredString(row, "workId", label)),
        sessionId: readNullableIdentity<"WritingSession">(
          row,
          "sessionId",
          label,
        ),
        policyId: readRequiredString(row, "policyId", label),
        state,
        pauseReason: readNullableString(row, "pauseReason", label),
        phaseRef: readRequiredString(row, "phaseRef", label),
        targetDurationMs: readRequiredInteger(
          row,
          "targetDurationMs",
          label,
        ),
        startedAt: readRequiredString(row, "startedAt", label),
        deadlineAt: readNullableString(row, "deadlineAt", label),
        remainingAtPause: readNullableInteger(
          row,
          "remainingAtPause",
          label,
        ),
        completedAt: readNullableString(row, "completedAt", label),
        note: readString(row, "note", label),
      });
    }),
  );
}

export function findPomodoroPhaseDefinition(
  plan: PomodoroPolicyPlan,
  phaseRef: string,
) {
  const phase = plan.phases.find((candidate) => candidate.phaseRef === phaseRef);
  if (phase === undefined) {
    throw new Error(`FocusCycle references an unknown Pomodoro phase: ${phaseRef}`);
  }
  return phase;
}

export function deriveStoredPomodoroProjection(input: {
  readonly database: NodeSqliteDatabase;
  readonly workId: EntityId<"Work">;
  readonly nowMs: number;
}): PomodoroProjection {
  const policy = readCurrentFocusPolicyRow(input.database, input.workId);
  const plan = readPomodoroPolicyPlan(policy);
  if (plan === null) {
    return parsePomodoroProjection({
      schemaVersion: 1,
      workId: input.workId,
      settings: null,
      status: "unconfigured",
      completedWorkCycles: 0,
      activePhase: null,
    });
  }
  const cycles = readStoredFocusCycleRows(input.database, input.workId).filter(
    (cycle) => cycle.policyId === policy.policyId,
  );
  for (const cycle of cycles) {
    findPomodoroPhaseDefinition(plan, cycle.phaseRef);
  }
  const activeCycles = cycles.filter(
    (cycle) => cycle.state === "running" || cycle.state === "paused",
  );
  if (activeCycles.length > 1) {
    throw new Error(`Work has more than one active Pomodoro phase: ${input.workId}`);
  }
  const workPhaseRef = plan.phases.find((phase) => phase.phase === "work")?.phaseRef;
  if (workPhaseRef === undefined) {
    throw new Error(`Pomodoro work phase is missing: ${policy.policyId}`);
  }
  const completedWorkCycles = cycles.filter(
    (cycle) => cycle.state === "completed" && cycle.phaseRef === workPhaseRef,
  ).length;
  const activeCycle = activeCycles[0];
  const activePhase = activeCycle === undefined
    ? null
    : (() => {
        const definition = findPomodoroPhaseDefinition(plan, activeCycle.phaseRef);
        const cycleNumber = definition.phase === "work"
          ? completedWorkCycles + 1
          : completedWorkCycles;
        if (cycleNumber <= 0 || cycleNumber > plan.settings.workCycleCount) {
          throw new Error(
            `Pomodoro phase cycle number is outside its policy: ${activeCycle.focusCycleId}`,
          );
        }
        let remainingDurationMs: number;
        if (activeCycle.state === "running") {
          if (activeCycle.deadlineAt === null || activeCycle.pauseReason !== null) {
            throw new Error(
              `Running Pomodoro phase fields are inconsistent: ${activeCycle.focusCycleId}`,
            );
          }
          remainingDurationMs = Math.max(
            0,
            readTimestamp(activeCycle.deadlineAt, "FocusCycle.deadlineAt") -
              input.nowMs,
          );
        } else {
          if (
            activeCycle.deadlineAt !== null ||
            activeCycle.remainingAtPause === null ||
            activeCycle.pauseReason === null
          ) {
            throw new Error(
              `Paused Pomodoro phase fields are inconsistent: ${activeCycle.focusCycleId}`,
            );
          }
          remainingDurationMs = activeCycle.remainingAtPause;
        }
        return {
          focusCycleId: activeCycle.focusCycleId,
          state: activeCycle.state,
          phase: definition.phase,
          cycleNumber,
          targetDurationMs: activeCycle.targetDurationMs,
          remainingDurationMs,
          startedAt: activeCycle.startedAt,
          deadlineAt: activeCycle.deadlineAt,
          pauseReason: activeCycle.pauseReason,
          note: activeCycle.note,
        };
      })();
  const status = activePhase === null
    ? completedWorkCycles === plan.settings.workCycleCount
      ? "completed"
      : "idle"
    : activePhase.state;
  return parsePomodoroProjection({
    schemaVersion: 1,
    workId: input.workId,
    settings: plan.settings,
    status,
    completedWorkCycles,
    activePhase,
  });
}

export function readActiveWritingSessionId(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): EntityId<"WritingSession"> | null {
  return (
    readStoredWritingSessionRows(database, workId).find(
      (session) => session.state === "active",
    )?.sessionId ?? null
  );
}

export function insertPomodoroCycle(input: {
  readonly database: NodeSqliteDatabase;
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly workId: EntityId<"Work">;
  readonly sessionId: EntityId<"WritingSession"> | null;
  readonly policyId: string;
  readonly phaseRef: string;
  readonly state: "running" | "paused";
  readonly pauseReason: "restore" | "phase-complete" | null;
  readonly targetDurationMs: number;
  readonly startedAt: string;
  readonly deadlineAt: string | null;
  readonly remainingAtPause: number | null;
  readonly note: string;
}): void {
  input.database.prepare(`
    INSERT INTO focus_cycles (
      id,
      schema_version,
      revision,
      created_at,
      updated_at,
      retired_at,
      work_id,
      session_id,
      policy_id,
      phase_ref,
      state,
      pause_reason,
      target_duration,
      started_at,
      deadline_at,
      remaining_at_pause,
      completed_at,
      note,
      music_queue_id
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)
  `).run(
    input.focusCycleId,
    LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
    1,
    input.startedAt,
    input.startedAt,
    input.workId,
    input.sessionId,
    input.policyId,
    input.phaseRef,
    input.state,
    input.pauseReason,
    input.targetDurationMs,
    input.startedAt,
    input.deadlineAt,
    input.remainingAtPause,
    input.note.length === 0 ? null : input.note,
  );
}

export function transitionCompletedPomodoroPhase(input: {
  readonly database: NodeSqliteDatabase;
  readonly workId: EntityId<"Work">;
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly nowMs: number;
  readonly restore: boolean;
}): boolean {
  const policy = readCurrentFocusPolicyRow(input.database, input.workId);
  const plan = readPomodoroPolicyPlan(policy);
  if (plan === null) {
    throw new Error(`Current Work has no configured Pomodoro: ${input.workId}`);
  }
  const cycles = readStoredFocusCycleRows(input.database, input.workId).filter(
    (cycle) => cycle.policyId === policy.policyId,
  );
  const current = cycles.find(
    (cycle) => cycle.focusCycleId === input.focusCycleId,
  );
  if (current === undefined || current.state !== "running") {
    throw new Error(`Pomodoro phase is not running: ${input.focusCycleId}`);
  }
  if (current.deadlineAt === null) {
    throw new Error(`Running Pomodoro phase has no deadline: ${input.focusCycleId}`);
  }
  const deadlineMs = readTimestamp(current.deadlineAt, "FocusCycle.deadlineAt");
  if (deadlineMs > input.nowMs) return false;
  const definition = findPomodoroPhaseDefinition(plan, current.phaseRef);
  const completedWorkCycles = cycles.filter((cycle) => {
    const phase = findPomodoroPhaseDefinition(plan, cycle.phaseRef);
    return cycle.state === "completed" && phase.phase === "work";
  }).length;
  const completedAfter = completedWorkCycles + (definition.phase === "work" ? 1 : 0);
  const nextPhase: PomodoroPhase | null = definition.phase === "work"
    ? completedAfter >= plan.settings.workCycleCount
      ? null
      : "break"
    : "work";
  const nextDefinition = nextPhase === null
    ? null
    : plan.phases.find((phase) => phase.phase === nextPhase) ?? null;
  if (nextPhase !== null && nextDefinition === null) {
    throw new Error(`Pomodoro next phase is missing: ${policy.policyId}/${nextPhase}`);
  }
  const transitionAt = new Date(input.nowMs).toISOString();
  input.database.exec("BEGIN IMMEDIATE");
  try {
    const updated = input.database.prepare(`
      UPDATE focus_cycles
      SET
        revision = revision + 1,
        updated_at = ?,
        state = 'completed',
        pause_reason = NULL,
        deadline_at = NULL,
        remaining_at_pause = NULL,
        completed_at = ?
      WHERE id = ? AND work_id = ? AND policy_id = ? AND state = 'running'
    `).run(
      transitionAt,
      current.deadlineAt,
      current.focusCycleId,
      input.workId,
      policy.policyId,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed before completion: ${current.focusCycleId}`);
    }
    if (nextDefinition !== null) {
      const shouldRun = !input.restore && plan.settings.autoAdvance;
      insertPomodoroCycle({
        database: input.database,
        focusCycleId: entityId<"FocusCycle">(randomUUID()),
        workId: input.workId,
        sessionId: readActiveWritingSessionId(input.database, input.workId),
        policyId: policy.policyId,
        phaseRef: nextDefinition.phaseRef,
        state: shouldRun ? "running" : "paused",
        pauseReason: shouldRun
          ? null
          : input.restore
            ? "restore"
            : "phase-complete",
        targetDurationMs: nextDefinition.targetDurationMs,
        startedAt: transitionAt,
        deadlineAt: shouldRun
          ? new Date(input.nowMs + nextDefinition.targetDurationMs).toISOString()
          : null,
        remainingAtPause: shouldRun ? null : nextDefinition.targetDurationMs,
        note: current.note,
      });
    }
    input.database.exec("COMMIT");
  } catch (error) {
    input.database.exec("ROLLBACK");
    throw error;
  }
  return true;
}

export function restoreRunningPomodoroCycles(
  database: NodeSqliteDatabase,
  nowMs: number,
): void {
  const rows = database.prepare(`
    SELECT work_id AS "workId", id AS "focusCycleId"
    FROM focus_cycles
    WHERE state = 'running' AND retired_at IS NULL
    ORDER BY work_id ASC, created_at ASC, id ASC
  `).all();
  for (const [index, row] of rows.entries()) {
    const label = `Running FocusCycle rows[${index}]`;
    const workId = entityId<"Work">(readRequiredString(row, "workId", label));
    const focusCycleId = entityId<"FocusCycle">(
      readRequiredString(row, "focusCycleId", label),
    );
    const cycle = readStoredFocusCycleRows(database, workId).find(
      (candidate) => candidate.focusCycleId === focusCycleId,
    );
    if (cycle === undefined) throw new Error(`Unknown running FocusCycle: ${focusCycleId}`);
    const policy = readFocusPolicyRowById(database, workId, cycle.policyId);
    if (readPomodoroPolicyPlan(policy) === null) continue;
    if (readCurrentFocusPolicyRow(database, workId).policyId !== policy.policyId) {
      throw new Error(`Running Pomodoro is outside current Work policy: ${focusCycleId}`);
    }
    if (cycle.deadlineAt === null) {
      throw new Error(`Running Pomodoro phase has no deadline: ${focusCycleId}`);
    }
    const remainingDurationMs = Math.max(
      0,
      readTimestamp(cycle.deadlineAt, "FocusCycle.deadlineAt") - nowMs,
    );
    if (remainingDurationMs === 0) {
      transitionCompletedPomodoroPhase({
        database,
        workId,
        focusCycleId,
        nowMs,
        restore: true,
      });
      continue;
    }
    const updatedAt = new Date(nowMs).toISOString();
    const updated = database.prepare(`
      UPDATE focus_cycles
      SET
        revision = revision + 1,
        updated_at = ?,
        state = 'paused',
        pause_reason = 'restore',
        deadline_at = NULL,
        remaining_at_pause = ?
      WHERE id = ? AND work_id = ? AND policy_id = ? AND state = 'running'
    `).run(updatedAt, remainingDurationMs, focusCycleId, workId, policy.policyId);
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed during restore: ${focusCycleId}`);
    }
  }
}

