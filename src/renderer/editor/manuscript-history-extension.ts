import { history } from "@codemirror/commands";

// CodeMirror applies minDepth to both the undo and redo branches.
// Keep every edit for the lifetime of the owning document state.
export const manuscriptHistoryExtension = history({
  minDepth: Number.POSITIVE_INFINITY,
});
