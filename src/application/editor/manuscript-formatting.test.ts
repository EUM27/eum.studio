import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createDefaultManuscriptEditorDocumentState,
  parseManuscriptEditorDocumentState,
  parseManuscriptFormattingProfile,
  parseSaveManuscriptFormattingCommand,
  serializeManuscriptEditorDocumentState,
} from "./manuscript-formatting";

function profile() {
  return parseManuscriptFormattingProfile(
    JSON.parse(
      readFileSync(
        join(process.cwd(), "config", "manuscript-formatting.json"),
        "utf8",
      ),
    ),
  );
}

describe("manuscript formatting contract", () => {
  it("loads the configured fonts, sizes and manuscript widths", () => {
    const parsed = profile();

    expect(parsed.fontFamilies.map((font) => font.label)).toEqual([
      "마루부리",
      "리디바탕",
      "나눔명조",
      "프리텐다드",
      "나눔고딕",
    ]);
    expect(parsed.fontSizesPx).toContain(parsed.defaults.fontSizePx);
    expect(parsed.defaults.contentWidthPx).toBeGreaterThanOrEqual(
      parsed.contentWidthRangePx.min,
    );
    expect(parsed.defaults.contentWidthPx).toBeLessThanOrEqual(
      parsed.contentWidthRangePx.max,
    );
    expect(
      (parsed.defaults.contentWidthPx - parsed.contentWidthRangePx.min) %
        parsed.contentWidthRangePx.step,
    ).toBe(0);
    expect(
      parsed.fontFamilies.some(
        (font) => font.id === parsed.defaults.fontFamilyId,
      ),
    ).toBe(true);
  });

  it("round-trips exact styled manuscript ranges with document width", () => {
    const formattingProfile = profile();
    const state = parseManuscriptEditorDocumentState(
      {
        schemaVersion: 1,
        ranges: [
          {
            from: 2,
            to: 7,
            style: {
              bold: true,
              italic: true,
              underline: true,
              fontFamilyId: formattingProfile.fontFamilies[1]?.id,
              fontSizePx: formattingProfile.fontSizesPx[2],
              textColor: "#7d2f2f",
              highlightColor: "#fff0a8",
            },
          },
        ],
        contentWidthPx:
          formattingProfile.defaults.contentWidthPx +
          formattingProfile.contentWidthRangePx.step,
        lineHeight: formattingProfile.lineHeights[1],
        paragraphSpacingPx: formattingProfile.paragraphSpacingsPx[1],
        letterSpacingEm: formattingProfile.letterSpacingsEm[1],
        paragraphAlignments: [{ at: 0, alignment: "center" }],
      },
      formattingProfile,
      9,
    );

    expect(
      parseManuscriptEditorDocumentState(
        JSON.parse(serializeManuscriptEditorDocumentState(state)),
        formattingProfile,
        9,
      ),
    ).toEqual(state);
  });

  it("creates a format-save command tied to one exact document revision", () => {
    const formattingProfile = profile();
    const workId = randomUUID();
    const documentId = randomUUID();
    const revisionId = randomUUID();

    expect(
      parseSaveManuscriptFormattingCommand({
        schemaVersion: 1,
        workId,
        documentId,
        expectedCurrentRevisionId: revisionId,
        editorStateJson: serializeManuscriptEditorDocumentState(
          createDefaultManuscriptEditorDocumentState(formattingProfile),
        ),
      }),
    ).toMatchObject({
      workId,
      documentId,
      expectedCurrentRevisionId: revisionId,
    });
  });
});
