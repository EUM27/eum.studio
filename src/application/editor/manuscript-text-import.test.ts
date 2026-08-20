import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  normalizeImportedManuscriptText,
  parseManuscriptTextImportResult,
  parseSelectManuscriptTextImportCommand,
} from "./manuscript-text-import";

describe("manuscript text import", () => {
  it("keeps the selected Work, Document, and revision exact", () => {
    const command = {
      schemaVersion: 1,
      workId: randomUUID(),
      documentId: randomUUID(),
      documentRevisionId: randomUUID(),
    } as const;

    expect(parseSelectManuscriptTextImportCommand(command)).toEqual(command);
    expect(
      parseManuscriptTextImportResult({
        ...command,
        status: "selected",
        fileName: "원고.txt",
        text: "첫 줄\n둘째 줄",
        byteLength: 21,
      }),
    ).toMatchObject({ ...command, status: "selected", fileName: "원고.txt" });
  });

  it("normalizes operating-system newlines without Unicode normalization", () => {
    const decomposed = "e\u0301";
    expect(normalizeImportedManuscriptText(`첫 줄\r\n둘째 줄\r${decomposed}`)).toBe(
      `첫 줄\n둘째 줄\n${decomposed}`,
    );
    expect(decomposed).not.toBe("é");
  });
});
