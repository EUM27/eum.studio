import { describe, expect, it } from "vitest";

import {
  parseSaveUiPreferencesCommand,
  parseUiPreferencesProjection,
} from "./ui-preferences";

describe("UI preferences contract", () => {
  it("keeps theme and every focus setting together", () => {
    const value = {
      schemaVersion: 1 as const,
      themeKey: "focus-dark-theme",
      focusMode: {
        contentWidthPx: 820,
        zoomPercent: 115,
        currentBlockHighlight: true,
        typewriterMode: true,
        typewriterPositionPercent: 32,
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
