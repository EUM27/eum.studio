import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "tests/unit/**/*.test.ts",
      "tests/evidence/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "dist-tests/**",
      "dist-electron/**",
      "dist-renderer/**",
      "release/**",
      ".tmp/**",
    ],
    maxWorkers: 4,
    passWithNoTests: false,
  },
});
