import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const stylesheet = Buffer.concat([
  readFileSync(new URL("../styles/shell-foundation.css", import.meta.url)),
  readFileSync(new URL("../styles/library.css", import.meta.url)),
  readFileSync(new URL("../styles/shared-controls.css", import.meta.url)),
  readFileSync(new URL("../styles/library-cards.css", import.meta.url)),
  readFileSync(new URL("../styles/workspace-editor-shell.css", import.meta.url)),
  readFileSync(new URL("../styles/document-controls.css", import.meta.url)),
  readFileSync(new URL("../styles/workspace-layout.css", import.meta.url)),
  readFileSync(new URL("../styles/document-rail-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/workspace-ia-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/dialogs.css", import.meta.url)),
  readFileSync(new URL("../styles/schedule.css", import.meta.url)),
  readFileSync(new URL("../styles/activity-records.css", import.meta.url)),
  readFileSync(new URL("../styles/manuscript-review.css", import.meta.url)),
  readFileSync(new URL("../styles/manager-surfaces-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/publishing-revision-music-plot-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/quick-tools.css", import.meta.url)),
  readFileSync(new URL("../styles/late-dialog-surfaces-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/responsive-manuscript-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/characters-inspiration.css", import.meta.url)),
  readFileSync(new URL("../styles/plot-manager-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/plot-scene-music.css", import.meta.url)),
  readFileSync(new URL("../styles/planning-import-dark-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/theme-compat.css", import.meta.url)),
  readFileSync(new URL("../styles/music-assistant-surfaces.css", import.meta.url)),
  readFileSync(new URL("./studio-app-shell.css", import.meta.url)),
]).toString("utf8");
const mainEntry = readFileSync(
  new URL("../main.tsx", import.meta.url),
  "utf8",
);

function ruleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m"));
  if (match?.[1] === undefined) {
    throw new Error(`Missing CSS rule: ${selector}`);
  }
  return match[1];
}

function lastRuleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...stylesheet.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "gm")),
  ];
  const match = matches.at(-1);
  if (match?.[1] === undefined) {
    throw new Error(`Missing CSS rule: ${selector}`);
  }
  return match[1];
}

describe("studio home layout", () => {
  it("loads the active CSS shards in their original cascade order", () => {
    expect(mainEntry).toContain(
      [
        'import "./styles/shell-foundation.css";',
        'import "./styles/library.css";',
        'import "./styles/shared-controls.css";',
        'import "./styles/library-cards.css";',
        'import "./styles/workspace-editor-shell.css";',
        'import "./styles/document-controls.css";',
        'import "./styles/workspace-layout.css";',
        'import "./styles/document-rail-compat.css";',
        'import "./styles/workspace-ia-compat.css";',
        'import "./styles/dialogs.css";',
        'import "./styles/schedule.css";',
        'import "./styles/activity-records.css";',
        'import "./styles/manuscript-review.css";',
        'import "./styles/manager-surfaces-compat.css";',
        'import "./styles/publishing-revision-music-plot-compat.css";',
        'import "./styles/quick-tools.css";',
        'import "./styles/late-dialog-surfaces-compat.css";',
        'import "./styles/responsive-manuscript-compat.css";',
        'import "./styles/characters-inspiration.css";',
        'import "./styles/plot-manager-compat.css";',
        'import "./styles/plot-scene-music.css";',
        'import "./styles/planning-import-dark-compat.css";',
        'import "./styles/theme-compat.css";',
        'import "./styles/music-assistant-surfaces.css";',
        'import "./shell/studio-app-shell.css";',
      ].join("\n"),
    );
  });

  it("keeps the resume action compact and the library visually balanced", () => {
    const homeShell = ruleFor(
      ".studio-app-shell.is-home:not(.is-compact)",
    );
    const resume = ruleFor(".studio-app-shell .resume-strip");
    const resumeAction = ruleFor(".studio-app-shell .resume-strip-action");
    const library = ruleFor(".studio-app-shell .library-work-list");
    const card = ruleFor(".studio-app-shell .library-work-card");
    const header = ruleFor(".studio-app-shell .library-work-card > header");
    const coverColumn = ruleFor(".studio-app-shell .work-cover-column");
    const cover = ruleFor(".studio-app-shell .work-cover");
    const coverImage = ruleFor(".studio-app-shell .work-cover-image");
    const favorite = ruleFor(".studio-app-shell .work-favorite-button");
    const coverButtons = ruleFor(
      ".studio-app-shell .work-favorite-button,\n.studio-app-shell .work-cover-actions button",
    );
    const coverActions = ruleFor(".studio-app-shell .work-cover-actions");
    const actions = ruleFor(".studio-app-shell .work-card-actions");
    const metadata = ruleFor(".studio-app-shell .continue-description");

    expect(homeShell).toContain("--eum-sidebar-width: 72px");
    expect(resume).toContain("min-height: 74px");
    expect(resume).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(resumeAction).toContain("min-height: 34px");
    expect(library).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(card).toContain("container-type: inline-size");
    expect(header).toMatch(/grid-template-columns:\s*clamp\([^;]+\)\s+minmax\(0,\s*1fr\)/);
    expect(header).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(coverColumn).toContain("aspect-ratio: 2 / 3");
    expect(coverColumn).toContain("grid-row: 1 / 3");
    expect(cover).toContain("cursor: pointer");
    expect(coverImage).toContain("object-fit: cover");
    expect(favorite).toContain("top:");
    expect(favorite).toContain("left:");
    expect(coverButtons).toContain("background: transparent");
    expect(coverButtons).toContain("border: 0");
    expect(coverButtons).toContain("box-shadow: none");
    expect(coverButtons).toContain("width: 24px");
    expect(coverButtons).toContain("height: 24px");
    expect(coverActions).toContain("bottom:");
    expect(coverActions).toContain("left:");
    expect(actions).toContain("grid-column: 2");
    expect(metadata).toContain("white-space: nowrap");
  });

  it("styles the home document selector as a native dropdown", () => {
    const documentSelect = ruleFor(".studio-app-shell .work-document-select");

    expect(documentSelect).toContain("width: 150px");
    expect(documentSelect).toContain("font: inherit");
    expect(documentSelect).toContain("cursor: pointer");
  });

  it("uses the full app width for the centered manuscript focus screen", () => {
    const focusShell = ruleFor(
      ".studio-app-shell.is-editor:has(.writing-workspace-focus-mode[data-work-section])",
    );
    const focusWorkspace = ruleFor(
      ".studio-app-shell.is-editor:has(.writing-workspace-focus-mode[data-work-section])\n  > .workspace",
    );

    expect(focusShell).toContain("--eum-sidebar-width: 0px");
    expect(focusWorkspace).toContain("grid-column: 1 / -1");
  });

  it("keeps all focus floating toolbar text readable", () => {
    const statusTitle = ruleFor(
      ".studio-app-shell .focus-mode-pomodoro-status strong",
    );
    const statusDetail = ruleFor(
      ".studio-app-shell .focus-mode-pomodoro-status span",
    );
    const statusTimer = lastRuleFor(
      ".studio-app-shell .focus-mode-pomodoro-status output",
    );
    const toolbarTitle = ruleFor(
      ".studio-app-shell .focus-mode-toolbar-title strong",
    );
    const toolbarDetail = ruleFor(
      ".studio-app-shell .focus-mode-toolbar-title span,\n.studio-app-shell .focus-mode-save-status",
    );
    const toolbarControls = ruleFor(
      ".studio-app-shell .focus-mode-width-control,\n.studio-app-shell .focus-mode-zoom-control,\n.studio-app-shell .focus-mode-typewriter-position",
    );
    const toolbarButton = ruleFor(
      ".studio-app-shell .focus-mode-toolbar button",
    );

    expect(statusTitle).toContain("font-size: 13px");
    expect(statusDetail).toContain("font-size: 12px");
    expect(statusTimer).toContain("font-size: 14px");
    expect(toolbarTitle).toContain("font-size: 13px");
    expect(toolbarDetail).toContain("font-size: 12px");
    expect(toolbarControls).toContain("font-size: 12px");
    expect(toolbarButton).toContain("font-size: 12px");
  });
});
