import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { LocalWorkspaceBackupStatusProjection } from "../../application/storage/local-workspace-backup-contract";
import type { DocumentCompletionProjection } from "../../application/workspace/document-completion";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../domain/writing";
import {
  BackupDialog,
  CreateWorkDialog,
  ImportRehearsalDialog,
  RenameWorkDialog,
} from "./StudioShellDialogs";

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

describe("StudioShellDialogs", () => {
  it("keeps the existing backup dialog markup contract", () => {
    const status: LocalWorkspaceBackupStatusProjection = Object.freeze({
      schemaVersion: 1,
      lastVerified: Object.freeze({
        schemaVersion: 1,
        mode: "complete",
        bundlePath: "backup-bundle",
        targetPath: "restore-target",
        createdAt: "2026-08-23T00:00:00.000Z",
        verifiedAt: "2026-08-23T00:01:00.000Z",
        lastAction: "restored",
        counts: Object.freeze({
          workCount: 2,
          documentCount: 3,
          revisionCount: 4,
          resumeCheckpointCount: 1,
          writingSessionCount: 5,
        }),
        media: Object.freeze({
          managedFileCount: 2,
          externalReferenceCount: 1,
          disconnectedExternalReferenceCount: 1,
          managedByteLength: 1024,
        }),
      }),
    });
    const markup = renderToStaticMarkup(createElement(BackupDialog, {
      actionState: "idle",
      error: "백업 오류",
      onCancel: vi.fn(),
      onCreate: vi.fn(),
      onRestore: vi.fn(),
      status,
    }));

    expect(markup).toContain('class="dialog-backdrop"');
    expect(markup).toContain('aria-labelledby="backup-heading"');
    expect(markup).toContain('class="create-work-dialog backup-dialog"');
    expect(markup).toContain('aria-label="백업 닫기"');
    expect(markup).toContain('aria-label="마지막 검증된 백업"');
    expect(markup).toContain("새 위치 복원 완료");
    expect(markup).toContain("backup-bundle");
    expect(markup).toContain("restore-target");
    expect(markup).toContain('class="dialog-error" role="alert"');
    expect(markup).toContain("백업 오류");
    expect(markup).toContain("새 위치에 복원");
    expect(markup).toContain("새 백업");
    expect(markup).toContain("앱에 가져온 MP3·MP4");
    expect(markup).toContain("가져온 미디어");
    expect(markup).toContain("연결 끊김");
  });

  it("keeps the existing import rehearsal dialog markup contract", () => {
    const markup = renderToStaticMarkup(createElement(ImportRehearsalDialog, {
      error: "가져오기 오류",
      onCancel: vi.fn(),
      onRun: vi.fn(),
      running: false,
      summary: null,
    }));

    expect(markup).toContain('aria-labelledby="import-rehearsal-heading"');
    expect(markup).toContain(
      'class="create-work-dialog import-rehearsal-dialog"',
    );
    expect(markup).toContain('aria-label="기존 작업 가져오기 닫기"');
    expect(markup).toContain("기존 작업 가져오기");
    expect(markup).toContain("현재 작업실에는 합치지 않습니다.");
    expect(markup).toContain("receipt 누락 여부를 함께 검증합니다.");
    expect(markup).toContain('class="dialog-error" role="alert"');
    expect(markup).toContain("가져오기 오류");
    expect(markup).toContain("읽기 전용 리허설 실행");
  });

  it("keeps the existing create Work dialog markup contract", () => {
    const markup = renderToStaticMarkup(createElement(CreateWorkDialog, {
      error: "작품 생성 오류",
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      submitting: false,
    }));

    expect(markup).toContain('aria-labelledby="create-work-heading"');
    expect(markup).toContain('class="create-work-dialog"');
    expect(markup).toContain('aria-label="새 작품 만들기 닫기"');
    expect(markup).toContain("새 작품 만들기");
    expect(markup).toContain('placeholder="작품 제목을 입력하세요"');
    expect(markup).toContain('placeholder="비우면 제목없음"');
    expect(markup).toContain('aria-live="polite" class="dialog-error"');
    expect(markup).toContain("작품 생성 오류");
    expect(markup).toContain("취소");
    expect(markup).toContain('class="primary-button" disabled=""');
    expect(markup).toContain("작품 만들기");
  });

  it("keeps the existing rename Work dialog markup contract", () => {
    const workId = entityId<"Work">("work-1");
    const documentId = entityId<"Document">("document-1");
    const work: WorkspaceWorkSummary = Object.freeze({
      workId,
      title: "기존 작품",
      updatedAt: "2026-08-23T00:00:00.000Z",
      folders: Object.freeze([]),
      documents: Object.freeze([
        Object.freeze({
          documentId,
          title: "1회차",
          currentRevisionId: entityId<"DocumentRevision">("revision-1"),
          folderId: null,
          completion: incompleteCompletion(workId, documentId),
        }),
      ]),
    });
    const markup = renderToStaticMarkup(createElement(RenameWorkDialog, {
      error: "이름 변경 오류",
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      submitting: false,
      work,
    }));

    expect(markup).toContain('aria-labelledby="rename-work-heading"');
    expect(markup).toContain(
      'class="create-work-dialog rename-work-dialog"',
    );
    expect(markup).toContain('aria-label="작품 이름 변경 닫기"');
    expect(markup).toContain("작품 이름 변경");
    expect(markup).toContain('value="기존 작품"');
    expect(markup).toContain('aria-live="polite" class="dialog-error"');
    expect(markup).toContain("이름 변경 오류");
    expect(markup).toContain("취소");
    expect(markup).toContain("변경");
  });
});
