import type { ComponentProps, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import type { useManuscriptSearchController } from "../../features/editor-tools/useManuscriptSearchController";
import { CreateDocumentControl } from "./DocumentControls";
import { DocumentFolderTree } from "./DocumentFolderTree";

function renderInHost(
  content: ReactNode,
  host: HTMLElement | null | undefined,
): ReactNode {
  return host === null || host === undefined
    ? content
    : createPortal(content, host);
}

type DocumentTreeCommands = Pick<
  ComponentProps<typeof DocumentFolderTree>,
  | "onActivateDocument"
  | "onCreateFolder"
  | "onPlaceDocument"
  | "onRenameDocument"
  | "onRenameFolder"
  | "onRetireDocument"
  | "onRetireAllDocuments"
  | "onRetireFolder"
>;

export function DocumentRailHost(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeDocumentId: string | null;
  activeWork: WorkspaceWorkSummary | null;
  commands: Readonly<{
    clearWorkspaceError: () => void;
    createDocument: () => Promise<unknown>;
    moveDocument: (
      workId: WorkspaceWorkSummary["workId"],
      ...args: Parameters<
        ComponentProps<typeof DocumentFolderTree>["onMoveDocument"]
      >
    ) => Promise<unknown>;
    retireWork: (
      workId: WorkspaceWorkSummary["workId"],
    ) => Promise<unknown>;
    startWorkTitleEdit: (title: string) => void;
    toggleLeftRail: () => void;
    tree: DocumentTreeCommands;
  }>;
  documentRailHost: HTMLElement | null | undefined;
  embedded: boolean;
  leftRail: Readonly<{
    reentryVisible: boolean;
    visible: boolean;
  }> | null;
  railId: string;
  ready: boolean;
  search: ReturnType<typeof useManuscriptSearchController>;
  sharesDocumentRailWithSidebar: boolean;
  titleEditTarget: string | null;
  workspaceActionError: string | null;
  workspaceActionState: string;
}>) {
  const activeDocument = input.activeDocument;
  const activeWork = input.activeWork;
  const disabled =
    input.workspaceActionState !== "idle" || input.titleEditTarget !== null;
  const documentCreateControl = (
    <CreateDocumentControl
      disabled={disabled}
      onCreate={() => {
        input.commands.clearWorkspaceError();
        void input.commands.createDocument().catch(() => undefined);
      }}
    />
  );
  const requestRetireActiveWork = (): void => {
    if (
      activeWork === null ||
      disabled ||
      !window.confirm(
        `‘${activeWork.title}’ 작품을 작업실에서 삭제할까요?\n원고와 기록은 복구를 위해 보존됩니다.`,
      )
    ) {
      return;
    }
    void input.commands.retireWork(activeWork.workId).catch(() => undefined);
  };
  const retireActiveWorkButton = activeWork === null ? null : (
    <button
      aria-label={`${activeWork.title} 작품 삭제`}
      className="title-retire-button"
      disabled={disabled}
      onClick={requestRetireActiveWork}
      title="작품 삭제"
      type="button"
    >
      <Trash2 aria-hidden="true" size={14} />
    </button>
  );

  return (
    <>
      {input.ready &&
        activeWork !== null &&
        activeDocument === null &&
        input.sharesDocumentRailWithSidebar &&
        renderInHost(
          <aside
            aria-label="문서 레일"
            className="workspace-rail workspace-rail-left"
            id={input.railId}
          >
            <header className="workspace-rail-header">
              <div className="workspace-rail-title">
                <h3>{activeWork.title}</h3>
                <button
                  aria-label="작품 이름 변경"
                  className="title-edit-button"
                  disabled={disabled}
                  onClick={() =>
                    input.commands.startWorkTitleEdit(activeWork.title)
                  }
                  type="button"
                >
                  <Pencil aria-hidden="true" size={13} />
                </button>
                {retireActiveWorkButton}
              </div>
            </header>
            <p className="empty-document-rail-state">
              이 작품에는 회차가 없습니다.
            </p>
            <DocumentFolderTree
              activeDocumentId={input.activeDocumentId}
              disabled={input.workspaceActionState !== "idle"}
              documentCreateControl={documentCreateControl}
              onMoveDocument={async (documentId, direction) => {
                await input.commands.moveDocument(
                  activeWork.workId,
                  documentId,
                  direction,
                );
              }}
              {...input.commands.tree}
              work={activeWork}
            />
            {input.workspaceActionError !== null && (
              <p className="workspace-action-error" role="alert">
                {input.workspaceActionError}
              </p>
            )}
          </aside>,
          input.documentRailHost,
        )}
      {input.ready &&
        activeWork !== null &&
        activeDocument !== null &&
        (input.sharesDocumentRailWithSidebar || input.leftRail?.visible) &&
        renderInHost(
          <aside
            aria-label="문서 레일"
            className="workspace-rail workspace-rail-left"
            id={input.railId}
          >
            <header className="workspace-rail-header">
              <div className="workspace-rail-title">
                <h3>{activeWork.title}</h3>
                <button
                  aria-label="작품 이름 변경"
                  className="title-edit-button"
                  disabled={disabled}
                  onClick={() =>
                    input.commands.startWorkTitleEdit(activeWork.title)
                  }
                  type="button"
                >
                  <Pencil aria-hidden="true" size={13} />
                </button>
                {retireActiveWorkButton}
              </div>
              {!input.sharesDocumentRailWithSidebar && (
                <button
                  aria-label="문서 레일 닫기"
                  aria-controls={input.railId}
                  className="rail-toggle"
                  onClick={input.commands.toggleLeftRail}
                  type="button"
                >
                  {input.embedded ? (
                    <PanelLeftClose aria-hidden="true" size={16} />
                  ) : (
                    "닫기"
                  )}
                </button>
              )}
            </header>
            <DocumentFolderTree
              activeDocumentId={input.activeDocumentId}
              disabled={disabled}
              documentCreateControl={documentCreateControl}
              onMoveDocument={async (documentId, direction) => {
                await input.commands.moveDocument(
                  activeWork.workId,
                  documentId,
                  direction,
                );
              }}
              {...input.commands.tree}
              work={activeWork}
            />
            {input.workspaceActionError !== null && (
              <p className="workspace-action-error" role="alert">
                {input.workspaceActionError}
              </p>
            )}
            <form
              className="manuscript-search"
              onSubmit={(event) => {
                event.preventDefault();
                input.search.executeSearch();
              }}
              role="search"
            >
              <label>
                <span>작품 원고 검색</span>
                <input
                  aria-label="원고 검색"
                  onChange={(event) => {
                    input.search.changeQuery(event.target.value);
                  }}
                  placeholder="원고 검색"
                  type="search"
                  value={input.search.query}
                />
              </label>
              <button
                aria-label="검색"
                disabled={input.search.query.length === 0}
                type="submit"
              >
                {input.embedded ? (
                  <Search aria-hidden="true" size={15} />
                ) : (
                  "검색"
                )}
              </button>
            </form>
            {input.search.search !== null &&
              input.search.search.result.workId === activeDocument.workId && (
                <section
                  aria-label="원고 검색 결과"
                  className="manuscript-search-results"
                >
                  <output
                    className="visually-hidden"
                    data-testid="search-run-sequence"
                  >
                    {input.search.search.sequence}
                  </output>
                  <p data-testid="search-result-summary">
                    {input.search.search.result.matchingDocumentCount}개 문서 ·{
                      " "
                    }
                    {input.search.search.result.totalMatchCount}개 일치
                  </p>
                  <ul>
                    {input.search.search.result.documents.map((document) => (
                      <li key={document.documentId}>
                        <button
                          onClick={() =>
                            input.commands.tree.onActivateDocument(
                              document.documentId,
                            )
                          }
                          type="button"
                        >
                          {document.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
          </aside>,
          input.documentRailHost,
        )}
      {input.ready &&
        activeDocument !== null &&
        !input.sharesDocumentRailWithSidebar &&
        input.leftRail?.reentryVisible && (
          <button
            aria-controls={input.railId}
            aria-label="문서 레일 열기"
            className="rail-reentry rail-reentry-left"
            onClick={input.commands.toggleLeftRail}
            title="문서 탐색"
            type="button"
          >
            {input.embedded ? (
              <PanelLeftOpen aria-hidden="true" size={17} />
            ) : (
              "문서"
            )}
          </button>
        )}
    </>
  );
}
