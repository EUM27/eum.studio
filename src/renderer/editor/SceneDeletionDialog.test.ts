import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import { SceneDeletionDialog } from "./SceneDeletionDialog";

describe("SceneDeletionDialog", () => {
  it("shows exact deletion excerpts, character count, episodes, and metadata", () => {
    const markup = renderToStaticMarkup(createElement(SceneDeletionDialog, {
      preview: {
        schemaVersion: 1,
        previewFingerprint: "sha256:preview",
        workId: entityId<"Work">("work-dialog"),
        target: {
          sceneId: entityId<"Scene">("scene-dialog"),
          documentId: entityId<"Document">("document-dialog"),
          sceneKey: "scene-dialog-key",
        },
        sceneRuleSetRevision: 1,
        documents: [{
          documentId: entityId<"Document">("document-dialog"),
          documentTitle: "첫 회차",
          expectedDocumentRevisionId:
            entityId<"DocumentRevision">("revision-dialog"),
          sceneKey: "scene-dialog-key",
          sceneRange: { start: 0, end: 4 },
          deletionRange: { start: 0, end: 8 },
          removedBoundaryAnchorId: entityId<"Anchor">("boundary-dialog"),
          sceneContentUtf16Length: 4,
          deletedUtf16Length: 8,
          firstExcerpt: "첫 문장",
          lastExcerpt: "마지막 문장",
        }],
        metadata: [{ kind: "event", metadataId: "event-a", label: "문이 열린다" }],
      },
      busy: false,
      error: null,
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
    }));

    expect(markup).toContain("장면 삭제 미리보기");
    expect(markup).toContain("원고 8자와 장면 경계를 휴지통으로 이동합니다.");
    expect(markup).toContain("첫 회차");
    expect(markup).toContain("처음: 첫 문장");
    expect(markup).toContain("마지막: 마지막 문장");
    expect(markup).toContain("문이 열린다");
    expect(markup).toContain("휴지통으로 이동");
  });

  it("renders nothing before an authoritative preview exists", () => {
    expect(renderToStaticMarkup(createElement(SceneDeletionDialog, {
      preview: null,
      busy: false,
      error: null,
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
    }))).toBe("");
  });
});
