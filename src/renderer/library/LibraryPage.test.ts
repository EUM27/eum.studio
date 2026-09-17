import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import type { DocumentCompletionProjection } from "../../application/workspace/document-completion";
import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../domain/writing";
import type { ManuscriptResumePreview } from "../App";
import { LibraryPage } from "./LibraryPage";

function incompleteCompletion(
  workId: EntityId<"Work">,
  documentId: EntityId<"Document">,
): DocumentCompletionProjection {
  return Object.freeze({
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
  });
}

describe("LibraryPage", () => {
  it("keeps the existing library home markup contract", () => {
    const firstWorkId = entityId<"Work">("work-1");
    const firstDocumentId = entityId<"Document">("document-1");
    const activeDocumentId = entityId<"Document">("document-2");
    const secondWorkId = entityId<"Work">("work-2");
    const secondDocumentId = entityId<"Document">("document-3");
    const firstWork: WorkspaceWorkSummary = Object.freeze({
      workId: firstWorkId,
      title: "별의 기록",
      updatedAt: "2026-08-23T00:00:00.000Z",
      folders: Object.freeze([]),
      documents: Object.freeze([
        Object.freeze({
          documentId: firstDocumentId,
          title: "1회차",
          currentRevisionId: entityId<"DocumentRevision">("revision-1"),
          folderId: null,
          completion: incompleteCompletion(firstWorkId, firstDocumentId),
        }),
        Object.freeze({
          documentId: activeDocumentId,
          title: "2회차",
          currentRevisionId: entityId<"DocumentRevision">("revision-2"),
          folderId: null,
          completion: incompleteCompletion(firstWorkId, activeDocumentId),
        }),
      ]),
    });
    const secondWork: WorkspaceWorkSummary = Object.freeze({
      workId: secondWorkId,
      title: "달의 기록",
      updatedAt: "2026-08-22T00:00:00.000Z",
      folders: Object.freeze([]),
      documents: Object.freeze([
        Object.freeze({
          documentId: secondDocumentId,
          title: "프롤로그",
          currentRevisionId: entityId<"DocumentRevision">("revision-3"),
          folderId: null,
          completion: incompleteCompletion(secondWorkId, secondDocumentId),
        }),
      ]),
    });
    const catalog: WorkspaceCatalogProjection = Object.freeze({
      schemaVersion: 1,
      works: Object.freeze([firstWork, secondWork]),
      activeWorkId: firstWorkId,
      activeDocumentId,
      canCreateFirstWork: false,
    });
    const schedule: WorkCalendarProjection = Object.freeze({
      schemaVersion: 1,
      workId: firstWorkId,
      range: Object.freeze({ from: "2026-08-23", to: "2026-08-23" }),
      items: Object.freeze([]),
      occurrences: Object.freeze([]),
      episodeProgress: Object.freeze({
        defaultEpisodeCharacters: 1,
        totalCharacters: 0,
        totalEpisodeCount: 0,
        completedEpisodeCount: 0,
        completedEpisodeNumbers: Object.freeze([]),
      }),
      completedDocumentCount: 0,
    });
    const resumePreview: ManuscriptResumePreview = Object.freeze({
      workId: firstWorkId,
      documentId: activeDocumentId,
      text: "첫 문장\n\n둘째 문장",
      formatting: Object.freeze({
        fontFamily: "serif",
        fontSizePx: 16,
        contentWidthPx: 720,
        lineHeight: 1.8,
        paragraphSpacingPx: 12,
        letterSpacingEm: 0.02,
      }),
    });

    const markup = renderToStaticMarkup(createElement(LibraryPage, {
      backupBusy: false,
      busy: false,
      catalog,
      error: "작업 오류",
      favoriteWorkIds: [secondWorkId],
      importBusy: false,
      onMoveDocument: vi.fn(),
      onOpen: vi.fn(),
      onOpenBackup: vi.fn(),
      onOpenCompletedRevision: vi.fn(),
      onOpenImport: vi.fn(),
      onOpenPublishing: vi.fn(),
      onOpenSchedule: vi.fn(),
      onRename: vi.fn(),
      onRetire: vi.fn(),
      onRetireDocument: vi.fn(),
      onSelectCover: vi.fn(),
      onToggleFavorite: vi.fn(),
      resumePreview,
      scheduleByWork: { [firstWorkId]: schedule },
      workCovers: [],
    }));

    expect(markup).toContain('data-layout="eum-studio-library"');
    expect(markup).toContain('class="library-home"');
    expect(markup).toContain('class="resume-strip"');
    expect(markup).toContain("마지막 작업");
    expect(markup).toContain("별의 기록");
    expect(markup).toContain("2회차");
    expect(markup).toContain('aria-label="마지막 원고 미리보기"');
    expect(markup).toContain('data-content-width="720"');
    expect(markup).toContain('data-font-size="16"');
    expect(markup).toContain("첫 문장");
    expect(markup).toContain("둘째 문장");
    expect(markup).toContain('class="resume-strip-action"');
    expect(markup).toContain("이어쓰기");
    expect(markup).toContain('class="today-schedule-panel"');
    expect(markup).toContain("오늘 할 일");
    expect(markup).toContain('aria-label="작품 보기"');
    expect(markup).toContain("전체 2");
    expect(markup).toContain("즐겨찾기 1");
    expect(markup).toContain('placeholder="작품·회차 검색"');
    expect(markup).toContain("최근 편집순");
    expect(markup).toContain('aria-label="작품 도구 열기"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('role="menu"');
    expect(markup).toContain('class="shell-action-error" role="alert"');
    expect(markup).toContain("작업 오류");
    expect(markup).toContain('aria-label="별의 기록 작품 열기"');
    expect(markup).toContain('aria-label="달의 기록 작품 열기"');
    expect(markup).toContain('aria-label="달의 기록 즐겨찾기 해제"');
    expect(markup).toContain(
      '<option value="document-2" selected="">2회차</option>',
    );
  });
});
