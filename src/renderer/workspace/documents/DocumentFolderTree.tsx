import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";

import type {
  MoveDocumentCommand,
  WorkspaceDocumentFolderSummary,
  WorkspaceDocumentSummary,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";

type DocumentDropPreview = Readonly<{
  sourceDocumentId: WorkspaceDocumentSummary["documentId"];
}> & (
  | Readonly<{
      kind: "document";
      targetDocumentId: WorkspaceDocumentSummary["documentId"];
      placement: "before" | "after";
    }>
  | Readonly<{
      kind: "folder";
      folderId: WorkspaceDocumentFolderSummary["folderId"] | null;
    }>
);

type DocumentPointerDrag = Readonly<{
  pointerId: number;
  documentId: WorkspaceDocumentSummary["documentId"];
  originX: number;
  originY: number;
  clientX: number;
  clientY: number;
  active: boolean;
  captureElement: HTMLElement;
}>;

const DOCUMENT_DRAG_START_DISTANCE = 6;
const DOCUMENT_DRAG_AUTO_SCROLL_EDGE = 42;
const DOCUMENT_DRAG_AUTO_SCROLL_STEP = 12;
const DEFAULT_DOCUMENT_FOLDER_TITLE = "제목없음";
const EPISODE_DELETE_WARNING_SUPPRESSED_STORAGE_KEY =
  "eum_episode_delete_warning_suppressed_v1";

type EpisodeRetirementRequest =
  | Readonly<{
      kind: "document";
      document: WorkspaceDocumentSummary;
    }>
  | Readonly<{
      kind: "all";
    }>;

export function DocumentFolderTree({
  work,
  documentCreateControl,
  activeDocumentId,
  disabled,
  onActivateDocument,
  onRenameDocument,
  onCreateDocument,
  onCreateFolder,
  onMoveDocument,
  onRenameFolder,
  onPlaceDocument,
  onRetireDocument,
  onRetireAllDocuments,
  onRetireFolder,
}: {
  readonly work: WorkspaceWorkSummary;
  readonly documentCreateControl: ReactNode;
  readonly activeDocumentId: string | null;
  readonly disabled: boolean;
  readonly onActivateDocument: (documentId: string) => void;
  readonly onRenameDocument: (
    document: WorkspaceDocumentSummary,
    title: string,
  ) => Promise<void>;
  readonly onCreateDocument: (
    folderId?: WorkspaceDocumentFolderSummary["folderId"] | null,
  ) => Promise<void>;
  readonly onCreateFolder: (
    title: string,
    parentFolderId: WorkspaceDocumentFolderSummary["folderId"] | null,
  ) => Promise<void>;
  readonly onMoveDocument: (
    documentId: WorkspaceDocumentSummary["documentId"],
    direction: MoveDocumentCommand["direction"],
  ) => Promise<void>;
  readonly onRenameFolder: (
    folderId: WorkspaceDocumentFolderSummary["folderId"],
    title: string,
  ) => Promise<void>;
  readonly onPlaceDocument: (
    documentId: WorkspaceDocumentSummary["documentId"],
    folderId: WorkspaceDocumentFolderSummary["folderId"] | null,
  ) => Promise<void>;
  readonly onRetireDocument: (
    document: WorkspaceDocumentSummary,
  ) => Promise<void>;
  readonly onRetireAllDocuments: () => Promise<void>;
  readonly onRetireFolder: (
    folder: WorkspaceDocumentFolderSummary,
  ) => Promise<void>;
}) {
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [renameDocumentId, setRenameDocumentId] = useState<
    WorkspaceDocumentSummary["documentId"] | null
  >(null);
  const [renameDocumentTitle, setRenameDocumentTitle] = useState("");
  const renameDocumentPendingRef = useRef<
    WorkspaceDocumentSummary["documentId"] | null
  >(null);
  const documentPointerDragRef = useRef<DocumentPointerDrag | null>(null);
  const documentDropPreviewRef = useRef<DocumentDropPreview | null>(null);
  const documentDropPendingRef = useRef(false);
  const documentDragSuppressClickRef = useRef<
    WorkspaceDocumentSummary["documentId"] | null
  >(null);
  const documentTreeRef = useRef<HTMLDivElement | null>(null);
  const documentAutoScrollFrameRef = useRef<number | null>(null);
  const [documentDropPreview, setDocumentDropPreview] =
    useState<DocumentDropPreview | null>(null);
  const [renameFolderId, setRenameFolderId] = useState<
    WorkspaceDocumentFolderSummary["folderId"] | null
  >(null);
  const [renameFolderTitle, setRenameFolderTitle] = useState("");
  const [episodeRetirementRequest, setEpisodeRetirementRequest] =
    useState<EpisodeRetirementRequest | null>(null);
  const [suppressEpisodeDeleteWarning, setSuppressEpisodeDeleteWarning] =
    useState(false);
  const episodeDeleteWarningSuppressed = (): boolean => {
    try {
      return window.localStorage.getItem(
        EPISODE_DELETE_WARNING_SUPPRESSED_STORAGE_KEY,
      ) === "true";
    } catch {
      return false;
    }
  };
  const runEpisodeRetirement = (request: EpisodeRetirementRequest): void => {
    const operation = request.kind === "document"
      ? onRetireDocument(request.document)
      : onRetireAllDocuments();
    void operation.catch(() => undefined);
  };
  const requestEpisodeRetirement = (
    request: EpisodeRetirementRequest,
  ): void => {
    if (disabled) return;
    if (episodeDeleteWarningSuppressed()) {
      runEpisodeRetirement(request);
      return;
    }
    setSuppressEpisodeDeleteWarning(false);
    setEpisodeRetirementRequest(request);
  };
  const confirmEpisodeRetirement = (): void => {
    const request = episodeRetirementRequest;
    if (request === null) return;
    if (suppressEpisodeDeleteWarning) {
      try {
        window.localStorage.setItem(
          EPISODE_DELETE_WARNING_SUPPRESSED_STORAGE_KEY,
          "true",
        );
      } catch {
        // The deletion still proceeds when UI preference storage is unavailable.
      }
    }
    setEpisodeRetirementRequest(null);
    setSuppressEpisodeDeleteWarning(false);
    runEpisodeRetirement(request);
  };
  const foldersByParentId = useMemo(() => {
    const groups = new Map<
      WorkspaceDocumentFolderSummary["folderId"] | null,
      WorkspaceDocumentFolderSummary[]
    >();
    for (const folder of work.folders) {
      const siblings = groups.get(folder.parentFolderId) ?? [];
      siblings.push(folder);
      groups.set(folder.parentFolderId, siblings);
    }
    return groups;
  }, [work.folders]);
  const documentsByFolderId = useMemo(() => {
    const groups = new Map<
      WorkspaceDocumentFolderSummary["folderId"] | null,
      WorkspaceDocumentSummary[]
    >();
    for (const document of work.documents) {
      const siblings = groups.get(document.folderId) ?? [];
      siblings.push(document);
      groups.set(document.folderId, siblings);
    }
    return groups;
  }, [work.documents]);
  const beginDocumentRename = (document: WorkspaceDocumentSummary) => {
    if (disabled) return;
    setRenameDocumentId(document.documentId);
    setRenameDocumentTitle("");
  };
  const cancelDocumentRename = () => {
    setRenameDocumentId(null);
    setRenameDocumentTitle("");
  };
  const commitDocumentRename = async (
    document: WorkspaceDocumentSummary,
  ): Promise<void> => {
    const title = renameDocumentTitle.trim();
    if (
      title.length === 0 ||
      renameDocumentPendingRef.current === document.documentId
    ) {
      return;
    }
    if (title === document.title) {
      setRenameDocumentId(null);
      setRenameDocumentTitle("");
      return;
    }
    renameDocumentPendingRef.current = document.documentId;
    try {
      await onRenameDocument(document, title);
      setRenameDocumentId(null);
      setRenameDocumentTitle("");
    } finally {
      renameDocumentPendingRef.current = null;
    }
  };
  const setCurrentDocumentDropPreview = useCallback(
    (preview: DocumentDropPreview | null) => {
      documentDropPreviewRef.current = preview;
      setDocumentDropPreview(preview);
    },
    [],
  );
  const stopDocumentAutoScroll = useCallback(() => {
    if (documentAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(documentAutoScrollFrameRef.current);
      documentAutoScrollFrameRef.current = null;
    }
  }, []);
  const clearDocumentPointerDrag = useCallback(() => {
    const drag = documentPointerDragRef.current;
    documentPointerDragRef.current = null;
    setCurrentDocumentDropPreview(null);
    stopDocumentAutoScroll();
    if (
      drag !== null &&
      drag.captureElement.hasPointerCapture(drag.pointerId)
    ) {
      drag.captureElement.releasePointerCapture(drag.pointerId);
    }
  }, [setCurrentDocumentDropPreview, stopDocumentAutoScroll]);
  const resolveDocumentDropPreview = useCallback(
    (
      drag: DocumentPointerDrag,
      clientX: number,
      clientY: number,
    ): DocumentDropPreview | null => {
      const source = work.documents.find(
        (document) => document.documentId === drag.documentId,
      );
      if (source === undefined) return null;
      const pointedElement = document.elementFromPoint(clientX, clientY);
      const targetDocumentElement = pointedElement?.closest<HTMLElement>(
        "[data-document-id]",
      ) ?? null;
      if (
        targetDocumentElement !== null &&
        targetDocumentElement.dataset.documentId !== drag.documentId
      ) {
        const target = work.documents.find(
          (document) =>
            document.documentId === targetDocumentElement.dataset.documentId,
        );
        if (target !== undefined) {
          const bounds = targetDocumentElement.getBoundingClientRect();
          return Object.freeze({
            kind: "document" as const,
            sourceDocumentId: drag.documentId,
            targetDocumentId: target.documentId,
            placement:
              clientY < bounds.top + bounds.height / 2 ? "before" : "after",
          });
        }
      }
      const targetFolderElement = pointedElement?.closest<HTMLElement>(
        "[data-document-folder-id]",
      ) ?? null;
      if (targetFolderElement !== null) {
        const folderId = targetFolderElement.dataset.documentFolderId;
        if (
          folderId !== undefined &&
          work.folders.some((folder) => folder.folderId === folderId)
        ) {
          return Object.freeze({
            kind: "folder" as const,
            sourceDocumentId: drag.documentId,
            folderId: folderId as WorkspaceDocumentFolderSummary["folderId"],
          });
        }
      }
      const rootTarget = pointedElement?.closest<HTMLElement>(
        "[data-document-root-drop-target]",
      );
      return rootTarget === null || rootTarget === undefined
        ? null
        : Object.freeze({
            kind: "folder" as const,
            sourceDocumentId: drag.documentId,
            folderId: null,
          });
    },
    [work.documents, work.folders],
  );
  const startDocumentAutoScroll = useCallback(() => {
    if (documentAutoScrollFrameRef.current !== null) return;
    const step = () => {
      const drag = documentPointerDragRef.current;
      const tree = documentTreeRef.current;
      if (drag === null || !drag.active || tree === null) {
        documentAutoScrollFrameRef.current = null;
        return;
      }
      const bounds = tree.getBoundingClientRect();
      const scrollDelta = drag.clientY < bounds.top + DOCUMENT_DRAG_AUTO_SCROLL_EDGE
        ? -DOCUMENT_DRAG_AUTO_SCROLL_STEP
        : drag.clientY > bounds.bottom - DOCUMENT_DRAG_AUTO_SCROLL_EDGE
          ? DOCUMENT_DRAG_AUTO_SCROLL_STEP
          : 0;
      if (scrollDelta !== 0) {
        tree.scrollTop += scrollDelta;
        setCurrentDocumentDropPreview(
          resolveDocumentDropPreview(drag, drag.clientX, drag.clientY),
        );
      }
      documentAutoScrollFrameRef.current = window.requestAnimationFrame(step);
    };
    documentAutoScrollFrameRef.current = window.requestAnimationFrame(step);
  }, [resolveDocumentDropPreview, setCurrentDocumentDropPreview]);
  const requestDocumentDrop = useCallback(
    async (preview: DocumentDropPreview): Promise<void> => {
      if (disabled || documentDropPendingRef.current) return;
      const source = work.documents.find(
        (document) => document.documentId === preview.sourceDocumentId,
      );
      if (source === undefined) return;
      documentDropPendingRef.current = true;
      try {
        if (preview.kind === "folder") {
          if (source.folderId !== preview.folderId) {
            await onPlaceDocument(source.documentId, preview.folderId);
          }
          return;
        }
        const sourceIndex = work.documents.findIndex(
          (document) => document.documentId === source.documentId,
        );
        const targetIndex = work.documents.findIndex(
          (document) => document.documentId === preview.targetDocumentId,
        );
        if (sourceIndex < 0 || targetIndex < 0) return;
        const target = work.documents[targetIndex];
        if (target === undefined) return;
        if (source.folderId !== target.folderId) {
          await onPlaceDocument(source.documentId, target.folderId);
        }
        let destinationIndex =
          targetIndex + (preview.placement === "after" ? 1 : 0);
        if (sourceIndex < destinationIndex) destinationIndex -= 1;
        const direction: MoveDocumentCommand["direction"] =
          destinationIndex < sourceIndex ? "earlier" : "later";
        const moveCount = Math.abs(destinationIndex - sourceIndex);
        for (let index = 0; index < moveCount; index += 1) {
          await onMoveDocument(source.documentId, direction);
        }
      } finally {
        documentDropPendingRef.current = false;
      }
    },
    [disabled, onMoveDocument, onPlaceDocument, work.documents],
  );
  const handleDocumentPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      document: WorkspaceDocumentSummary,
    ) => {
      if (
        event.button !== 0 ||
        disabled ||
        documentDropPendingRef.current ||
        documentPointerDragRef.current !== null
      ) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      documentPointerDragRef.current = Object.freeze({
        pointerId: event.pointerId,
        documentId: document.documentId,
        originX: event.clientX,
        originY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        active: false,
        captureElement: event.currentTarget,
      });
    },
    [disabled],
  );
  const handleDocumentPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = documentPointerDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const active = drag.active || Math.hypot(
        event.clientX - drag.originX,
        event.clientY - drag.originY,
      ) >= DOCUMENT_DRAG_START_DISTANCE;
      const currentDrag = Object.freeze({
        ...drag,
        clientX: event.clientX,
        clientY: event.clientY,
        active,
      });
      documentPointerDragRef.current = currentDrag;
      if (!active) return;
      event.preventDefault();
      setCurrentDocumentDropPreview(
        resolveDocumentDropPreview(currentDrag, event.clientX, event.clientY),
      );
      startDocumentAutoScroll();
    }, [
      resolveDocumentDropPreview,
      setCurrentDocumentDropPreview,
      startDocumentAutoScroll,
    ],
  );
  const handleDocumentPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = documentPointerDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const preview = documentDropPreviewRef.current;
      const wasActive = drag.active;
      clearDocumentPointerDrag();
      if (!wasActive) return;
      event.preventDefault();
      documentDragSuppressClickRef.current = drag.documentId;
      window.setTimeout(() => {
        if (documentDragSuppressClickRef.current === drag.documentId) {
          documentDragSuppressClickRef.current = null;
        }
      }, 0);
      if (preview !== null) {
        void requestDocumentDrop(preview).catch(() => undefined);
      }
    }, [clearDocumentPointerDrag, requestDocumentDrop]);

  useEffect(() => () => {
    stopDocumentAutoScroll();
  }, [stopDocumentAutoScroll]);
  const renderDocument = (
    document: WorkspaceDocumentSummary,
    depth: number,
  ) => {
    const editing = renameDocumentId === document.documentId;
    const documentTarget =
      documentDropPreview?.kind === "document" &&
      documentDropPreview.targetDocumentId === document.documentId
        ? documentDropPreview.placement
        : null;
    const rowClassName = [
      "document-tree-row",
      "document-tree-document",
      documentDropPreview?.sourceDocumentId === document.documentId
        ? "is-document-drag-source"
        : "",
      documentTarget === "before" ? "is-document-drop-before" : "",
      documentTarget === "after" ? "is-document-drop-after" : "",
    ].filter(Boolean).join(" ");
    return (
      <div
        className={rowClassName}
        data-document-id={document.documentId}
        key={document.documentId}
        style={{ "--document-tree-depth": depth } as CSSProperties}
      >
      {editing ? (
        <form
          aria-label={`${document.title} 회차 제목 편집`}
          className="document-title-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void commitDocumentRename(document).catch(() => undefined);
          }}
        >
          <FileText aria-hidden="true" size={14} />
          <input
            aria-label="회차 제목"
            autoFocus
            disabled={disabled}
            onBlur={cancelDocumentRename}
            onChange={(event) => setRenameDocumentTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelDocumentRename();
              }
            }}
            value={renameDocumentTitle}
          />
        </form>
      ) : (
        <button
          aria-current={
            document.documentId === activeDocumentId ? "page" : undefined
          }
          className={
            document.documentId === activeDocumentId
              ? "document-tree-open is-active"
              : "document-tree-open"
          }
          disabled={disabled}
          onClick={() => {
            if (
              documentDragSuppressClickRef.current === document.documentId
            ) {
              documentDragSuppressClickRef.current = null;
              return;
            }
            onActivateDocument(document.documentId);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            beginDocumentRename(document);
          }}
          onLostPointerCapture={() => {
            if (
              documentPointerDragRef.current?.documentId === document.documentId
            ) {
              clearDocumentPointerDrag();
            }
          }}
          onPointerCancel={clearDocumentPointerDrag}
          onPointerDown={(event) =>
            handleDocumentPointerDown(event, document)
          }
          onPointerMove={handleDocumentPointerMove}
          onPointerUp={handleDocumentPointerUp}
          type="button"
        >
          <span
            aria-label={
              document.completion.state === "current"
                ? "완료"
                : document.completion.state === "edited-after-completion"
                  ? "완료 후 수정됨"
                  : "미완료"
            }
            className={`document-completion-mark is-${document.completion.state}`}
          >
            {document.completion.state === "current"
              ? "✓"
              : document.completion.state === "edited-after-completion"
                ? "△"
                : "○"}
          </span>
          <span className="document-tree-title">{document.title}</span>
        </button>
      )}
      <button
        aria-label={`${document.title} 회차 삭제`}
        className="document-retire-button"
        disabled={disabled}
        onClick={() => {
          requestEpisodeRetirement({ kind: "document", document });
        }}
        title="회차 삭제"
        type="button"
      >
        <Trash2 aria-hidden="true" size={13} />
      </button>
      </div>
    );
  };
  const renderFolder = (
    folder: WorkspaceDocumentFolderSummary,
    depth: number,
  ): ReactNode => {
    const collapsed = collapsedFolderIds.has(folder.folderId);
    const childFolders = foldersByParentId.get(folder.folderId) ?? [];
    const childDocuments = documentsByFolderId.get(folder.folderId) ?? [];
    return (
      <div className="document-tree-folder-group" key={folder.folderId}>
        <div
          className={[
            "document-tree-row",
            "document-tree-folder",
            documentDropPreview?.kind === "folder" &&
              documentDropPreview.folderId === folder.folderId
              ? "is-document-folder-drop-target"
              : "",
          ].filter(Boolean).join(" ")}
          data-document-folder-id={folder.folderId}
          style={{ "--document-tree-depth": depth } as CSSProperties}
        >
          <button
            aria-label={`${folder.title} 폴더 ${collapsed ? "펼치기" : "접기"}`}
            className="document-folder-toggle"
            onClick={() => {
              setCollapsedFolderIds((current) => {
                const next = new Set(current);
                if (next.has(folder.folderId)) {
                  next.delete(folder.folderId);
                } else {
                  next.add(folder.folderId);
                }
                return next;
              });
            }}
            type="button"
          >
            {collapsed ? (
              <ChevronRight aria-hidden="true" size={14} />
            ) : (
              <ChevronDown aria-hidden="true" size={14} />
            )}
          </button>
          <Folder aria-hidden="true" size={14} />
          {renameFolderId === folder.folderId ? (
            <form
              aria-label={`${folder.title} 폴더 이름 변경`}
              className="document-folder-rename"
              onSubmit={(event) => {
                event.preventDefault();
                void onRenameFolder(folder.folderId, renameFolderTitle).then(
                  () => {
                    setRenameFolderId(null);
                    setRenameFolderTitle("");
                  },
                  () => undefined,
                );
              }}
            >
              <input
                aria-label="폴더 새 이름"
                autoFocus
                disabled={disabled}
                onChange={(event) => setRenameFolderTitle(event.target.value)}
                value={renameFolderTitle}
              />
              <button
                disabled={disabled || renameFolderTitle.trim().length === 0}
                type="submit"
              >
                저장
              </button>
            </form>
          ) : (
            <strong>{folder.title}</strong>
          )}
          <div className="document-folder-actions">
            <button
              aria-label={`${folder.title} 폴더에 새 문서 추가`}
              disabled={disabled}
              onClick={() => {
                void onCreateDocument(folder.folderId).then(() => {
                  setCollapsedFolderIds((current) => {
                    const next = new Set(current);
                    next.delete(folder.folderId);
                    return next;
                  });
                }).catch(() => undefined);
              }}
              title="새 문서 추가"
              type="button"
            >
              <FilePlus aria-hidden="true" size={13} />
            </button>
            <button
              aria-label={`${folder.title} 하위 폴더 추가`}
              disabled={disabled}
              onClick={() => {
                void onCreateFolder(
                  DEFAULT_DOCUMENT_FOLDER_TITLE,
                  folder.folderId,
                ).catch(() => undefined);
              }}
              title="하위 폴더 추가"
              type="button"
            >
              <FolderPlus aria-hidden="true" size={13} />
            </button>
            <button
              aria-label={`${folder.title} 폴더 이름 변경`}
              disabled={disabled}
              onClick={() => {
                setRenameFolderId(folder.folderId);
                setRenameFolderTitle(folder.title);
              }}
              title="폴더 이름 변경"
              type="button"
            >
              <Pencil aria-hidden="true" size={13} />
            </button>
            <button
              aria-label={`${folder.title} 폴더 삭제`}
              disabled={disabled}
              onClick={() => void onRetireFolder(folder)}
              title="폴더 삭제"
              type="button"
            >
              <Trash2 aria-hidden="true" size={13} />
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="document-tree-children">
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {childDocuments.map((document) =>
              renderDocument(document, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      aria-label="회차 폴더"
      className="document-folder-tree"
      data-document-drag-active={documentDropPreview !== null ? "true" : "false"}
    >
      <header
        className={
          documentDropPreview?.kind === "folder" &&
          documentDropPreview.folderId === null
            ? "is-document-root-drop-target"
            : undefined
        }
        data-document-root-drop-target="true"
      >
        <strong>문서</strong>
        <span className="document-folder-header-actions">
          {documentCreateControl}
          <button
            aria-label="폴더 추가"
            disabled={disabled}
            onClick={() => {
              void onCreateFolder(
                DEFAULT_DOCUMENT_FOLDER_TITLE,
                null,
              ).catch(() => undefined);
            }}
            title="폴더 추가"
            type="button"
          >
            <FolderPlus aria-hidden="true" size={14} />
          </button>
          <button
            aria-label="회차 전체 삭제"
            className="document-retire-all-button"
            disabled={disabled || work.documents.length === 0}
            onClick={() => requestEpisodeRetirement({ kind: "all" })}
            title="회차 전체 삭제"
            type="button"
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
        </span>
      </header>
      <div
        className="document-tree"
        aria-label="회차 폴더 트리"
        ref={documentTreeRef}
      >
        {(foldersByParentId.get(null) ?? []).map((folder) =>
          renderFolder(folder, 0),
        )}
        {(documentsByFolderId.get(null) ?? []).map((document) =>
          renderDocument(document, 0),
        )}
      </div>
      {episodeRetirementRequest !== null && createPortal(
        <div className="episode-delete-warning-backdrop">
          <section
            aria-label={
              episodeRetirementRequest.kind === "all"
                ? "회차 전체 삭제 경고"
                : "회차 삭제 경고"
            }
            aria-modal="true"
            className="episode-delete-warning-dialog"
            role="dialog"
          >
            <h3>
              {episodeRetirementRequest.kind === "all"
                ? "회차를 전체 삭제할까요?"
                : "회차를 삭제할까요?"}
            </h3>
            <p>
              {episodeRetirementRequest.kind === "all"
                ? `‘${work.title}’의 회차 ${work.documents.length}개를 모두 삭제합니다.`
                : `‘${episodeRetirementRequest.document.title}’ 회차를 삭제합니다.`}
              {" 원고와 기록은 복구를 위해 보존됩니다."}
            </p>
            <label className="episode-delete-warning-option">
              <input
                checked={suppressEpisodeDeleteWarning}
                onChange={(event) => {
                  setSuppressEpisodeDeleteWarning(event.currentTarget.checked);
                }}
                type="checkbox"
              />
              <span>다음부터 회차 삭제 경고 표시하지 않기</span>
            </label>
            <div className="episode-delete-warning-actions">
              <button
                onClick={() => {
                  setEpisodeRetirementRequest(null);
                  setSuppressEpisodeDeleteWarning(false);
                }}
                type="button"
              >
                취소
              </button>
              <button
                className="is-danger"
                onClick={confirmEpisodeRetirement}
                type="button"
              >
                {episodeRetirementRequest.kind === "all"
                  ? "전체 삭제"
                  : "삭제"}
              </button>
            </div>
          </section>
        </div>,
        document.querySelector<HTMLElement>(".studio-app-shell") ??
          document.body,
      )}
    </section>
  );
}
