import { entityId, type EntityId } from "../../domain/writing";

export type PomodoroPhase = "work" | "break";
export type PomodoroPauseReason = "manual" | "restore" | "phase-complete";

export type PomodoroSettings = {
  readonly workDurationMs: number;
  readonly breakDurationMs: number;
  readonly workCycleCount: number;
  readonly autoAdvance: boolean;
};

export type PomodoroPhaseDefinition = {
  readonly phaseRef: string;
  readonly phase: PomodoroPhase;
  readonly targetDurationMs: number;
};

export type PomodoroPolicyPlan = {
  readonly settings: PomodoroSettings;
  readonly phases: readonly PomodoroPhaseDefinition[];
};

export type GetPomodoroCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type ConfigureAndStartPomodoroCommand = GetPomodoroCommand & {
  readonly documentId: EntityId<"Document">;
  readonly workDurationMs: number;
  readonly breakDurationMs: number;
  readonly workCycleCount: number;
  readonly autoAdvance: boolean;
  readonly note: string;
};

export type PomodoroPhaseCommand = GetPomodoroCommand & {
  readonly focusCycleId: EntityId<"FocusCycle">;
};

export type PomodoroActivePhaseProjection = {
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly state: "running" | "paused";
  readonly phase: PomodoroPhase;
  readonly cycleNumber: number;
  readonly targetDurationMs: number;
  readonly remainingDurationMs: number;
  readonly startedAt: string;
  readonly deadlineAt: string | null;
  readonly pauseReason: PomodoroPauseReason | null;
  readonly note: string;
};

export type PomodoroProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly settings: PomodoroSettings | null;
  readonly status: "unconfigured" | "idle" | "running" | "paused" | "completed";
  readonly completedWorkCycles: number;
  readonly activePhase: PomodoroActivePhaseProjection | null;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
}

function stringValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = stringValue(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value;
}

function positiveSafeInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeSafeInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function booleanValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): boolean {
  const value = input[field];
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${field} must be a boolean`);
  }
  return value;
}

function identifier<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function nullableString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  if (input[field] === null) return null;
  return nonEmptyString(input, field, label);
}

function parseSettings(value: unknown, label: string): PomodoroSettings {
  const input = record(value, label);
  exact(
    input,
    ["workDurationMs", "breakDurationMs", "workCycleCount", "autoAdvance"],
    label,
  );
  return Object.freeze({
    workDurationMs: positiveSafeInteger(input, "workDurationMs", label),
    breakDurationMs: positiveSafeInteger(input, "breakDurationMs", label),
    workCycleCount: positiveSafeInteger(input, "workCycleCount", label),
    autoAdvance: booleanValue(input, "autoAdvance", label),
  });
}

export function parseGetPomodoroCommand(value: unknown): GetPomodoroCommand {
  const label = "GetPomodoroCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
  });
}

export function parseConfigureAndStartPomodoroCommand(
  value: unknown,
): ConfigureAndStartPomodoroCommand {
  const label = "ConfigureAndStartPomodoroCommand";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "workDurationMs",
      "breakDurationMs",
      "workCycleCount",
      "autoAdvance",
      "note",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
    documentId: identifier<"Document">(input, "documentId", label),
    workDurationMs: positiveSafeInteger(input, "workDurationMs", label),
    breakDurationMs: positiveSafeInteger(input, "breakDurationMs", label),
    workCycleCount: positiveSafeInteger(input, "workCycleCount", label),
    autoAdvance: booleanValue(input, "autoAdvance", label),
    note: stringValue(input, "note", label),
  });
}

export function parsePomodoroPhaseCommand(value: unknown): PomodoroPhaseCommand {
  const label = "PomodoroPhaseCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "focusCycleId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
    focusCycleId: identifier<"FocusCycle">(input, "focusCycleId", label),
  });
}

export function createPomodoroPolicyPlan(
  settingsInput: PomodoroSettings,
  createPhaseRef: (phase: PomodoroPhase) => string,
): PomodoroPolicyPlan {
  const settings = parseSettings(settingsInput, "PomodoroSettings");
  return validatePolicyPlan(
    [
      {
        phaseRef: createPhaseRef("work"),
        phase: "work",
        targetDurationMs: settings.workDurationMs,
      },
      {
        phaseRef: createPhaseRef("break"),
        phase: "break",
        targetDurationMs: settings.breakDurationMs,
      },
    ],
    settings,
  );
}

function validatePolicyPlan(
  phasesInput: readonly unknown[],
  settingsInput: PomodoroSettings,
): PomodoroPolicyPlan {
  const settings = parseSettings(settingsInput, "Pomodoro policy settings");
  if (phasesInput.length !== 2) {
    throw new Error("Pomodoro policy sequence must define work and break phases");
  }
  const phases = phasesInput.map((value, index) => {
    const label = `Pomodoro policy sequence[${index}]`;
    const input = record(value, label);
    exact(input, ["phaseRef", "phase", "targetDurationMs"], label);
    if (input.phase !== "work" && input.phase !== "break") {
      throw new Error(`${label}.phase is unsupported`);
    }
    return Object.freeze({
      phaseRef: nonEmptyString(input, "phaseRef", label),
      phase: input.phase,
      targetDurationMs: positiveSafeInteger(input, "targetDurationMs", label),
    });
  });
  if (new Set(phases.map((phase) => phase.phaseRef)).size !== phases.length) {
    throw new Error("Pomodoro policy phaseRef values must be unique");
  }
  const workPhase = phases[0];
  const breakPhase = phases[1];
  if (workPhase?.phase !== "work" || breakPhase?.phase !== "break") {
    throw new Error("Pomodoro policy sequence must define work before break");
  }
  if (
    workPhase.targetDurationMs !== settings.workDurationMs ||
    breakPhase.targetDurationMs !== settings.breakDurationMs
  ) {
    throw new Error("Pomodoro policy phase durations do not match settings");
  }
  return Object.freeze({
    settings,
    phases: Object.freeze(phases),
  });
}

export function serializePomodoroPolicyPlan(plan: PomodoroPolicyPlan): string {
  const validated = validatePolicyPlan(plan.phases, plan.settings);
  return JSON.stringify([
    {
      schemaVersion: 1,
      kind: "pomodoro",
      settings: validated.settings,
    },
    ...validated.phases,
  ]);
}

export function parsePomodoroPolicyPlan(input: {
  readonly phaseDefinitionsJson: string;
  readonly completionPolicy: string;
}): PomodoroPolicyPlan | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.phaseDefinitionsJson) as unknown;
  } catch {
    throw new Error("Pomodoro policy phaseDefinitionsJson is invalid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Pomodoro policy phaseDefinitionsJson must be an array");
  }
  if (parsed.length === 0) return null;
  if (input.completionPolicy !== "manual" && input.completionPolicy !== "auto-advance") {
    throw new Error("Pomodoro policy completionPolicy is unsupported");
  }
  const headerLabel = "Pomodoro policy header";
  const header = record(parsed[0], headerLabel);
  exact(header, ["schemaVersion", "kind", "settings"], headerLabel);
  if (header.schemaVersion !== 1 || header.kind !== "pomodoro") {
    throw new Error("Pomodoro policy header is unsupported");
  }
  const settings = parseSettings(header.settings, `${headerLabel}.settings`);
  if (settings.autoAdvance !== (input.completionPolicy === "auto-advance")) {
    throw new Error("Pomodoro policy completionPolicy does not match settings");
  }
  return validatePolicyPlan(parsed.slice(1), settings);
}

function parseActivePhase(value: unknown): PomodoroActivePhaseProjection {
  const label = "PomodoroActivePhaseProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "focusCycleId",
      "state",
      "phase",
      "cycleNumber",
      "targetDurationMs",
      "remainingDurationMs",
      "startedAt",
      "deadlineAt",
      "pauseReason",
      "note",
    ],
    label,
  );
  if (input.state !== "running" && input.state !== "paused") {
    throw new Error(`${label}.state is unsupported`);
  }
  if (input.phase !== "work" && input.phase !== "break") {
    throw new Error(`${label}.phase is unsupported`);
  }
  const targetDurationMs = positiveSafeInteger(input, "targetDurationMs", label);
  const remainingDurationMs = nonNegativeSafeInteger(
    input,
    "remainingDurationMs",
    label,
  );
  if (remainingDurationMs > targetDurationMs) {
    throw new Error(`${label}.remainingDurationMs exceeds its target`);
  }
  const deadlineAt = nullableString(input, "deadlineAt", label);
  const pauseReason = nullableString(input, "pauseReason", label);
  if (input.state === "running") {
    if (deadlineAt === null || pauseReason !== null) {
      throw new Error(`${label} running fields are inconsistent`);
    }
  } else if (
    deadlineAt !== null ||
    (pauseReason !== "manual" &&
      pauseReason !== "restore" &&
      pauseReason !== "phase-complete")
  ) {
    throw new Error(`${label} paused fields are inconsistent`);
  }
  return Object.freeze({
    focusCycleId: identifier<"FocusCycle">(input, "focusCycleId", label),
    state: input.state,
    phase: input.phase,
    cycleNumber: positiveSafeInteger(input, "cycleNumber", label),
    targetDurationMs,
    remainingDurationMs,
    startedAt: nonEmptyString(input, "startedAt", label),
    deadlineAt,
    pauseReason: pauseReason as PomodoroPauseReason | null,
    note: stringValue(input, "note", label),
  });
}

export function parsePomodoroProjection(value: unknown): PomodoroProjection {
  const label = "PomodoroProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "settings",
      "status",
      "completedWorkCycles",
      "activePhase",
    ],
    label,
  );
  schema(input, label);
  const workId = identifier<"Work">(input, "workId", label);
  if (
    input.status !== "unconfigured" &&
    input.status !== "idle" &&
    input.status !== "running" &&
    input.status !== "paused" &&
    input.status !== "completed"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  const settings = input.settings === null
    ? null
    : parseSettings(input.settings, `${label}.settings`);
  const completedWorkCycles = nonNegativeSafeInteger(
    input,
    "completedWorkCycles",
    label,
  );
  const activePhase = input.activePhase === null
    ? null
    : parseActivePhase(input.activePhase);
  if (settings === null) {
    if (input.status !== "unconfigured" || completedWorkCycles !== 0 || activePhase !== null) {
      throw new Error(`${label} unconfigured fields are inconsistent`);
    }
  } else {
    if (completedWorkCycles > settings.workCycleCount) {
      throw new Error(`${label}.completedWorkCycles exceeds its policy`);
    }
    if (
      (input.status === "running" || input.status === "paused") !==
      (activePhase !== null)
    ) {
      throw new Error(`${label} active fields are inconsistent`);
    }
    if (activePhase !== null && activePhase.state !== input.status) {
      throw new Error(`${label} active phase state does not match status`);
    }
    if (
      input.status === "completed" &&
      completedWorkCycles !== settings.workCycleCount
    ) {
      throw new Error(`${label} completed status is incomplete`);
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    workId,
    settings,
    status: input.status,
    completedWorkCycles,
    activePhase,
  });
}
