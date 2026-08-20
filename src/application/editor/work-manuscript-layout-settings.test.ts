import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { parseManuscriptFormattingProfile } from "./manuscript-formatting";
import {
  applyManuscriptLayoutSettings,
  createDefaultWorkManuscriptLayoutSettingsProjection,
  parseManuscriptLayoutSettings,
  parseSaveWorkManuscriptLayoutSettingsCommand,
  parseWorkManuscriptLayoutSettingsProjection,
  readManuscriptLayoutSettings,
} from "./work-manuscript-layout-settings";

const profile = parseManuscriptFormattingProfile(
  JSON.parse(
    readFileSync(join(process.cwd(), "config", "manuscript-formatting.json"), "utf8"),
  ),
);

describe("Work manuscript layout settings", () => {
  it("keeps editor layout separate from document-owned ranges and alignments", () => {
    const shared = parseManuscriptLayoutSettings(
      {
        contentWidthPx: 620,
        lineHeight: 2.05,
        paragraphSpacingPx: 0,
        letterSpacingEm: 0,
      },
      profile,
    );
    const updated = applyManuscriptLayoutSettings(
      {
        schemaVersion: 1,
        ranges: [{ from: 0, to: 1, style: { bold: true } }],
        fontFamilyId: profile.defaults.fontFamilyId,
        fontSizePx: profile.defaults.fontSizePx,
        contentWidthPx: 720,
        lineHeight: 1.8,
        paragraphSpacingPx: 8,
        letterSpacingEm: 0.02,
        paragraphAlignments: [{ at: 0, alignment: "center" }],
      },
      shared,
    );

    expect(readManuscriptLayoutSettings(updated)).toEqual(shared);
    expect(updated.ranges).toEqual([{ from: 0, to: 1, style: { bold: true } }]);
    expect(updated.paragraphAlignments).toEqual([{ at: 0, alignment: "center" }]);
  });

  it("round-trips a Work-owned save command and projection", () => {
    const workId = entityId<"Work">("work-a");
    const defaults = createDefaultWorkManuscriptLayoutSettingsProjection(
      workId,
      profile,
    );
    const command = parseSaveWorkManuscriptLayoutSettingsCommand({
      schemaVersion: 1,
      workId,
      expectedRevision: defaults.revision,
      settings: defaults.settings,
    });

    expect(parseWorkManuscriptLayoutSettingsProjection({
      ...defaults,
      revision: command.expectedRevision + 1,
      settings: command.settings,
    })).toEqual({
      ...defaults,
      revision: 1,
    });
  });
});
