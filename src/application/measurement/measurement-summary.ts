export type DurationMeasurementInput = {
  runId: string;
  scenarioId: string;
  durationsMs: readonly number[];
};

export type DurationMeasurementSummary = {
  runId: string;
  scenarioId: string;
  sampleCount: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

function valueAtPercentile(
  sortedDurations: readonly number[],
  percentile: number,
): number {
  const rank = Math.ceil((percentile / 100) * sortedDurations.length);
  return sortedDurations[Math.max(rank - 1, 0)]!;
}

export function summarizeDurations(
  input: DurationMeasurementInput,
): DurationMeasurementSummary {
  if (input.durationsMs.length === 0) {
    throw new Error("Measurement requires at least one duration");
  }
  if (
    input.durationsMs.some(
      (duration) => !Number.isFinite(duration) || duration < 0,
    )
  ) {
    throw new Error("Durations must be finite non-negative numbers");
  }

  const sortedDurations = [...input.durationsMs].sort(
    (left, right) => left - right,
  );

  return {
    runId: input.runId,
    scenarioId: input.scenarioId,
    sampleCount: sortedDurations.length,
    minMs: sortedDurations[0]!,
    p50Ms: valueAtPercentile(sortedDurations, 50),
    p95Ms: valueAtPercentile(sortedDurations, 95),
    maxMs: sortedDurations.at(-1)!,
  };
}
