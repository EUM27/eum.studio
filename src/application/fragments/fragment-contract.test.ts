import { describe, expect, it } from "vitest";

import {
  parseCaptureFragmentCommand,
  parseFragmentListProjection,
  parseFragmentProjection,
  parseFragmentShelfProfile,
  parseRecordFragmentUseCommand,
  parseRetireFragmentCommand,
  parseUpdateFragmentCommand,
} from "./fragment-contract";

describe("fragment shelf contract", () => {
  it("parses data-driven fragment kinds without treating fixture values as product limits", () => {
    expect(parseFragmentShelfProfile({
      schemaVersion: 1,
      defaultKindId: "sentence",
      kinds: [
        { id: "sentence", label: "문장" },
        { id: "idea", label: "아이디어" },
        { id: "dialogue", label: "대사" },
      ],
    })).toEqual({
      schemaVersion: 1,
      defaultKindId: "sentence",
      kinds: [
        { id: "sentence", label: "문장" },
        { id: "idea", label: "아이디어" },
        { id: "dialogue", label: "대사" },
      ],
    });
  });

  it("preserves the exact directional selection and captured text", () => {
    expect(parseCaptureFragmentCommand({
      schemaVersion: 1,
      workId: "work-a",
      documentId: "document-a",
      selection: { anchor: 9, head: 2 },
      exactText: "  그대로\n",
      kindId: "sentence",
      title: "",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      documentId: "document-a",
      selection: { anchor: 9, head: 2 },
      exactText: "  그대로\n",
      kindId: "sentence",
      title: "",
    });
  });

  it("rejects empty selections and unsupported capture fields", () => {
    expect(() => parseCaptureFragmentCommand({
      schemaVersion: 1,
      workId: "work-a",
      documentId: "document-a",
      selection: { anchor: 2, head: 2 },
      exactText: "본문",
      kindId: "sentence",
      title: "",
    })).toThrow("selection must not be empty");
    expect(() => parseCaptureFragmentCommand({
      schemaVersion: 1,
      workId: "work-a",
      documentId: "document-a",
      selection: { anchor: 0, head: 2 },
      exactText: "본문",
      kindId: "sentence",
      title: "",
      removeFromManuscript: true,
    })).toThrow("Unsupported CaptureFragmentCommand field");
  });

  it("parses explicit optimistic metadata changes and retirement", () => {
    expect(parseUpdateFragmentCommand({
      schemaVersion: 1,
      workId: "work-a",
      fragmentId: "fragment-a",
      expectedRevision: 3,
      changes: { title: "새 이름", pinned: true },
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      fragmentId: "fragment-a",
      expectedRevision: 3,
      changes: { title: "새 이름", pinned: true },
    });
    expect(parseRetireFragmentCommand({
      schemaVersion: 1,
      workId: "work-a",
      fragmentId: "fragment-a",
      expectedRevision: 4,
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      fragmentId: "fragment-a",
      expectedRevision: 4,
    });
    expect(() => parseUpdateFragmentCommand({
      schemaVersion: 1,
      workId: "work-a",
      fragmentId: "fragment-a",
      expectedRevision: 3,
      changes: {},
    })).toThrow("changes must contain at least one field");
  });

  it("records a fragment use only through an explicit optimistic command", () => {
    expect(parseRecordFragmentUseCommand({
      schemaVersion: 1,
      workId: "work-a",
      fragmentId: "fragment-a",
      expectedRevision: 4,
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      fragmentId: "fragment-a",
      expectedRevision: 4,
    });
  });

  it("requires a range only for resolved source anchors", () => {
    const base = {
      schemaVersion: 1,
      fragmentId: "fragment-a",
      revision: 1,
      workId: "work-a",
      sourceDocumentId: "document-a",
      sourceDocumentRevisionId: "revision-a",
      sourceAnchorId: "anchor-a",
      kindId: "sentence",
      title: "",
      pinned: false,
      useCount: 0,
      exactText: "정확한 원문",
      createdAt: "2026-08-09T00:00:00.000Z",
      updatedAt: "2026-08-09T00:00:00.000Z",
      retiredAt: null,
    };
    expect(parseFragmentProjection({
      ...base,
      integrity: "resolved",
      range: { from: 3, to: 9 },
    }).range).toEqual({ from: 3, to: 9 });
    expect(parseFragmentProjection({
      ...base,
      integrity: "needsReview",
      range: null,
    }).integrity).toBe("needsReview");
    expect(() => parseFragmentProjection({
      ...base,
      integrity: "broken",
      range: { from: 3, to: 9 },
    })).toThrow("range must be null when unresolved");
  });

  it("rejects a fragment list containing another Work", () => {
    expect(() => parseFragmentListProjection({
      schemaVersion: 1,
      workId: "work-a",
      fragments: [{
        schemaVersion: 1,
        fragmentId: "fragment-b",
        revision: 1,
        workId: "work-b",
        sourceDocumentId: "document-b",
        sourceDocumentRevisionId: "revision-b",
        sourceAnchorId: "anchor-b",
        kindId: "idea",
        title: "",
        pinned: false,
        useCount: 0,
        exactText: "다른 작품",
        integrity: "resolved",
        range: { from: 0, to: 5 },
        createdAt: "2026-08-09T00:00:00.000Z",
        updatedAt: "2026-08-09T00:00:00.000Z",
        retiredAt: null,
      }],
    })).toThrow("outside Work work-a");
  });
});
