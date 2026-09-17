import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  countQuickMemoCharacters,
  QuickToolsDialog,
} from "./QuickToolsDialog";

describe("QuickToolsDialog", () => {
  it("renders commands, Works, Documents, and an on-demand active Work memo control", () => {
    const workId = entityId<"Work">("work-1");
    const documentId = entityId<"Document">("document-1");
    const markup = renderToStaticMarkup(
      createElement(QuickToolsDialog, {
        client: {
          getMemo: async () => {
            throw new Error("Static render must not load a memo");
          },
          saveMemo: async () => {
            throw new Error("Static render must not save a memo");
          },
        },
        catalog: {
          schemaVersion: 1,
          works: [{
            workId,
            title: "유리 정원",
            updatedAt: "2026-08-10T00:00:00.000Z",
            folders: [],
            documents: [{
              documentId,
              title: "재회",
              currentRevisionId: entityId<"DocumentRevision">("revision-1"),
              folderId: null,
              completion: {
                schemaVersion: 1,
                workId,
                documentId,
                revision: 0,
                completedAt: null,
                completedDate: null,
                completedTimeZone: null,
                completedDocumentRevisionId: null,
                state: "incomplete",
                updatedAt: null,
              },
            }],
          }],
          activeWorkId: workId,
          activeDocumentId: documentId,
          canCreateFirstWork: false,
        },
        disabled: false,
        onClose: () => undefined,
        onSelect: () => undefined,
      }),
    );

    expect(markup).toContain("빠른 도구");
    expect(markup).toContain("메인 열기");
    expect(markup).toContain("새 작품 만들기");
    expect(markup).toContain("유리 정원");
    expect(markup).toContain("재회");
    expect(markup).toContain("빠른 메모 열기");
    expect(markup).toContain('aria-label="메인 명령"');
    expect(markup).toContain('aria-label="유리 정원 작품과 회차"');
    expect(markup).toContain("quick-tool-document-result");
    expect(markup.indexOf("메인 열기")).toBeLessThan(
      markup.indexOf("유리 정원"),
    );
    expect(markup.indexOf("유리 정원")).toBeLessThan(
      markup.indexOf("재회"),
    );
    expect(markup.indexOf("재회")).toBeLessThan(
      markup.indexOf("새 작품 만들기"),
    );
  });

  it("counts visible grapheme clusters instead of UTF-16 offsets", () => {
    expect(countQuickMemoCharacters("한👨‍👩‍👧‍👦e\u0301")).toBe(3);
  });
});
