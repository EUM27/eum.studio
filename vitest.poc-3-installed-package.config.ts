import {
  defineConfig,
} from "vitest/config";

const timeoutInput =
  process.env
    .EUM_STUDIO_POC_3_INSTALLED_PACKAGE_TEST_TIMEOUT_MS;
const timeoutMs = Number(timeoutInput);
if (
  timeoutInput === undefined ||
  timeoutInput.length === 0 ||
  !Number.isSafeInteger(timeoutMs) ||
  timeoutMs <= 0
) {
  throw new Error(
    "EUM_STUDIO_POC_3_INSTALLED_PACKAGE_TEST_TIMEOUT_MS must be a caller-provided positive safe integer",
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/package/poc-3-installed-package*.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: timeoutMs,
    hookTimeout: timeoutMs,
    passWithNoTests: false,
  },
});
