import {
  defineConfig,
} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/storage/**/*.test.ts",
      "tests/backup/**/*.test.ts",
      "tests/package/poc-3-driver-*.test.ts",
      "tests/performance/poc-3-driver-*.test.ts",
    ],
    exclude: [
      "**/*process-failure.test.ts",
    ],
    passWithNoTests: false,
  },
});
