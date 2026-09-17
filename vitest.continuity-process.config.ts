import { defineConfig } from "vitest/config";

const deadline = Number(process.env.EUM_STUDIO_CONTINUITY_PROCESS_DEADLINE_EPOCH_MS);
if (!Number.isSafeInteger(deadline) || deadline <= Date.now()) {
  throw new Error(
    "EUM_STUDIO_CONTINUITY_PROCESS_DEADLINE_EPOCH_MS must be a caller-provided future epoch millisecond safe integer",
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/continuity/continuity-process.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: deadline - Date.now(),
    hookTimeout: deadline - Date.now(),
    passWithNoTests: false,
  },
});
