import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { openNodeUiPreferencesStore } from "./node-ui-preferences-store";

describe("node UI preferences store", () => {
  it("restores the saved theme and manuscript focus settings after reopening", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-ui-preferences-"),
    );
    try {
      const first = await openNodeUiPreferencesStore({ rootDirectoryPath });
      const saved = await first.save({
        schemaVersion: 2,
        expectedRevision: 0,
        themeKey: "focus-light-theme",
        manuscriptFocus: {
          manuscriptWidthPx: 760,
          textScalePercent: 110,
          highlightCurrentParagraph: true,
          cursorFollowEnabled: true,
          cursorViewportPercent: 35,
        },
      });
      expect(saved.revision).toBe(1);

      const reopened = await openNodeUiPreferencesStore({ rootDirectoryPath });
      await expect(reopened.get()).resolves.toEqual(saved);
      expect(JSON.parse(await readFile(
        path.join(rootDirectoryPath, "preferences.json"),
        "utf8",
      ))).toEqual(saved);
    } finally {
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });
});
