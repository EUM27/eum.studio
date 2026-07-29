import {
  defineConfig,
} from "vitest/config";

const timeoutInput =
  process.env
    .EUM_STUDIO_POC_3_PERFORMANCE_TEST_TIMEOUT_MS;
const timeout = Number(
  timeoutInput,
);
if (
  timeoutInput === undefined ||
  timeoutInput.length === 0 ||
  !Number.isSafeInteger(timeout) ||
  timeout <= 0
) {
  throw new Error(
    "EUM_STUDIO_POC_3_PERFORMANCE_TEST_TIMEOUT_MS must be a caller-provided positive safe integer",
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/performance/poc-3-storage-performance.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: timeout,
    hookTimeout: timeout,
    passWithNoTests: false,
  },
});
