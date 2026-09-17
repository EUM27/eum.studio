import { defineConfig } from "@playwright/test";

// This is the sole required Electron scenario list. The runner also checks
// these exact project identities in the real Playwright JSON result.
export const coreScenarios = [
  { id: "continuous-typing-reopen", file: "typing-persistence.spec.ts", title: "persists continuous typing and restores every character" },
  { id: "first-work-save-reopen", file: "manuscript-activity.spec.ts", title: "creates the first local Work and reopens its saved manuscript after restart" },
  { id: "selected-episode-txt", file: "manuscript-activity.spec.ts", title: "downloads selected episodes as one TXT in the actual episode order" },
  { id: "durable-save-receipt", file: "persistence-editor.spec.ts", title: "returns a durable receipt through the typed Electron save command" },
  { id: "graceful-close-flush", file: "persistence-editor.spec.ts", title: "flushes pending editor changes before a graceful window close completes" },
  { id: "revision-selection-reopen", file: "persistence-editor.spec.ts", title: "replays a published manuscript and restores its exact cursor selection after a full restart" },
  { id: "complete-media-backup-restore", file: "local-media-backup.spec.ts", title: "backs up managed MP3/MP4 and reconnects a missing external file after empty-location restore" },
  { id: "media-excluded-backup-restore", file: "local-media-backup.spec.ts", title: "creates a media-excluded backup through the UI after complete backup fails and reopens its restored manuscript" },
] as const;

const resultPath = process.env.EUM_STUDIO_VERIFICATION_PLAYWRIGHT_RESULT_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  outputDir: process.env.EUM_STUDIO_VERIFICATION_PLAYWRIGHT_OUTPUT_DIR ?? "test-results-verification-core",
  reporter: resultPath === undefined ? "list" : [["list"], ["json", { outputFile: resultPath }]],
  use: { trace: "retain-on-failure" },
  projects: coreScenarios.map((scenario) => ({
    name: scenario.id,
    testMatch: `**/${scenario.file}`,
    grep: new RegExp(`(?:^| )${scenario.title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "u"),
  })),
});
