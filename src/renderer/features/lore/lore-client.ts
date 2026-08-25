import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  CreateLoreCandidateCommand,
  LoreCandidateApprovalResult,
  LoreCandidateProjection,
} from "../../../application/lore/lore-candidate-contract";
import type {
  CreateLoreEntryCommand,
  LoreEntryProjection,
  UpdateLoreEntryCommand,
} from "../../../application/lore/lore-entry-contract";
import type { LoreForeshadowLinkProjection } from "../../../application/lore/lore-foreshadow-link-contract";
import type { EntityId } from "../../../domain/writing";

export type LoreEntriesClient = Pick<
  StudioBridge["loreEntries"],
  "create" | "list" | "update" | "addEvidence" | "retire"
>;

export type LoreCandidatesClient = Pick<
  StudioBridge["loreCandidates"],
  "create" | "list" | "approve" | "reject"
>;

export type LoreEntryDraftInput = Pick<
  CreateLoreEntryCommand,
  "title" | "content" | "category" | "aliases" | "enabled"
> & Readonly<{ includeCurrentSelection: boolean }>;

export type LoreCandidateDraftInput = Pick<
  CreateLoreCandidateCommand,
  "proposal" | "reason"
>;

export type LoreSelection = Readonly<{
  anchor: number;
  head: number;
  from: number;
  to: number;
  empty: boolean;
}>;

export type LoreManuscriptPort = Readonly<{
  readSelection: (
    document: ManuscriptDocumentSource,
  ) => LoreSelection | undefined;
  materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string | undefined;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
}>;

export type LoreEditorCapabilities = Omit<
  LoreManuscriptPort,
  "persistDocument"
>;

export function createLoreManuscriptPort(
  editor: LoreEditorCapabilities,
  persistDocument: LoreManuscriptPort["persistDocument"],
): LoreManuscriptPort {
  return Object.freeze({ ...editor, persistDocument });
}

export type LoreLinksCompatibilityPort = Readonly<{
  list: (
    workId: EntityId<"Work">,
  ) => Promise<readonly LoreForeshadowLinkProjection[]>;
  replace: (links: readonly LoreForeshadowLinkProjection[]) => void;
  clear: () => void;
  pruneRetiredLoreEntry: (loreEntryId: EntityId<"LoreEntry">) => void;
}>;

export type LoreTimerPort = Readonly<{
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
}>;

const DEFAULT_TIMER_PORT: LoreTimerPort = Object.freeze({
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function startLoreWorkLoad(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  candidatesClient: LoreCandidatesClient;
  entriesClient: LoreEntriesClient;
  links: LoreLinksCompatibilityPort;
  onFailed: () => void;
  onLoaded: (
    entries: readonly LoreEntryProjection[],
    candidates: readonly LoreCandidateProjection[],
    links: readonly LoreForeshadowLinkProjection[],
  ) => void;
  onReset: () => void;
  timer?: LoreTimerPort;
}>): () => void {
  if (input.activeWorkId === null) {
    const timer = input.timer ?? DEFAULT_TIMER_PORT;
    const reset = timer.schedule(input.onReset, 0);
    return () => timer.cancel(reset);
  }
  let disposed = false;
  void Promise.all([
    input.entriesClient.list({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.candidatesClient.list({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.links.list(input.activeWorkId),
  ]).then(
    ([entryProjection, candidateProjection, links]) => {
      if (!disposed) {
        input.onLoaded(
          entryProjection.entries,
          candidateProjection.candidates,
          links,
        );
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

export type ReadLoreSelectionResult =
  | Readonly<{
      exactText: string;
      selection: LoreSelection;
      status: "ready";
    }>
  | Readonly<{ status: "selection-required" }>
  | Readonly<{ status: "empty" }>;

export function readLoreSelection(
  document: ManuscriptDocumentSource,
  manuscript: LoreManuscriptPort,
): ReadLoreSelectionResult {
  const selection = manuscript.readSelection(document);
  const text = manuscript.materializeDocumentText(document);
  if (selection === undefined || selection.empty || text === undefined) {
    return Object.freeze({ status: "selection-required" });
  }
  const exactText = text.slice(selection.from, selection.to);
  return exactText.length === 0
    ? Object.freeze({ status: "empty" })
    : Object.freeze({ exactText, selection, status: "ready" });
}

export async function createLoreEntryRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: LoreEntriesClient;
  draft: LoreEntryDraftInput;
  evidence: CreateLoreEntryCommand["evidence"];
  persistence: Readonly<{
    document: ManuscriptDocumentSource;
    manuscript: LoreManuscriptPort;
  }> | null;
}>): Promise<LoreEntryProjection> {
  if (input.persistence !== null) {
    await input.persistence.manuscript.persistDocument(
      input.persistence.document,
    );
  }
  return input.client.create({
    schemaVersion: 1,
    workId: input.activeWorkId,
    title: input.draft.title,
    content: input.draft.content,
    category: input.draft.category,
    aliases: input.draft.aliases,
    enabled: input.draft.enabled,
    evidence: input.evidence,
  });
}

export function updateLoreEntryRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  changes: UpdateLoreEntryCommand["changes"];
  client: LoreEntriesClient;
  entry: LoreEntryProjection;
}>): Promise<LoreEntryProjection> {
  return input.client.update({
    schemaVersion: 1,
    workId: input.activeWorkId,
    loreEntryId: input.entry.loreEntryId,
    expectedRevision: input.entry.revision,
    changes: input.changes,
  });
}

export async function addLoreEvidenceRecord(input: Readonly<{
  client: LoreEntriesClient;
  document: ManuscriptDocumentSource;
  entry: LoreEntryProjection;
  exactText: string;
  manuscript: LoreManuscriptPort;
  selection: LoreSelection;
}>): Promise<LoreEntryProjection> {
  await input.manuscript.persistDocument(input.document);
  return input.client.addEvidence({
    schemaVersion: 1,
    workId: input.document.workId,
    loreEntryId: input.entry.loreEntryId,
    expectedRevision: input.entry.revision,
    documentId: input.document.documentId,
    selection: {
      anchor: input.selection.anchor,
      head: input.selection.head,
    },
    exactText: input.exactText,
  });
}

export type RetireLoreEntryOutcome = Readonly<{
  retired: LoreEntryProjection;
  status: "retired" | "retired-link-refresh-failed";
}>;

export async function retireLoreEntryWithCompatibility(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  client: LoreEntriesClient;
  entry: LoreEntryProjection;
  links: LoreLinksCompatibilityPort;
  onRetired: (retired: LoreEntryProjection) => void;
}>): Promise<RetireLoreEntryOutcome> {
  const retired = await input.client.retire({
    schemaVersion: 1,
    workId: input.activeWorkId,
    loreEntryId: input.entry.loreEntryId,
    expectedRevision: input.entry.revision,
  });
  input.onRetired(retired);
  try {
    const links = await input.links.list(input.activeWorkId);
    input.links.replace(links);
    return Object.freeze({ retired, status: "retired" });
  } catch {
    input.links.pruneRetiredLoreEntry(retired.loreEntryId);
    return Object.freeze({
      retired,
      status: "retired-link-refresh-failed",
    });
  }
}

export async function createLoreCandidateRecord(input: Readonly<{
  client: LoreCandidatesClient;
  document: ManuscriptDocumentSource;
  draft: LoreCandidateDraftInput;
  exactText: string;
  manuscript: LoreManuscriptPort;
  selection: LoreSelection;
}>): Promise<LoreCandidateProjection> {
  await input.manuscript.persistDocument(input.document);
  return input.client.create({
    schemaVersion: 1,
    workId: input.document.workId,
    documentId: input.document.documentId,
    selection: {
      anchor: input.selection.anchor,
      head: input.selection.head,
    },
    exactText: input.exactText,
    source: "user",
    certainty: "explicit",
    proposal: input.draft.proposal,
    reason: input.draft.reason,
  });
}

export type ApproveLoreCandidateOutcome =
  | Readonly<{
      result: LoreCandidateApprovalResult;
      status: "approved";
    }>
  | Readonly<{
      refreshedCandidates: readonly LoreCandidateProjection[] | null;
      status: "failed";
    }>;

export async function approveLoreCandidateWithRefresh(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  candidate: LoreCandidateProjection;
  client: LoreCandidatesClient;
}>): Promise<ApproveLoreCandidateOutcome> {
  try {
    const result = await input.client.approve({
      schemaVersion: 1,
      workId: input.activeWorkId,
      candidateId: input.candidate.candidateId,
      expectedRevision: input.candidate.revision,
    });
    return Object.freeze({ result, status: "approved" });
  } catch {
    try {
      const projection = await input.client.list({
        schemaVersion: 1,
        workId: input.activeWorkId,
      });
      return Object.freeze({
        refreshedCandidates: projection.candidates,
        status: "failed",
      });
    } catch {
      return Object.freeze({ refreshedCandidates: null, status: "failed" });
    }
  }
}

export function rejectLoreCandidateRecord(input: Readonly<{
  activeWorkId: EntityId<"Work">;
  candidate: LoreCandidateProjection;
  client: LoreCandidatesClient;
}>): Promise<LoreCandidateProjection> {
  return input.client.reject({
    schemaVersion: 1,
    workId: input.activeWorkId,
    candidateId: input.candidate.candidateId,
    expectedRevision: input.candidate.revision,
  });
}
