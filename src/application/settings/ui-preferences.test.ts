import { describe, expect, it } from "vitest";

import {
  parseSaveUiPreferencesCommand,
  parseUiPreferencesProjection,
} from "./ui-preferences";

describe("UI preferences contract", () => {
  it("keeps theme and every manuscript focus setting together", () => {
    const value = {
      schemaVersion: 2 as const,
      themeKey: "focus-dark-theme",
      manuscriptFocus: {
        manuscriptWidthPx: 820,
        textScalePercent: 115,
        highlightCurrentParagraph: true,
        cursorFollowEnabled: true,
        cursorViewportPercent: 32,
      },
    };
    expect(parseSaveUiPreferencesCommand({
      ...value,
      expectedRevision: 2,
    })).toMatchObject(value);
    expect(parseUiPreferencesProjection({
      ...value,
      revision: 3,
    })).toMatchObject(value);
  });
});
