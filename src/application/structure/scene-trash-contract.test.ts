import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  parseDeleteSceneCommand,
  parsePrepareSceneDeletionCommand,
  parseRestoreSceneTrashCommand,
  parseSceneDeletionPreview,
  parseSceneTrashEntryProjection,
} from "./scene-trash-contract";

const workId = entityId<"Work">("work-trash-contract");
const documentId = entityId<"Document">("document-trash-contract");
const revisionId = entityId<"DocumentRevision">("revision-trash-contract");
const sceneId = entityId<"Scene">("scene-trash-contract");

function preview() {
  return {
    schemaVersion: 1,
    previewFingerprint: "sha256:preview",
    workId,
    target: {
      sceneId,
      documentId,
      sceneKey: "scene-fingerprint",
    },
    sceneRuleSetRevision: 3,
    documents: [{
      documentId,
      documentTitle: "첫 회차",
      expectedDocumentRevisionId: revisionId,
      sceneKey: "scene-fingerprint",
      sceneRange: { start: 0, end: 5 },
      deletionRange: { start: 0, end: 9 },
      removedBoundaryAnchorId: entityId<"Anchor">("boundary-a"),
      sceneContentUtf16Length: 5,
      deletedUtf16Length: 9,
      firstExcerpt: "첫 문장",
      lastExcerpt: "끝 문장",
    }],
    metadata: [{
      kind: "event",
      metadataId: "event-a",
      label: "첫 사건",
    }],
  } as const;
}

describe("Scene trash contracts", () => {
  it("parses stable and identity-less exact Scene deletion targets", () => {
    expect(parsePrepareSceneDeletionCommand({
      schemaVersion: 1,
      workId,
      target: { sceneId, documentId, sceneKey: "scene-a" },
    }).target.sceneId).toBe(sceneId);
    expect(parsePrepareSceneDeletionCommand({
      schemaVersion: 1,
      workId,
      target: { sceneId: null, documentId, sceneKey: "scene-b" },
    }).target.sceneId).toBeNull();
  });

  it("round-trips an exact preview into the delete command", () => {
    const parsed = parseSceneDeletionPreview(preview());
    expect(parseDeleteSceneCommand({ schemaVersion: 1, preview: parsed }))
      .toEqual({ schemaVersion: 1, preview: parsed });
  });

  it("rejects duplicate document revisions and undeclared fields", () => {
    expect(() => parseSceneDeletionPreview({
      ...preview(),
      documents: [preview().documents[0], preview().documents[0]],
    })).toThrow("unique by documentId");
    expect(() => parseRestoreSceneTrashCommand({
      schemaVersion: 1,
      workId,
      sceneTrashEntryId: "trash-a",
      expectedRevision: 1,
      rawText: "not allowed",
    })).toThrow("fields do not match");
  });

  it("requires restore availability to agree with its conflict reason", () => {
    const now = "2026-08-29T00:00:00.000Z";
    const base = {
      schemaVersion: 1,
      sceneTrashEntryId: "trash-a",
      revision: 1,
      workId,
      sceneId,
      sourceSceneKey: "scene-fingerprint",
      sceneRuleSetRevision: 3,
      status: "active",
      documents: [{
        sceneTrashDocumentId: "trash-document-a",
        documentId,
        documentTitle: "첫 회차",
        ordinal: 0,
        beforeRevisionId: "revision-before",
        deletedRevisionId: "revision-deleted",
        restoredRevisionId: null,
        sceneRange: { start: 0, end: 5 },
        deletionRange: { start: 0, end: 9 },
        deletedUtf16Length: 9,
        firstExcerpt: "첫 문장",
        lastExcerpt: "끝 문장",
      }],
      metadata: [],
      canRestore: true,
      conflictReason: null,
      deletedAt: now,
      restoredAt: null,
    } as const;
    expect(parseSceneTrashEntryProjection(base).canRestore).toBe(true);
    expect(() => parseSceneTrashEntryProjection({
      ...base,
      canRestore: false,
      conflictReason: null,
    })).toThrow("conflicts with conflictReason");
  });
});
