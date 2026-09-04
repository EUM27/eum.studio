import { useCallback, useRef, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import { prepareManuscriptBulkTextExport } from "../../../application/editor/manuscript-bulk-export";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import {
  sanitizeManuscriptTextFileNamePart,
  type ManuscriptPreflightRange,
  type ManuscriptPreflightSettings,
  type ManuscriptPreflightSettingsProjection,
} from "../../../application/editor/manuscript-preflight";
import type { ManuscriptTextImportResult } from "../../../application/editor/manuscript-text-import";
import type { ManuscriptDocumentStateSummary } from "../../editor/ManuscriptEditor";
import type { ManuscriptHeatmapMode } from "../../editor/manuscript-analysis";

const MANUSCRIPT_CHANGED_AFTER_IMPORT_ERROR =
  "가져오기를 연 뒤 현재 원고가 바뀌었습니다.";

type ForwardWritingState = Readonly<{
  workId: ManuscriptDocumentSource["workId"];
  documentId: ManuscriptDocumentSource["documentId"];
  goalCharacters: number;
  protectedLength: number;
  baselineCharacterCount: number;
}>;

type PendingManuscriptPreflight = Readonly<{
  document: ManuscriptDocumentSource;
  manuscript: string;
  selection: ManuscriptPreflightRange | null;
  settingsProjection: ManuscriptPreflightSettingsProjection;
}>;

type PendingManuscriptBulkExport = Readonly<{
  workId: ManuscriptDocumentSource["workId"];
  workTitle: string;
  orderedDocuments: readonly ManuscriptDocumentSource[];
}>;

export type EditorToolsPort = Readonly<{
  isAvailable: () => boolean;
  readDocumentState: (
    document: ManuscriptDocumentSource,
  ) => ManuscriptDocumentStateSummary | null | undefined;
  materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string | undefined;
  replaceDocumentRange: (
    document: ManuscriptDocumentSource,
    range: Readonly<{ from: number; to: number }>,
    expectedSource: string,
    result: string,
  ) => boolean;
  selectDocumentRange: (
    document: ManuscriptDocumentSource,
    range: Readonly<{ from: number; to: number }>,
  ) => boolean;
  setManuscriptFocusActive: (enabled: boolean) => void;
}>;

export function useEditorToolsController(input: Readonly<{
  client: StudioBridge["editor"];
  document: ManuscriptDocumentSource | null;
  documents: readonly ManuscriptDocumentSource[];
  editor: EditorToolsPort;
  workTitle: string | null;
}>) {
  const preflightLoadSequenceRef = useRef(0);
  const [showForwardWritingDialog, setShowForwardWritingDialog] =
    useState(false);
  const [forwardWriting, setForwardWriting] =
    useState<ForwardWritingState | null>(null);
  const [heatmapMode, setHeatmapMode] =
    useState<ManuscriptHeatmapMode>("off");
  const [manuscriptAnalysis, setManuscriptAnalysis] = useState<{
    readonly documentTitle: string;
    readonly manuscript: string;
  } | null>(null);
  const [manuscriptTextImport, setManuscriptTextImport] = useState<{
    readonly candidate: Extract<
      ManuscriptTextImportResult,
      { readonly status: "selected" }
    >;
    readonly sourceText: string;
  } | null>(null);
  const [manuscriptTextImportAction, setManuscriptTextImportAction] = useState<
    "idle" | "selecting" | "applying"
  >("idle");
  const [manuscriptTextImportError, setManuscriptTextImportError] =
    useState<string | null>(null);
  const [pendingManuscriptPreflight, setPendingManuscriptPreflight] =
    useState<PendingManuscriptPreflight | null>(null);
  const [pendingManuscriptBulkExport, setPendingManuscriptBulkExport] =
    useState<PendingManuscriptBulkExport | null>(null);
  const [preflightActionError, setPreflightActionError] =
    useState<string | null>(null);

  const activeForwardWriting =
    input.document !== null &&
    forwardWriting?.workId === input.document.workId &&
    forwardWriting.documentId === input.document.documentId
      ? forwardWriting
      : null;

  const openForwardWritingDialog = useCallback(() => {
    setShowForwardWritingDialog(true);
  }, []);
  const closeForwardWritingDialog = useCallback(() => {
    setShowForwardWritingDialog(false);
  }, []);
  const startForwardWriting = useCallback((goalCharacters: number) => {
    if (input.document === null) return;
    const summary = input.editor.readDocumentState(input.document);
    const manuscript = input.editor.materializeDocumentText(input.document);
    if (
      summary === null ||
      summary === undefined ||
      manuscript === undefined
    ) return;
    setForwardWriting({
      workId: input.document.workId,
      documentId: input.document.documentId,
      goalCharacters,
      protectedLength: manuscript.length,
      baselineCharacterCount: summary.statistics.characterCount,
    });
    input.editor.setManuscriptFocusActive(true);
    setShowForwardWritingDialog(false);
    const document = input.document;
    queueMicrotask(() => {
      input.editor.selectDocumentRange(document, {
        from: manuscript.length,
        to: manuscript.length,
      });
    });
  }, [input.document, input.editor]);
  const stopForwardWriting = useCallback(() => {
    setForwardWriting(null);
    input.editor.setManuscriptFocusActive(false);
    setShowForwardWritingDialog(false);
  }, [input.editor]);

  const changeHeatmapMode = useCallback((mode: ManuscriptHeatmapMode) => {
    setHeatmapMode(mode);
  }, []);
  const openManuscriptAnalysis = useCallback(() => {
    if (input.document === null) return;
    const manuscript = input.editor.materializeDocumentText(input.document);
    if (manuscript === undefined) return;
    setManuscriptAnalysis({
      documentTitle: input.document.label,
      manuscript,
    });
  }, [input.document, input.editor]);
  const closeManuscriptAnalysis = useCallback(() => {
    setManuscriptAnalysis(null);
  }, []);

  const openManuscriptPreflight = useCallback(() => {
    if (input.document === null) return;
    const summary = input.editor.readDocumentState(input.document);
    const manuscript = input.editor.materializeDocumentText(input.document);
    const selectedRange =
      summary?.selection.ranges[summary.selection.mainIndex];
    if (
      summary === null ||
      summary === undefined ||
      manuscript === undefined
    ) {
      setPreflightActionError("현재 원고를 점검할 수 없습니다.");
      return;
    }
    const selection =
      selectedRange === undefined || selectedRange.empty
        ? null
        : Object.freeze({ from: selectedRange.from, to: selectedRange.to });
    const sequence = preflightLoadSequenceRef.current + 1;
    preflightLoadSequenceRef.current = sequence;
    setPreflightActionError(null);
    const document = input.document;
    void input.client.getManuscriptPreflightSettings({
      schemaVersion: 1,
      workId: document.workId,
    }).then((settingsProjection) => {
      if (sequence !== preflightLoadSequenceRef.current) return;
      if (settingsProjection.workId !== document.workId) {
        throw new Error("Preflight settings do not belong to the active Work");
      }
      setPendingManuscriptPreflight({
        document,
        manuscript,
        selection,
        settingsProjection,
      });
    }).catch(() => {
      if (sequence === preflightLoadSequenceRef.current) {
        setPreflightActionError("원고 점검 설정을 불러오지 못했습니다.");
      }
    });
  }, [input.client, input.document, input.editor]);

  const closeManuscriptPreflight = useCallback(() => {
    preflightLoadSequenceRef.current += 1;
    setPendingManuscriptPreflight(null);
    setPreflightActionError(null);
  }, []);

  const openManuscriptBulkExport = useCallback(() => {
    if (input.document === null || input.workTitle === null) return;
    const orderedDocuments = input.documents.filter(
      (document) => document.workId === input.document?.workId,
    );
    if (orderedDocuments.length === 0) return;
    setPendingManuscriptBulkExport({
      workId: input.document.workId,
      workTitle: input.workTitle,
      orderedDocuments: Object.freeze([...orderedDocuments]),
    });
  }, [input.document, input.documents, input.workTitle]);

  const closeManuscriptBulkExport = useCallback(() => {
    setPendingManuscriptBulkExport(null);
  }, []);

  const exportManuscriptBulk = useCallback((
    selectedDocumentIds: readonly ManuscriptDocumentSource["documentId"][],
  ) => {
    const pending = pendingManuscriptBulkExport;
    if (pending === null) throw new Error("No manuscript bulk export is open");
    const prepared = prepareManuscriptBulkTextExport({
      workId: pending.workId,
      orderedDocuments: pending.orderedDocuments.map((document) => {
        const text = input.editor.materializeDocumentText(document);
        if (text === undefined) {
          throw new Error(`Cannot materialize manuscript: ${document.documentId}`);
        }
        return Object.freeze({
          workId: document.workId,
          documentId: document.documentId,
          text,
        });
      }),
      selectedDocumentIds,
    });
    const fileNamePart = sanitizeManuscriptTextFileNamePart(pending.workTitle);
    return input.client.exportManuscriptText({
      schemaVersion: 1,
      workId: pending.workId,
      documentId: prepared.documentId,
      suggestedFileName: `${fileNamePart}.txt`,
      text: prepared.text,
    });
  }, [input.client, input.editor, pendingManuscriptBulkExport]);

  const saveManuscriptPreflightSettings = useCallback(async (
    settings: ManuscriptPreflightSettings,
  ) => {
    const pending = pendingManuscriptPreflight;
    if (pending === null) throw new Error("No manuscript preflight is open");
    const saved = await input.client.saveManuscriptPreflightSettings({
      schemaVersion: 1,
      workId: pending.document.workId,
      settings,
    });
    if (saved.workId !== pending.document.workId) {
      throw new Error("Saved preflight settings belong to another Work");
    }
    setPendingManuscriptPreflight((current) =>
      current === null || current.document.workId !== saved.workId
        ? current
        : { ...current, settingsProjection: saved }
    );
    return saved;
  }, [input.client, pendingManuscriptPreflight]);

  const applyManuscriptPreflight = useCallback((value: Readonly<{
    range: Readonly<{ from: number; to: number }>;
    expectedSource: string;
    result: string;
  }>) => {
    const pending = pendingManuscriptPreflight;
    if (pending === null) return false;
    const applied = input.editor.replaceDocumentRange(
      pending.document,
      value.range,
      value.expectedSource,
      value.result,
    );
    if (applied) {
      setPendingManuscriptPreflight(null);
      setPreflightActionError(null);
    }
    return applied;
  }, [input.editor, pendingManuscriptPreflight]);

  const exportManuscriptPreflight = useCallback((text: string) => {
    const pending = pendingManuscriptPreflight;
    if (pending === null) throw new Error("No manuscript preflight is open");
    const fileNamePart = sanitizeManuscriptTextFileNamePart(
      pending.document.label,
    );
    return input.client.exportManuscriptText({
      schemaVersion: 1,
      workId: pending.document.workId,
      documentId: pending.document.documentId,
      suggestedFileName: `${fileNamePart}.txt`,
      text,
    });
  }, [input.client, pendingManuscriptPreflight]);

  const selectManuscriptTextImport = useCallback(async () => {
    if (
      input.document === null ||
      activeForwardWriting !== null ||
      manuscriptTextImportAction !== "idle"
    ) return;
    const sourceText = input.editor.materializeDocumentText(input.document);
    if (sourceText === undefined) return;
    setManuscriptTextImportAction("selecting");
    setManuscriptTextImportError(null);
    try {
      const result = await input.client.selectManuscriptTextImport({
        schemaVersion: 1,
        workId: input.document.workId,
        documentId: input.document.documentId,
        documentRevisionId: input.document.documentRevisionId,
      });
      if (result.status === "selected") {
        setManuscriptTextImport({ candidate: result, sourceText });
      }
    } catch {
      setManuscriptTextImportError("원고 TXT 파일을 불러오지 못했습니다.");
    } finally {
      setManuscriptTextImportAction("idle");
    }
  }, [
    activeForwardWriting,
    input.client,
    input.document,
    input.editor,
    manuscriptTextImportAction,
  ]);

  const applyManuscriptTextImport = useCallback(() => {
    if (
      input.document === null ||
      manuscriptTextImport === null ||
      manuscriptTextImportAction !== "idle"
    ) return;
    const { candidate, sourceText } = manuscriptTextImport;
    if (
      !input.editor.isAvailable() ||
      candidate.workId !== input.document.workId ||
      candidate.documentId !== input.document.documentId ||
      candidate.documentRevisionId !== input.document.documentRevisionId
    ) {
      setManuscriptTextImportError(
        "가져오기를 연 뒤 대상 회차가 바뀌었습니다.",
      );
      return;
    }
    const currentText = input.editor.materializeDocumentText(input.document);
    if (currentText === undefined) {
      setManuscriptTextImportError(MANUSCRIPT_CHANGED_AFTER_IMPORT_ERROR);
      return;
    }
    if (currentText !== sourceText) {
      setManuscriptTextImportError(MANUSCRIPT_CHANGED_AFTER_IMPORT_ERROR);
      return;
    }
    setManuscriptTextImportAction("applying");
    const applied = input.editor.replaceDocumentRange(
      input.document,
      { from: 0, to: currentText.length },
      currentText,
      candidate.text,
    );
    const confirmed =
      applied &&
      input.editor.materializeDocumentText(input.document) === candidate.text;
    if (confirmed) {
      setManuscriptTextImport(null);
      setManuscriptTextImportError(null);
    } else {
      setManuscriptTextImportError(
        "가져온 원고를 현재 회차에 적용하지 못했습니다.",
      );
    }
    setManuscriptTextImportAction("idle");
  }, [input.document, input.editor, manuscriptTextImport, manuscriptTextImportAction]);

  const closeManuscriptTextImport = useCallback(() => {
    if (manuscriptTextImportAction !== "idle") return;
    setManuscriptTextImport(null);
    setManuscriptTextImportError(null);
  }, [manuscriptTextImportAction]);

  return {
    showForwardWritingDialog,
    activeForwardWriting,
    heatmapMode,
    manuscriptAnalysis,
    manuscriptTextImport,
    manuscriptTextImportAction,
    manuscriptTextImportError,
    pendingManuscriptPreflight,
    pendingManuscriptBulkExport,
    preflightActionError,
    openForwardWritingDialog,
    closeForwardWritingDialog,
    startForwardWriting,
    stopForwardWriting,
    changeHeatmapMode,
    openManuscriptAnalysis,
    closeManuscriptAnalysis,
    openManuscriptPreflight,
    openManuscriptBulkExport,
    closeManuscriptPreflight,
    closeManuscriptBulkExport,
    saveManuscriptPreflightSettings,
    applyManuscriptPreflight,
    exportManuscriptPreflight,
    exportManuscriptBulk,
    selectManuscriptTextImport,
    applyManuscriptTextImport,
    closeManuscriptTextImport,
  };
}
