import {
  defineConfig,
} from "vitest/config";

const deadlineInput =
  process.env
    .EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS;
const deadline = Number(
  deadlineInput,
);
if (
  deadlineInput === undefined ||
  deadlineInput.length === 0 ||
  !Number.isSafeInteger(deadline) ||
  deadline <= Date.now()
) {
  throw new Error(
    "EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS must be a caller-provided future epoch millisecond safe integer",
  );
}
const remaining =
  deadline - Date.now();

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/storage/**/*process-failure.test.ts",
      "tests/backup/**/*process-failure.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: remaining,
    hookTimeout: remaining,
    passWithNoTests: false,
  },
});
