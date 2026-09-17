import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  ForeshadowLineProjection,
  UpdateForeshadowLineCommand,
} from "../../../application/foreshadowing/foreshadow-line-contract";
import type { ForeshadowPointProjection } from "../../../application/foreshadowing/foreshadow-point-contract";
import type { EntityId } from "../../../domain/writing";

export type ForeshadowClient = Pick<
  StudioBridge["foreshadowing"],
  | "createLine"
  | "listLines"
  | "updateLine"
  | "retireLine"
  | "createPoint"
  | "listPoints"
>;

export type ForeshadowSelection = Readonly<{
  anchor: number;
  head: number;
  from: number;
  to: number;
  empty: boolean;
}>;

export type ForeshadowManuscriptPort = Readonly<{
  readSelection: (
    document: ManuscriptDocumentSource,
  ) => ForeshadowSelection | undefined;
  materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string | undefined;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
}>;

export type ForeshadowEditorCapabilities = Omit<
  ForeshadowManuscriptPort,
  "persistDocument"
>;

export function createForeshadowManuscriptPort(
  editor: ForeshadowEditorCapabilities,
  persistDocument: ForeshadowManuscriptPort["persistDocument"],
): ForeshadowManuscriptPort {
  return Object.freeze({ ...editor, persistDocument });
}

export type ForeshadowLoreLinkCompatibilityPort = Readonly<{
  refresh: (workId: EntityId<"Work">) => Promise<void>;
  pruneRetiredLine: (lineId: EntityId<"ForeshadowLine">) => void;
}>;

export type ForeshadowTimerPort = Readonly<{
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
}>;

const DEFAULT_TIMER_PORT: ForeshadowTimerPort = Object.freeze({
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function startForeshadowWorkLoad(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: ForeshadowClient;
  onFailed: () => void;
  onLoaded: (
    lines: readonly ForeshadowLineProjection[],
    points: readonly ForeshadowPointProjection[],
  ) => void;
  onReset: () => void;
  timer?: ForeshadowTimerPort;
}>): () => void {
  if (input.activeWorkId === null) {
    const timer = input.timer ?? DEFAULT_TIMER_PORT;
    const reset = timer.schedule(input.onReset, 0);
    return () => timer.cancel(reset);
  }
  let disposed = false;
  void Promise.all([
    input.client.listLines({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listPoints({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
  ]).then(
    ([lineProjection, pointProjection]) => {
      if (!disposed) {
        input.onLoaded(lineProjection.lines, pointProjection.points);
      }
    },
    () => {
      if (!disposed) input.onFailed();
    },
  );
  return () => {
    disposed = true;
  };
}

export function createForeshadowLineRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: ForeshadowClient;
  note: string;
  title: string;
}>): Promise<ForeshadowLineProjection> {
  return input.client.createLine({
    schemaVersion: 1,
    workId: input.activeWorkId,
    title: input.title,
    note: input.note,
  });
}

export function updateForeshadowLineRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  changes: UpdateForeshadowLineCommand["changes"];
  client: ForeshadowClient;
  line: ForeshadowLineProjection;
}>): Promise<ForeshadowLineProjection> {
  return input.client.updateLine({
    schemaVersion: 1,
    workId: input.activeWorkId,
    lineId: input.line.lineId,
    expectedRevision: input.line.revision,
    changes: input.changes,
  });
}

export type RetireForeshadowLineOutcome = Readonly<{
  retired: ForeshadowLineProjection;
  status: "retired" | "retired-link-refresh-failed";
}>;

export async function retireForeshadowLineWithCompatibility(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: ForeshadowClient;
  line: ForeshadowLineProjection;
  links: ForeshadowLoreLinkCompatibilityPort;
  onRetired: (retired: ForeshadowLineProjection) => void;
}>): Promise<RetireForeshadowLineOutcome> {
  const retired = await input.client.retireLine({
    schemaVersion: 1,
    workId: input.activeWorkId,
    lineId: input.line.lineId,
    expectedRevision: input.line.revision,
  });
  input.onRetired(retired);
  try {
    await input.links.refresh(input.activeWorkId);
    return Object.freeze({ retired, status: "retired" });
  } catch {
    input.links.pruneRetiredLine(retired.lineId);
    return Object.freeze({
      retired,
      status: "retired-link-refresh-failed",
    });
  }
}

export function captureForeshadowPointThroughPort(input: Readonly<{
  client: ForeshadowClient;
  document: ManuscriptDocumentSource;
  exactText: string;
  line: ForeshadowLineProjection;
  manuscript: ForeshadowManuscriptPort;
  note: string;
  roleId: string;
  selection: ForeshadowSelection;
}>): Promise<ForeshadowPointProjection> {
  return input.manuscript.persistDocument(input.document).then(() =>
    input.client.createPoint({
      schemaVersion: 1,
      workId: input.document.workId,
      lineId: input.line.lineId,
      documentId: input.document.documentId,
      selection: {
        anchor: input.selection.anchor,
        head: input.selection.head,
      },
      exactText: input.exactText,
      roleId: input.roleId,
      note: input.note,
    }),
  );
}
