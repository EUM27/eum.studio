import { describe, expect, it, vi } from "vitest";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import { entityId } from "../../../domain/writing";
import { submitCanonReviewSelection } from "./useWorkspaceManuscriptActionsController";

const document: ManuscriptDocumentSource = Object.freeze({
  workId: entityId<"Work">("work-canon-selection"),
  documentId: entityId<"Document">("document-canon-selection"),
  documentRevisionId: entityId<"DocumentRevision">("revision-before-save"),
  label: "1화",
  initialText: "앞부분 정확한 선택 원문 뒷부분",
});
const selection = Object.freeze({
  from: 4,
  to: 12,
  exactText: "정확한 선택 원",
});

describe("submitCanonReviewSelection", () => {
  it("persists first and submits the same exact range against the durable revision", async () => {
    const order: string[] = [];
    const persistDocument = vi.fn(async () => {
      order.push("persist");
    });
    const openReview = vi.fn(() => {
      order.push("open-review");
    });
    const runReview = vi.fn(async () => {
      order.push("run");
    });

    await expect(submitCanonReviewSelection({
      document,
      selection,
      editor: {
        isDocumentComposing: () => false,
        materializeDocumentText: () => document.initialText,
      },
      getCurrentRevisionId: () =>
        entityId<"DocumentRevision">("revision-after-save"),
      openReview,
      persistDocument,
      runReview,
    })).resolves.toEqual({ status: "submitted" });

    expect(order).toEqual(["persist", "open-review", "run"]);
    expect(runReview).toHaveBeenCalledWith({
      documentId: document.documentId,
      documentRevisionId: "revision-after-save",
      from: selection.from,
      to: selection.to,
    });
  });

  it("blocks composition without saving or invoking the model", async () => {
    const persistDocument = vi.fn(async () => undefined);
    const runReview = vi.fn(async () => undefined);
    await expect(submitCanonReviewSelection({
      document,
      selection,
      editor: {
        isDocumentComposing: () => true,
        materializeDocumentText: () => document.initialText,
      },
      getCurrentRevisionId: () => document.documentRevisionId,
      openReview: vi.fn(),
      persistDocument,
      runReview,
    })).resolves.toEqual({ status: "composition-active" });
    expect(persistDocument).not.toHaveBeenCalled();
    expect(runReview).not.toHaveBeenCalled();
  });

  it("blocks a stale or widened source range before persistence", async () => {
    const persistDocument = vi.fn(async () => undefined);
    const runReview = vi.fn(async () => undefined);
    await expect(submitCanonReviewSelection({
      document,
      selection: { ...selection, exactText: "다른 원문" },
      editor: {
        isDocumentComposing: () => false,
        materializeDocumentText: () => document.initialText,
      },
      getCurrentRevisionId: () => document.documentRevisionId,
      openReview: vi.fn(),
      persistDocument,
      runReview,
    })).resolves.toEqual({ status: "selection-stale" });
    expect(persistDocument).not.toHaveBeenCalled();
    expect(runReview).not.toHaveBeenCalled();
  });
});
