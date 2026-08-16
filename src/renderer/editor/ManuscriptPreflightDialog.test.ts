import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parseManuscriptPreflightProfile } from "../../application/editor/manuscript-preflight";
import { entityId } from "../../domain/writing";
import { ManuscriptPreflightDialog } from "./ManuscriptPreflightDialog";

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
    regexCaseSensitive: false,
    regexMultiline: false,
  },
  limits: {
    tabWidth: { min: 1, max: 16 },
    maxConsecutiveBlankLines: { min: 0, max: 8 },
  },
});

describe("ManuscriptPreflightDialog", () => {
  it("opens on the exact non-empty selection and exposes explicit preview actions", () => {
    const workId = entityId<"Work">("work-1");
    const markup = renderToStaticMarkup(
      createElement(ManuscriptPreflightDialog, {
        documentLabel: "2화",
        manuscript: "앞부분\n선택 원고  \n뒷부분",
        onApply: () => true,
        onClose: () => undefined,
        onExport: async () => ({
          schemaVersion: 1 as const,
          status: "cancelled" as const,
        }),
        onSaveSettings: async (settings) => ({
          schemaVersion: 1,
          workId,
          revision: 1,
          settings,
        }),
        profile,
        selection: { from: 4, to: 13 },
        settingsProjection: {
          schemaVersion: 1,
          workId,
          revision: 0,
          settings: profile.defaults,
        },
      }),
    );

    expect(markup).toContain("data-range-from=\"4\"");
    expect(markup).toContain("data-range-to=\"13\"");
    expect(markup).toContain("선택 범위");
    expect(markup).toContain("checked=\"\"");
    expect(markup).toContain("모든 문단 사이에 빈 줄 한 줄 추가");
    expect(markup).toContain("미리보기 만들기");
    expect(markup).toContain("TXT 내보내기");
    expect(markup).toContain("이 변경 적용");
  });
});
