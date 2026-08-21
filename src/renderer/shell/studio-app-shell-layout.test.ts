import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("./studio-app-shell.css", import.meta.url),
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

describe("studio home layout", () => {
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
});
