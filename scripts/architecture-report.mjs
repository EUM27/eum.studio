import { readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const targets = [
  "src/renderer/App.tsx",
  "src/renderer/StudioShell.tsx",
  "src/renderer/WorkspaceRoot.tsx",
  "src/renderer/StudioRoot.tsx",
  "src/application/contracts/studio-bridge.ts",
  "src/application/contracts/studio-bridge-core.ts",
  "src/preload/index.ts",
  "src/preload/studio-preload.ts",
  "src/desktop/main.ts",
  "src/desktop/bootstrap.ts",
  "tests/e2e/support/desktop-shell-suite.ts",
  "tests/e2e/shell-library-settings.spec.ts",
  "tests/e2e/manuscript-activity.spec.ts",
  "tests/e2e/structure-features.spec.ts",
  "tests/e2e/schedule-assistant.spec.ts",
  "tests/e2e/persistence-editor.spec.ts",
  "tests/e2e/manuscript-focus-music-theme.spec.ts",
  "tests/e2e/publishing-lore.spec.ts",
  "tests/e2e/events-plots-scenes.spec.ts",
];

const report = targets.map((target) => {
  const path = resolve(root, target);
  const source = readFileSync(path, "utf8");
  return {
    file: relative(root, path).replaceAll("\\", "/"),
    bytes: statSync(path).size,
    lines: source.split(/\r?\n/u).length,
    useState: source.match(/\buseState\s*(?:<|\()/gu)?.length ?? 0,
    useRef: source.match(/\buseRef\s*(?:<|\()/gu)?.length ?? 0,
    directBridgeCalls: source.match(/window\.eumStudio\./gu)?.length ?? 0,
    imports: source.match(/^import\b/gmu)?.length ?? 0,
  };
});

process.stdout.write(`${JSON.stringify({ schemaVersion: 1, files: report }, null, 2)}\n`);
