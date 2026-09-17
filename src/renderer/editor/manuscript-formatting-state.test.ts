import { history, redo, undo } from "@codemirror/commands";
import { EditorSelection, EditorState } from "@codemirror/state";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createDefaultManuscriptEditorDocumentState,
  parseManuscriptFormattingProfile,
} from "../../application/editor/manuscript-formatting";
import {
  activeManuscriptFormattingEqual,
  createManuscriptFormattingExtension,
  readManuscriptEditorDocumentState,
  setManuscriptContentWidthEffect,
  setManuscriptFontFamilyEffect,
  setManuscriptFontSizeEffect,
  setManuscriptHighlightColorEffect,
  setManuscriptLetterSpacingEffect,
  setManuscriptLineHeightEffect,
  setManuscriptParagraphAlignmentEffect,
  setManuscriptParagraphSpacingEffect,
  setManuscriptTextColorEffect,
  toggleManuscriptStyleEffect,
  transactionChangesManuscriptDocumentFormatting,
  transactionChangesManuscriptLayoutSettings,
} from "./manuscript-formatting-state";

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

function createState() {
  const formattingProfile = profile();
  return {
    formattingProfile,
    state: EditorState.create({
      doc: "가나다라마바사",
      selection: EditorSelection.single(1, 4),
      extensions: [
        history(),
        createManuscriptFormattingExtension(
          formattingProfile,
          createDefaultManuscriptEditorDocumentState(formattingProfile),
        ),
      ],
    }),
  };
}

describe("manuscript formatting state", () => {
  it("keeps equivalent active formatting referentially stable for text input", () => {
    const activeFormatting = {
      bold: false,
      italic: false,
      underline: false,
      fontFamilyId: "font-default",
      fontSizePx: 16,
      textColor: "#111111",
      highlightColor: null,
      contentWidthPx: 720,
      lineHeight: 1.7,
      paragraphSpacingPx: 8,
      letterSpacingEm: 0,
      paragraphAlignment: "left" as const,
    };

    expect(activeManuscriptFormattingEqual(
      activeFormatting,
      { ...activeFormatting },
    )).toBe(true);
    expect(activeManuscriptFormattingEqual(
      activeFormatting,
      { ...activeFormatting, bold: true },
    )).toBe(false);
  });

  it("applies the font to the manuscript body and keeps emphasis on the exact selection", () => {
    const { formattingProfile, state } = createState();
    const fontFamilyId = formattingProfile.fontFamilies[1]?.id;
    if (fontFamilyId === undefined) {
      throw new Error("The test formatting profile needs a second font");
    }
    const fontSizePx = formattingProfile.fontSizesPx.at(-2);
    if (fontSizePx === undefined) {
      throw new Error("The test formatting profile needs another font size");
    }

    const next = state.update({
      effects: [
        toggleManuscriptStyleEffect.of("bold"),
        toggleManuscriptStyleEffect.of("italic"),
        toggleManuscriptStyleEffect.of("underline"),
        setManuscriptFontFamilyEffect.of(fontFamilyId),
        setManuscriptFontSizeEffect.of(fontSizePx),
        setManuscriptTextColorEffect.of("#7d2f2f"),
        setManuscriptHighlightColorEffect.of("#fff0a8"),
      ],
    }).state;

    const documentState = readManuscriptEditorDocumentState(next);
    expect(documentState.fontFamilyId).toBe(fontFamilyId);
    expect(documentState.fontSizePx).toBe(fontSizePx);
    expect(documentState.ranges).toEqual([
      {
        from: 1,
        to: 4,
        style: {
          bold: true,
          italic: true,
          underline: true,
          textColor: "#7d2f2f",
          highlightColor: "#fff0a8",
        },
      },
    ]);
  });

  it("keeps formatting and manuscript width in the same undo history", () => {
    const { formattingProfile, state } = createState();
    const width =
      formattingProfile.defaults.contentWidthPx +
      formattingProfile.contentWidthRangePx.step;
    const lineHeight = formattingProfile.lineHeights[1];
    const paragraphSpacingPx = formattingProfile.paragraphSpacingsPx[1];
    const letterSpacingEm = formattingProfile.letterSpacingsEm[1];
    if (
      lineHeight === undefined ||
      paragraphSpacingPx === undefined ||
      letterSpacingEm === undefined
    ) {
      throw new Error("The test formatting profile needs typography choices");
    }
    let current = state.update({
      effects: [
        toggleManuscriptStyleEffect.of("bold"),
        setManuscriptContentWidthEffect.of(width),
        setManuscriptLineHeightEffect.of(lineHeight),
        setManuscriptParagraphSpacingEffect.of(paragraphSpacingPx),
        setManuscriptLetterSpacingEffect.of(letterSpacingEm),
        setManuscriptParagraphAlignmentEffect.of("center"),
      ],
    }).state;
    expect(readManuscriptEditorDocumentState(current)).toMatchObject({
      contentWidthPx: width,
      lineHeight,
      paragraphSpacingPx,
      letterSpacingEm,
      paragraphAlignments: [{ at: 0, alignment: "center" }],
      ranges: [{ from: 1, to: 4, style: { bold: true } }],
    });

    undo({
      state: current,
      dispatch: (transaction) => {
        current = transaction.state;
      },
    });
    expect(readManuscriptEditorDocumentState(current)).toEqual(
      createDefaultManuscriptEditorDocumentState(formattingProfile),
    );

    redo({
      state: current,
      dispatch: (transaction) => {
        current = transaction.state;
      },
    });
    expect(readManuscriptEditorDocumentState(current)).toMatchObject({
      contentWidthPx: width,
      lineHeight,
      paragraphSpacingPx,
      letterSpacingEm,
      paragraphAlignments: [{ at: 0, alignment: "center" }],
      ranges: [{ from: 1, to: 4, style: { bold: true } }],
    });
  });

  it("separates Work layout changes from document-owned formatting changes", () => {
    const { formattingProfile, state } = createState();
    const layoutTransaction = state.update({
      effects: setManuscriptContentWidthEffect.of(
        formattingProfile.defaults.contentWidthPx +
          formattingProfile.contentWidthRangePx.step,
      ),
    });
    expect(transactionChangesManuscriptLayoutSettings(layoutTransaction))
      .toBe(true);
    expect(transactionChangesManuscriptDocumentFormatting(layoutTransaction))
      .toBe(false);

    const documentTransaction = state.update({
      effects: setManuscriptParagraphAlignmentEffect.of("center"),
    });
    expect(transactionChangesManuscriptLayoutSettings(documentTransaction))
      .toBe(false);
    expect(
      transactionChangesManuscriptDocumentFormatting(documentTransaction),
    ).toBe(true);
  });
});
