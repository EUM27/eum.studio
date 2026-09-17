import { useCallback, useEffect, useMemo, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { LoreCandidateProjection } from "../../../application/lore/lore-candidate-contract";
import type {
  LoreEntryProjection,
  UpdateLoreEntryCommand,
} from "../../../application/lore/lore-entry-contract";
import type { EntityId } from "../../../domain/writing";
import type { LoreCandidateActionState } from "../../editor/LoreCandidateDialog";
import type { LoreManagerActionState } from "../../editor/LoreManagerDialog";
import {
  addLoreEvidenceRecord,
  approveLoreCandidateWithRefresh,
  createLoreCandidateRecord,
  createLoreEntryRecord,
  loadCanonicalLoreEntries,
  readLoreSelection,
  rejectLoreCandidateRecord,
  retireLoreEntryWithCompatibility,
  startLoreWorkLoad,
  updateLoreEntryRecord,
  type LoreCandidateDraftInput,
  type LoreCandidatesClient,
  type LoreEntriesClient,
  type LoreEntryDraftInput,
  type LoreLinksCompatibilityPort,
  type LoreManuscriptPort,
} from "./lore-client";
import {
  canAddLoreEvidence,
  canApproveLoreCandidate,
  canCreateLoreCandidate,
  canCreateLoreEntry,
  canMutateLoreEntry,
  canRefreshLoreCandidates,
  canRejectLoreCandidate,
  closeLoreCandidateDialogState,
  closeLoreDialogState,
  enterLoreStructureState,
  LORE_MESSAGES,
  loreNavigationFailedState,
  loreNavigationOpenedState,
  loreNavigationRejectedState,
  loreNavigationStartedState,
  loreSharedLinkFailedState,
  loreSharedLinkFinishedState,
  loreSharedLinkStartedState,
  prependLoreCandidate,
  prependLoreEntry,
  reconcileSelectedLoreEntry,
  replaceLoreCandidate,
  replaceLoreEntry,
  resolveLoreRetirement,
} from "./lore-state";

export function useLoreController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  candidatesClient: LoreCandidatesClient;
  entriesClient: LoreEntriesClient;
  links: LoreLinksCompatibilityPort;
  workLoadId: EntityId<"Work"> | null;
}>) {
  const [loreEntries, setLoreEntries] = useState<
    readonly LoreEntryProjection[]
  >([]);
  const [loreCandidates, setLoreCandidates] = useState<
    readonly LoreCandidateProjection[]
  >([]);
  const [loreDialogOpen, setLoreDialogOpen] = useState(false);
  const [selectedLoreEntryId, setSelectedLoreEntryId] = useState<
    string | null
  >(null);
  const [loreActionState, setLoreActionState] =
    useState<LoreManagerActionState>("idle");
  const [loreActionError, setLoreActionError] = useState<string | null>(null);
  const [loreCandidateDialogOpen, setLoreCandidateDialogOpen] = useState(false);
  const [loreCandidateActionState, setLoreCandidateActionState] =
    useState<LoreCandidateActionState>("idle");
  const [loreCandidateActionError, setLoreCandidateActionError] = useState<
    string | null
  >(null);

  useEffect(() => startLoreWorkLoad({
    activeWorkId: input.workLoadId,
    candidatesClient: input.candidatesClient,
    entriesClient: input.entriesClient,
    links: input.links,
    onReset: () => {
      setLoreEntries([]);
      setLoreCandidates([]);
      input.links.clear();
      setSelectedLoreEntryId(null);
      setLoreActionError(null);
      setLoreDialogOpen(false);
      setLoreCandidateActionError(null);
      setLoreCandidateDialogOpen(false);
    },
    onLoaded: (entries, candidates, links) => {
      setLoreEntries(entries);
      setLoreCandidates(candidates);
      input.links.replace(links);
      setSelectedLoreEntryId((current) =>
        reconcileSelectedLoreEntry(current, entries));
      setLoreActionError(null);
      setLoreCandidateActionError(null);
    },
    onFailed: () => {
      setLoreEntries([]);
      setLoreCandidates([]);
      input.links.clear();
      setLoreActionError(LORE_MESSAGES.loadFailed);
      setLoreCandidateActionError(LORE_MESSAGES.candidateLoadFailed);
    },
  }), [
    input.candidatesClient,
    input.entriesClient,
    input.links,
    input.workLoadId,
  ]);

  const refreshCanonicalEntries = useCallback(async (): Promise<boolean> => {
    const activeWorkId = input.activeWorkId;
    if (activeWorkId === null) return false;
    try {
      const entries = await loadCanonicalLoreEntries({
        activeWorkId,
        client: input.entriesClient,
      });
      setLoreEntries(entries);
      setSelectedLoreEntryId((current) =>
        reconcileSelectedLoreEntry(current, entries)
      );
      setLoreActionError(null);
      return true;
    } catch {
      setLoreActionError(LORE_MESSAGES.loadFailed);
      return false;
    }
  }, [input.activeWorkId, input.entriesClient]);

  const createLoreEntry = useCallback(async (
    draft: LoreEntryDraftInput,
    manuscriptPort: LoreManuscriptPort | null,
  ) => {
    const activeWorkId = input.activeWorkId;
    if (!canCreateLoreEntry(loreActionState, activeWorkId)) return;
    let evidence: Parameters<LoreEntriesClient["create"]>[0]["evidence"] = null;
    let persistence: Readonly<{
      document: ManuscriptDocumentSource;
      manuscript: LoreManuscriptPort;
    }> | null = null;
    if (draft.includeCurrentSelection) {
      const activeDocument = input.activeDocument;
      if (
        activeDocument === null ||
        activeDocument.workId !== activeWorkId ||
        manuscriptPort === null
      ) {
        setLoreActionError(LORE_MESSAGES.createEvidenceRequired);
        return;
      }
      const selection = readLoreSelection(activeDocument, manuscriptPort);
      if (selection.status === "selection-required") {
        setLoreActionError(LORE_MESSAGES.createEvidenceRequired);
        return;
      }
      if (selection.status === "empty") {
        setLoreActionError(LORE_MESSAGES.createEmptyEvidence);
        return;
      }
      evidence = Object.freeze({
        documentId: activeDocument.documentId,
        selection: Object.freeze({
          anchor: selection.selection.anchor,
          head: selection.selection.head,
        }),
        exactText: selection.exactText,
      });
      persistence = Object.freeze({
        document: activeDocument,
        manuscript: manuscriptPort,
      });
    }
    setLoreActionState("creating");
    setLoreActionError(null);
    try {
      const created = await createLoreEntryRecord({
        activeWorkId,
        client: input.entriesClient,
        draft,
        evidence,
        persistence,
      });
      setLoreEntries((current) => prependLoreEntry(current, created));
      setSelectedLoreEntryId(created.loreEntryId);
    } catch {
      setLoreActionError(LORE_MESSAGES.createFailed);
    } finally {
      setLoreActionState("idle");
    }
  }, [
    input.activeDocument,
    input.activeWorkId,
    input.entriesClient,
    loreActionState,
  ]);

  const updateLoreEntry = useCallback(async (
    entry: LoreEntryProjection,
    changes: UpdateLoreEntryCommand["changes"],
  ) => {
    const activeWorkId = input.activeWorkId;
    if (!canMutateLoreEntry(loreActionState, activeWorkId, entry)) return;
    setLoreActionState("updating");
    setLoreActionError(null);
    try {
      const updated = await updateLoreEntryRecord({
        activeWorkId,
        changes,
        client: input.entriesClient,
        entry,
      });
      setLoreEntries((current) => replaceLoreEntry(current, updated));
    } catch {
      setLoreActionError(LORE_MESSAGES.updateFailed);
    } finally {
      setLoreActionState("idle");
    }
  }, [input.activeWorkId, input.entriesClient, loreActionState]);

  const retireLoreEntry = useCallback(async (
    entry: LoreEntryProjection,
  ) => {
    const activeWorkId = input.activeWorkId;
    if (!canMutateLoreEntry(loreActionState, activeWorkId, entry)) return;
    setLoreActionState("retiring");
    setLoreActionError(null);
    try {
      const outcome = await retireLoreEntryWithCompatibility({
        activeWorkId,
        client: input.entriesClient,
        entry,
        links: input.links,
        onRetired: (retired) => {
          const state = resolveLoreRetirement(
            loreEntries,
            selectedLoreEntryId,
            retired,
          );
          setLoreEntries(state.entries);
          setSelectedLoreEntryId((current) =>
            current === retired.loreEntryId
              ? (state.entries[0]?.loreEntryId ?? null)
              : current);
        },
      });
      if (outcome.status === "retired-link-refresh-failed") {
        setLoreActionError(LORE_MESSAGES.retireLinkRefreshFailed);
      }
    } catch {
      setLoreActionError(LORE_MESSAGES.retireFailed);
    } finally {
      setLoreActionState("idle");
    }
  }, [
    input.activeWorkId,
    input.entriesClient,
    input.links,
    loreActionState,
    loreEntries,
    selectedLoreEntryId,
  ]);

  const addLoreEntryEvidence = useCallback(async (
    entry: LoreEntryProjection,
    manuscriptPort: LoreManuscriptPort | null,
  ) => {
    const activeDocument = input.activeDocument;
    if (!canAddLoreEvidence(loreActionState, activeDocument, entry)) return;
    if (manuscriptPort === null) {
      setLoreActionError(LORE_MESSAGES.addEvidenceRequired);
      return;
    }
    const selection = readLoreSelection(activeDocument, manuscriptPort);
    if (selection.status === "selection-required") {
      setLoreActionError(LORE_MESSAGES.addEvidenceRequired);
      return;
    }
    if (selection.status === "empty") {
      setLoreActionError(LORE_MESSAGES.addEmptyEvidence);
      return;
    }
    setLoreActionState("adding-evidence");
    setLoreActionError(null);
    try {
      const updated = await addLoreEvidenceRecord({
        client: input.entriesClient,
        document: activeDocument,
        entry,
        exactText: selection.exactText,
        manuscript: manuscriptPort,
        selection: selection.selection,
      });
      setLoreEntries((current) => replaceLoreEntry(current, updated));
    } catch {
      setLoreActionError(LORE_MESSAGES.addEvidenceFailed);
    } finally {
      setLoreActionState("idle");
    }
  }, [input.activeDocument, input.entriesClient, loreActionState]);

  const refreshLoreCandidates = useCallback(async (): Promise<boolean> => {
    const activeWorkId = input.activeWorkId;
    if (!canRefreshLoreCandidates(
      loreCandidateActionState,
      activeWorkId,
    )) {
      return false;
    }
    setLoreCandidateActionError(null);
    try {
      const projection = await input.candidatesClient.list({
        schemaVersion: 1,
        workId: activeWorkId,
      });
      setLoreCandidates(projection.candidates);
      return true;
    } catch {
      setLoreCandidateActionError(LORE_MESSAGES.candidateLoadFailed);
      return false;
    }
  }, [input.activeWorkId, input.candidatesClient, loreCandidateActionState]);

  const openLoreCandidateDialog = useCallback(async () => {
    if (await refreshLoreCandidates()) {
      setLoreCandidateDialogOpen(true);
    }
  }, [refreshLoreCandidates]);

  const createLoreCandidate = useCallback(async (
    draft: LoreCandidateDraftInput,
    manuscriptPort: LoreManuscriptPort | null,
  ) => {
    const activeDocument = input.activeDocument;
    const activeWorkId = input.activeWorkId;
    if (!canCreateLoreCandidate(
      loreCandidateActionState,
      activeWorkId,
      activeDocument,
    )) {
      return;
    }
    if (manuscriptPort === null) {
      setLoreCandidateActionError(LORE_MESSAGES.candidateEvidenceRequired);
      return;
    }
    const selection = readLoreSelection(activeDocument, manuscriptPort);
    if (selection.status === "selection-required") {
      setLoreCandidateActionError(LORE_MESSAGES.candidateEvidenceRequired);
      return;
    }
    if (selection.status === "empty") {
      setLoreCandidateActionError(LORE_MESSAGES.candidateEmptyEvidence);
      return;
    }
    setLoreCandidateActionState("creating");
    setLoreCandidateActionError(null);
    try {
      const created = await createLoreCandidateRecord({
        client: input.candidatesClient,
        document: activeDocument,
        draft,
        exactText: selection.exactText,
        manuscript: manuscriptPort,
        selection: selection.selection,
      });
      setLoreCandidates((current) => prependLoreCandidate(current, created));
    } catch {
      setLoreCandidateActionError(LORE_MESSAGES.candidateCreateFailed);
    } finally {
      setLoreCandidateActionState("idle");
    }
  }, [
    input.activeDocument,
    input.activeWorkId,
    input.candidatesClient,
    loreCandidateActionState,
  ]);

  const approveLoreCandidate = useCallback(async (
    candidate: LoreCandidateProjection,
  ) => {
    const activeWorkId = input.activeWorkId;
    if (!canApproveLoreCandidate(
      loreCandidateActionState,
      activeWorkId,
      candidate,
    )) {
      return;
    }
    setLoreCandidateActionState("approving");
    setLoreCandidateActionError(null);
    try {
      const outcome = await approveLoreCandidateWithRefresh({
        activeWorkId,
        candidate,
        client: input.candidatesClient,
      });
      if (outcome.status === "approved") {
        setLoreCandidates((current) =>
          replaceLoreCandidate(current, outcome.result.candidate));
        setLoreEntries((current) =>
          prependLoreEntry(current, outcome.result.loreEntry));
        setSelectedLoreEntryId(outcome.result.loreEntry.loreEntryId);
      } else {
        if (outcome.refreshedCandidates !== null) {
          setLoreCandidates(outcome.refreshedCandidates);
        }
        setLoreCandidateActionError(LORE_MESSAGES.candidateApproveFailed);
      }
    } finally {
      setLoreCandidateActionState("idle");
    }
  }, [input.activeWorkId, input.candidatesClient, loreCandidateActionState]);

  const rejectLoreCandidate = useCallback(async (
    candidate: LoreCandidateProjection,
  ) => {
    const activeWorkId = input.activeWorkId;
    if (!canRejectLoreCandidate(
      loreCandidateActionState,
      activeWorkId,
      candidate,
    )) {
      return;
    }
    setLoreCandidateActionState("rejecting");
    setLoreCandidateActionError(null);
    try {
      const rejected = await rejectLoreCandidateRecord({
        activeWorkId,
        candidate,
        client: input.candidatesClient,
      });
      setLoreCandidates((current) => replaceLoreCandidate(current, rejected));
    } catch {
      setLoreCandidateActionError(LORE_MESSAGES.candidateRejectFailed);
    } finally {
      setLoreCandidateActionState("idle");
    }
  }, [input.activeWorkId, input.candidatesClient, loreCandidateActionState]);

  const selectLoreEntry = useCallback((entryId: string | null) => {
    setSelectedLoreEntryId(entryId);
  }, []);

  const closeLoreDialog = useCallback(() => {
    const state = closeLoreDialogState(loreActionState);
    if (state === null) return;
    setLoreDialogOpen(state.dialogOpen);
    setLoreActionError(state.error);
  }, [loreActionState]);

  const enterLoreStructureSurface = useCallback(() => {
    const state = enterLoreStructureState();
    setLoreActionError(state.error);
    setLoreDialogOpen(state.dialogOpen);
  }, []);

  const closeLoreCandidateDialog = useCallback(() => {
    const state = closeLoreCandidateDialogState(loreCandidateActionState);
    if (state === null) return;
    setLoreCandidateDialogOpen(state.dialogOpen);
    setLoreCandidateActionError(state.error);
  }, [loreCandidateActionState]);

  const startLoreSharedLinkAction = useCallback((
    actionState: "linking-foreshadow" | "unlinking-foreshadow",
  ) => {
    const state = loreSharedLinkStartedState(actionState);
    setLoreActionState(state.actionState);
    setLoreActionError(state.error);
  }, []);

  const failLoreSharedLinkAction = useCallback((error: string) => {
    setLoreActionError(loreSharedLinkFailedState(error).error);
  }, []);

  const finishLoreSharedLinkAction = useCallback(() => {
    setLoreActionState(loreSharedLinkFinishedState().actionState);
  }, []);

  const canonicalNavigation = useLoreNavigationSurface({
    setDialogOpen: setLoreDialogOpen,
    setError: setLoreActionError,
  });
  const candidateNavigation = useLoreNavigationSurface({
    setDialogOpen: setLoreCandidateDialogOpen,
    setError: setLoreCandidateActionError,
  });
  const sharedLinkAction = useMemo(() => Object.freeze({
    started: startLoreSharedLinkAction,
    failed: failLoreSharedLinkAction,
    finished: finishLoreSharedLinkAction,
  }), [
    failLoreSharedLinkAction,
    finishLoreSharedLinkAction,
    startLoreSharedLinkAction,
  ]);

  return {
    loreEntries,
    loreCandidates,
    selectedLoreEntryId,
    loreDialogOpen,
    loreActionState,
    loreActionError,
    loreCandidateDialogOpen,
    loreCandidateActionState,
    loreCandidateActionError,
    refreshCanonicalEntries,
    selectLoreEntry,
    closeLoreDialog,
    enterLoreStructureSurface,
    createLoreEntry,
    updateLoreEntry,
    addLoreEntryEvidence,
    retireLoreEntry,
    refreshLoreCandidates,
    openLoreCandidateDialog,
    closeLoreCandidateDialog,
    createLoreCandidate,
    approveLoreCandidate,
    rejectLoreCandidate,
    sharedLinkAction,
    canonicalNavigation,
    candidateNavigation,
  };
}

function useLoreNavigationSurface(input: Readonly<{
  setDialogOpen: (open: boolean) => void;
  setError: (error: string | null) => void;
}>) {
  const reject = useCallback((error: string) => {
    input.setError(loreNavigationRejectedState(error).error);
  }, [input]);
  const started = useCallback(() => {
    const state = loreNavigationStartedState();
    input.setError(state.error);
    input.setDialogOpen(state.dialogOpen);
  }, [input]);
  const opened = useCallback(() => {
    const state = loreNavigationOpenedState();
    input.setError(state.error);
    input.setDialogOpen(state.dialogOpen);
  }, [input]);
  const failed = useCallback((error: string, reopenDialog: boolean) => {
    const state = loreNavigationFailedState(error, reopenDialog);
    input.setError(state.error);
    if ("dialogOpen" in state) input.setDialogOpen(true);
  }, [input]);
  return useMemo(() => Object.freeze({ reject, started, opened, failed }), [
    failed,
    opened,
    reject,
    started,
  ]);
}

export type {
  LoreCandidateDraftInput,
  LoreEntryDraftInput,
  LoreLinksCompatibilityPort,
  LoreManuscriptPort,
} from "./lore-client";
