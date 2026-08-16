import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  applyManuscriptPreflightReplacement,
  buildManuscriptPreflightPreview,
  createManuscriptPreflightBoundaryContext,
  createDefaultManuscriptPreflightSettings,
  diagnoseManuscriptPreflight,
  parseExportManuscriptTextCommand,
  parseManuscriptPreflightProfile,
  parseSaveManuscriptPreflightSettingsCommand,
  sanitizeManuscriptTextFileNamePart,
} from "./manuscript-preflight";

const profile = parseManuscriptPreflightProfile({
  schemaVersion: 1,
  defaults: {
    trimTrailingWhitespace: true,
    tabReplacement: "preserve",
    tabWidth: 4,
    nonBreakingSpaceReplacement: "space",
    lineEnding: "preserve",
    limitBlankLines: false,
    maxConsecutiveBlankLines: 1,
    forbiddenTerms: [],
    forbiddenCaseSensitive: false,
    regexPattern: "",
    regexCaseSensitive: true,
    regexMultiline: false,
  },
  limits: {
    tabWidth: { min: 1, max: 16 },
    maxConsecutiveBlankLines: { min: 0, max: 8 },
  },
});

describe("manuscript preflight", () => {
  it("derives exact selection boundaries without splitting CRLF", () => {
    const manuscript = "첫 줄\r\n둘째 줄\n셋째 줄";
    expect(
      createManuscriptPreflightBoundaryContext(manuscript, {
        from: 5,
        to: 9,
      }),
    ).toEqual({
      startsAtLineStart: true,
      endsAtLineEnd: true,
    });
    expect(
      createManuscriptPreflightBoundaryContext(manuscript, {
        from: 4,
        to: 4,
      }),
    ).toEqual({
      startsAtLineStart: false,
      endsAtLineEnd: false,
    });
  });

  it("diagnoses mechanical findings and configured searches without changing the source", () => {
    const source = "첫 줄 \t\r\n둘째\u00a0줄\n\n\n금칙어와 장면   전환";
    const settings = {
      ...createDefaultManuscriptPreflightSettings(profile),
      forbiddenTerms: ["금칙어"],
      regexPattern: "장면\\s+전환",
      limitBlankLines: true,
    };

    const report = diagnoseManuscriptPreflight(source, settings);

    expect(report.source).toBe(source);
    expect(report.statistics).toEqual({
      characters: source.length,
      utf8Bytes: new TextEncoder().encode(source).length,
      lines: 5,
    });
    expect(
      Object.fromEntries(
        report.findings.map((finding) => [finding.kind, finding.count]),
      ),
    ).toMatchObject({
      "trailing-whitespace": 1,
      tab: 1,
      "non-breaking-space": 1,
      "mixed-line-ending": 1,
      "excess-blank-line": 1,
      "forbidden-term": 1,
      "regex-match": 1,
    });
    expect(report.regexError).toBeNull();
  });

  it("previews only enabled cleanup rules and preserves incomplete selection boundaries", () => {
    const settings = {
      ...createDefaultManuscriptPreflightSettings(profile),
      tabReplacement: "spaces" as const,
      tabWidth: 2,
      lineEnding: "lf" as const,
      limitBlankLines: true,
    };
    const preview = buildManuscriptPreflightPreview(
      "첫\t줄  \r\n둘째\u00a0줄\r\n\r\n\r\n끝",
      settings,
    );
    expect(preview.result).toBe("첫  줄\n둘째 줄\n\n끝");

    const partialLine = buildManuscriptPreflightPreview(
      "단어   ",
      settings,
      { startsAtLineStart: true, endsAtLineEnd: false },
    );
    expect(partialLine.result).toBe("단어   ");
    expect(
      diagnoseManuscriptPreflight("단어   ", settings, {
        startsAtLineStart: true,
        endsAtLineEnd: false,
      }).findings,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "trailing-whitespace" }),
      ]),
    );
  });

  it("adds one blank line between complete paragraphs without duplicating existing blank lines", () => {
    const settings = createDefaultManuscriptPreflightSettings(profile);

    expect(
      buildManuscriptPreflightPreview(
        "첫 문단\r\n둘째 문단\n\n셋째 문단",
        settings,
        undefined,
        { ensureBlankLineBetweenParagraphs: true },
      ).result,
    ).toBe("첫 문단\r\n\r\n둘째 문단\n\n셋째 문단");

    expect(
      buildManuscriptPreflightPreview(
        "선택 중간\n완전한 문단\n끝 중간",
        settings,
        { startsAtLineStart: false, endsAtLineEnd: false },
        { ensureBlankLineBetweenParagraphs: true },
      ).result,
    ).toBe("선택 중간\n완전한 문단\n끝 중간");
  });

  it("changes only an exact current range and rejects stale or invalid snapshots", () => {
    expect(
      applyManuscriptPreflightReplacement(
        "앞 대상 뒤",
        { from: 2, to: 4 },
        "대상",
        "결과",
      ),
    ).toEqual({ ok: true, value: "앞 결과 뒤", cursor: 4 });
    expect(
      applyManuscriptPreflightReplacement(
        "앞 변경 뒤",
        { from: 2, to: 4 },
        "대상",
        "결과",
      ),
    ).toEqual({ ok: false, reason: "stale" });
    expect(
      applyManuscriptPreflightReplacement(
        "원문",
        { from: 3, to: 1 },
        "",
        "결과",
      ),
    ).toEqual({ ok: false, reason: "invalid-range" });
  });

  it("validates profile-governed Work settings and safe typed text exports", () => {
    const workId = randomUUID();
    const settings = createDefaultManuscriptPreflightSettings(profile);
    expect(
      parseSaveManuscriptPreflightSettingsCommand(
        { schemaVersion: 1, workId, settings },
        profile,
      ),
    ).toMatchObject({ workId, settings });
    expect(() =>
      parseSaveManuscriptPreflightSettingsCommand(
        {
          schemaVersion: 1,
          workId,
          settings: { ...settings, tabWidth: profile.limits.tabWidth.max + 1 },
        },
        profile,
      ),
    ).toThrow("outside the configured range");

    const safeTitle = sanitizeManuscriptTextFileNamePart("작품:회차");
    expect(safeTitle).toBe("작품-회차");
    expect(
      parseExportManuscriptTextCommand({
        schemaVersion: 1,
        workId,
        documentId: randomUUID(),
        suggestedFileName: `${safeTitle}.txt`,
        text: "승인한 원문",
      }),
    ).toMatchObject({ suggestedFileName: `${safeTitle}.txt`, text: "승인한 원문" });
    expect(() =>
      parseExportManuscriptTextCommand({
        schemaVersion: 1,
        workId,
        documentId: randomUUID(),
        suggestedFileName: "../outside.txt",
        text: "원문",
      }),
    ).toThrow("safe file name");
  });
});
