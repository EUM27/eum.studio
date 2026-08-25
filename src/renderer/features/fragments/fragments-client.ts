import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  FragmentProjection,
  UpdateFragmentCommand,
} from "../../../application/fragments/fragment-contract";
import type { EntityId } from "../../../domain/writing";

export type FragmentsClient = Pick<
  StudioBridge["fragments"],
  "capture" | "list" | "update" | "recordUse" | "retire"
>;

export type FragmentSelection = Readonly<{
  anchor: number;
  head: number;
  from: number;
  to: number;
  empty: boolean;
}>;

export type FragmentsManuscriptPort = Readonly<{
  readSelection: (
    document: ManuscriptDocumentSource,
  ) => FragmentSelection | undefined;
  materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string | undefined;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  deleteExactDocumentRange: (
    document: ManuscriptDocumentSource,
    range: Readonly<{ from: number; to: number }>,
    exactText: string,
  ) => boolean;
  insertFragmentAtCursor: (
    document: ManuscriptDocumentSource,
    offset: number,
    exactText: string,
  ) => boolean;
}>;

export type FragmentEditorCapabilities = Omit<
  FragmentsManuscriptPort,
  "persistDocument"
>;

export function createFragmentsManuscriptPort(
  editor: FragmentEditorCapabilities,
  persistDocument: FragmentsManuscriptPort["persistDocument"],
): FragmentsManuscriptPort {
  return Object.freeze({ ...editor, persistDocument });
}

export type FragmentTimerPort = Readonly<{
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
}>;

const DEFAULT_TIMER_PORT: FragmentTimerPort = Object.freeze({
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function startFragmentsWorkLoad(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: FragmentsClient;
  onFailed: () => void;
  onLoaded: (fragments: readonly FragmentProjection[]) => void;
  onReset: () => void;
  timer?: FragmentTimerPort;
}>): () => void {
  if (input.activeWorkId === null) {
    const timer = input.timer ?? DEFAULT_TIMER_PORT;
    const reset = timer.schedule(input.onReset, 0);
    return () => timer.cancel(reset);
  }
  let disposed = false;
  void input.client.list({
    schemaVersion: 1,
    workId: input.activeWorkId,
  }).then(
    (projection) => {
      if (!disposed) input.onLoaded(projection.fragments);
    },
    () => {
      if (!disposed) input.onFailed();
    },
  );
  return () => {
    disposed = true;
  };
}

export async function persistAndCaptureFragment(input: Readonly<{
  client: FragmentsClient;
  document: ManuscriptDocumentSource;
  exactText: string;
  kindId: string;
  manuscript: FragmentsManuscriptPort;
  selection: FragmentSelection;
}>): Promise<FragmentProjection> {
  await input.manuscript.persistDocument(input.document);
  return input.client.capture({
    schemaVersion: 1,
    workId: input.document.workId,
    documentId: input.document.documentId,
    selection: {
      anchor: input.selection.anchor,
      head: input.selection.head,
    },
    exactText: input.exactText,
    kindId: input.kindId,
    title: "",
  });
}

export type FragmentMoveOutcome =
  | Readonly<{
      status: "moved";
      fragments: readonly FragmentProjection[];
    }>
  | Readonly<{
      status: "captured-delete-failed";
      captured: FragmentProjection;
    }>
  | Readonly<{
      status: "captured-persist-or-refresh-failed";
      captured: FragmentProjection;
    }>
  | Readonly<{ status: "failed" }>;

export async function moveSelectionToFragment(input: Readonly<{
  client: FragmentsClient;
  document: ManuscriptDocumentSource;
  exactText: string;
  kindId: string;
  manuscript: FragmentsManuscriptPort;
  selection: FragmentSelection;
}>): Promise<FragmentMoveOutcome> {
  let captured: FragmentProjection | null = null;
  try {
    captured = await persistAndCaptureFragment(input);
    const deleted = input.manuscript.deleteExactDocumentRange(
      input.document,
      { from: input.selection.from, to: input.selection.to },
      input.exactText,
    );
    if (!deleted) {
      return Object.freeze({ status: "captured-delete-failed", captured });
    }
    await input.manuscript.persistDocument(input.document);
    const projection = await input.client.list({
      schemaVersion: 1,
      workId: input.document.workId,
    });
    return Object.freeze({
      status: "moved",
      fragments: projection.fragments,
    });
  } catch {
    return captured === null
      ? Object.freeze({ status: "failed" })
      : Object.freeze({
          status: "captured-persist-or-refresh-failed",
          captured,
        });
  }
}

export type FragmentInsertOutcome =
  | Readonly<{ status: "inserted"; used: FragmentProjection }>
  | Readonly<{ status: "cursor-changed" }>
  | Readonly<{ status: "persist-or-record-use-failed" }>;

export async function insertFragmentAtCursor(input: Readonly<{
  client: FragmentsClient;
  document: ManuscriptDocumentSource;
  fragment: FragmentProjection;
  manuscript: FragmentsManuscriptPort;
  selection: FragmentSelection;
}>): Promise<FragmentInsertOutcome> {
  try {
    const inserted = input.manuscript.insertFragmentAtCursor(
      input.document,
      input.selection.from,
      input.fragment.exactText,
    );
    if (!inserted) return Object.freeze({ status: "cursor-changed" });
    await input.manuscript.persistDocument(input.document);
    const used = await input.client.recordUse({
      schemaVersion: 1,
      workId: input.document.workId,
      fragmentId: input.fragment.fragmentId,
      expectedRevision: input.fragment.revision,
    });
    return Object.freeze({ status: "inserted", used });
  } catch {
    return Object.freeze({ status: "persist-or-record-use-failed" });
  }
}

export function updateFragmentRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  changes: UpdateFragmentCommand["changes"];
  client: FragmentsClient;
  fragment: FragmentProjection;
}>): Promise<FragmentProjection> {
  return input.client.update({
    schemaVersion: 1,
    workId: input.activeWorkId,
    fragmentId: input.fragment.fragmentId,
    expectedRevision: input.fragment.revision,
    changes: input.changes,
  });
}

export function retireFragmentRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: FragmentsClient;
  fragment: FragmentProjection;
}>): Promise<FragmentProjection> {
  return input.client.retire({
    schemaVersion: 1,
    workId: input.activeWorkId,
    fragmentId: input.fragment.fragmentId,
    expectedRevision: input.fragment.revision,
  });
}
