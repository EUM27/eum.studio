import { defineConfig } from "vitest/config";

const testTimeoutValue =
  process.env
    .EUM_STUDIO_POC_2_CRASH_TEST_TIMEOUT_MS;
const testTimeout =
  testTimeoutValue === undefined
    ? Number.NaN
    : Number(testTimeoutValue);
if (
  !Number.isSafeInteger(testTimeout) ||
  testTimeout <= 0
) {
  throw new Error(
    "EUM_STUDIO_POC_2_CRASH_TEST_TIMEOUT_MS must be a positive safe integer",
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/crash/**/*.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout,
    passWithNoTests: false,
  },
});
