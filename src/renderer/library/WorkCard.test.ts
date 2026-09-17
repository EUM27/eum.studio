import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DocumentCompletionProjection } from "../../application/workspace/document-completion";
import type { WorkCoverProjection } from "../../application/workspace/work-covers";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../domain/writing";
import { WorkCard } from "./WorkCard";

function incompleteCompletion(
  documentId: EntityId<"Document">,
): DocumentCompletionProjection {
  return Object.freeze({
    schemaVersion: 1,
    workId: entityId<"Work">("work-1"),
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

describe("WorkCard", () => {
  it("keeps the existing Work card markup contract", () => {
    const firstDocumentId = entityId<"Document">("document-1");
    const activeDocumentId = entityId<"Document">("document-2");
    const work: WorkspaceWorkSummary = Object.freeze({
      workId: entityId<"Work">("work-1"),
      title: "별의 기록",
      updatedAt: "2026-08-23T00:00:00.000Z",
      folders: Object.freeze([]),
      documents: Object.freeze([
        Object.freeze({
          documentId: firstDocumentId,
          title: "1회차",
          currentRevisionId: entityId<"DocumentRevision">("revision-1"),
          folderId: null,
          completion: incompleteCompletion(firstDocumentId),
        }),
        Object.freeze({
          documentId: activeDocumentId,
          title: "2회차",
          currentRevisionId: entityId<"DocumentRevision">("revision-2"),
          folderId: null,
          completion: incompleteCompletion(activeDocumentId),
        }),
      ]),
    });
    const cover: WorkCoverProjection = Object.freeze({
      schemaVersion: 1,
      workId: work.workId,
      mediaType: "image/png",
      contentBase64: "Y292ZXI=",
    });

    const markup = renderToStaticMarkup(createElement(WorkCard, {
      activeDocumentId,
      cover,
      disabled: false,
      favorite: true,
      onOpen: vi.fn(),
      onOpenSchedule: vi.fn(),
      onRename: vi.fn(),
      onRetire: vi.fn(),
      onSelectCover: vi.fn(),
      onToggleFavorite: vi.fn(),
      schedule: {
        todayCount: 2,
        nearestDday: {
          label: "마감",
          days: 3,
        },
      },
      work,
    }));

    expect(markup).toContain('<article class="library-work-card">');
    expect(markup).toContain('aria-label="별의 기록 표지 이미지 등록"');
    expect(markup).toContain('class="work-cover-image"');
    expect(markup).toContain('src="data:image/png;base64,Y292ZXI="');
    expect(markup).toContain('aria-label="별의 기록 즐겨찾기 해제"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('class="work-favorite-button is-active"');
    expect(markup).toContain('aria-label="별의 기록 작품 이름 변경"');
    expect(markup).toContain('aria-label="별의 기록 작품 삭제"');
    expect(markup).toContain('aria-label="별의 기록 작품 열기"');
    expect(markup).toContain('class="work-card-title">별의 기록</strong>');
    expect(markup).toContain('aria-label="별의 기록 일정 열기"');
    expect(markup).toContain("오늘 2");
    expect(markup).toContain('title="마감">D-3</span>');
    expect(markup).toContain('aria-label="별의 기록 회차 선택"');
    expect(markup).toContain('class="work-document-select"');
    expect(markup).toContain('<option value="document-1">1회차</option>');
    expect(markup).toContain(
      '<option value="document-2" selected="">2회차</option>',
    );
  });
});
