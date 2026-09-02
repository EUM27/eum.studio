import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { MoveRangeToEpisodeReceipt } from "../../../application/editor/move-range-to-episode";
import { entityId } from "../../../domain/writing";
import {
  isMoveRangeNotUndoableError,
  isMoveRangeUndoCurrent,
} from "./useMoveRangeToEpisodeController";

function createMove(): MoveRangeToEpisodeReceipt {
  return {
    schemaVersion: 1,
    status: "moved",
    moveId: entityId<"EpisodeRangeMove">(randomUUID()),
    workId: entityId<"Work">(randomUUID()),
    sourceEpisodeId: entityId<"Document">(randomUUID()),
    targetEpisodeId: entityId<"Document">(randomUUID()),
    sourceRevisionId: entityId<"DocumentRevision">(randomUUID()),
    targetRevisionId: entityId<"DocumentRevision">(randomUUID()),
    sceneIds: [],
  };
}

describe("move-range undo availability", () => {
  it("keeps only the exact post-move source and target revisions undoable", () => {
    const move = createMove();
    expect(isMoveRangeUndoCurrent({
      move,
      sourceRevisionId: move.sourceRevisionId,
      targetRevisionId: move.targetRevisionId,
    })).toBe(true);
    expect(isMoveRangeUndoCurrent({
      move,
      sourceRevisionId: entityId<"DocumentRevision">(randomUUID()),
      targetRevisionId: move.targetRevisionId,
    })).toBe(false);
    expect(isMoveRangeUndoCurrent({
      move,
      sourceRevisionId: move.sourceRevisionId,
      targetRevisionId: entityId<"DocumentRevision">(randomUUID()),
    })).toBe(false);
  });

  it("recognizes Electron's wrapped not-undoable rejection", () => {
    const moveId = randomUUID();
    expect(isMoveRangeNotUndoableError(new Error(
      `Error invoking remote method 'studio:editor:undo-move-range-to-episode': Error: Episode range move is not undoable: ${moveId}`,
    ))).toBe(true);
    expect(isMoveRangeNotUndoableError(new Error(randomUUID()))).toBe(false);
  });
});
