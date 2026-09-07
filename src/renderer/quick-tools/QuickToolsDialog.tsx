import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  BookOpen,
  FileText,
  Home,
  LayoutGrid,
  Plus,
  Save,
  Search,
  StickyNote,
  X,
} from "lucide-react";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

import type {
  WorkQuickMemoProjection,
} from "../../application/quick-tools/work-quick-memo";
import {
  searchQuickToolTargets,
  type QuickToolTarget,
} from "../../application/quick-tools/quick-tool-search";
import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../application/workspace/workspace-contract";
import type { StudioBridge } from "../../application/contracts/studio-bridge";
import type { StudioToolDescriptor } from "./studio-tool-registry";

const EMPTY_TOOLS: readonly StudioToolDescriptor[] = Object.freeze([]);

type MemoState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready" | "saving";
      readonly projection: WorkQuickMemoProjection;
    }
  | { readonly status: "error"; readonly message: string };

export const QUICK_TOOL_MAIN_COMMAND_ID = "quick-tool:main";
export const QUICK_TOOL_CREATE_WORK_COMMAND_ID = "quick-tool:create-work";

function createTargets(
  catalog: WorkspaceCatalogProjection,
  tools: readonly StudioToolDescriptor[],
): readonly QuickToolTarget[] {
  const targets: QuickToolTarget[] = [
    {
      id: QUICK_TOOL_MAIN_COMMAND_ID,
      kind: "command",
      label: "메인 열기",
      detail: "작품과 일정을 한 화면에서 봅니다.",
      workId: null,
      documentId: null,
    },
  ];
  for (const group of new Set(tools.map((tool) => tool.group))) {
    for (const tool of tools.filter((candidate) => candidate.group === group)) {
      targets.push({
        id: tool.id,
        kind: "command",
        label: tool.label,
        detail: tool.detail,
        keywords: tool.keywords ?? [],
        workId: null,
        documentId: null,
      });
    }
  }
  for (const work of catalog.works) {
    targets.push({
      id: `work:${work.workId}`,
      kind: "work",
      label: work.title,
      detail: `${work.documents.length}개 회차`,
      workId: work.workId,
      documentId: null,
    });
    for (const document of work.documents) {
      targets.push({
        id: `document:${document.documentId}`,
        kind: "document",
        label: document.title,
        detail: work.title,
        workId: work.workId,
        documentId: document.documentId,
      });
    }
  }
  targets.push({
    id: QUICK_TOOL_CREATE_WORK_COMMAND_ID,
    kind: "command",
    label: "새 작품 만들기",
    detail: "로컬 작업실에 작품을 추가합니다.",
    workId: null,
    documentId: null,
  });
  return Object.freeze(targets);
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function countQuickMemoCharacters(text: string): number {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
  ).length;
}

function TargetIcon({ kind }: { readonly kind: QuickToolTarget["kind"] }) {
  if (kind === "document") {
    return <FileText aria-hidden="true" size={17} />;
  }
  if (kind === "work") {
    return <BookOpen aria-hidden="true" size={17} />;
  }
  return <Home aria-hidden="true" size={17} />;
}

export function QuickToolsDialog(input: {
  readonly tools?: readonly StudioToolDescriptor[];
  readonly client: StudioBridge["quickTools"];
  readonly catalog: WorkspaceCatalogProjection;
  readonly disabled: boolean;
  readonly onClose: () => void;
  readonly onSelect: (target: QuickToolTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const identity = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showMemo, setShowMemo] = useState(false);
  const [memoState, setMemoState] = useState<MemoState>({ status: "loading" });
  const [memoDraft, setMemoDraft] = useState("");
  const tools = input.tools ?? EMPTY_TOOLS;
  const toolsById = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);
  const groups = useMemo(() => Array.from(new Set(tools.map((tool) => tool.group))), [tools]);
  const targets = useMemo(() => createTargets(input.catalog, tools), [input.catalog, tools]);
  const visibleTargets = useMemo(
    () =>
      searchQuickToolTargets({
        targets: group === null ? targets : targets.filter((target) =>
          group === "작품·회차" ? target.kind !== "command" : toolsById.get(target.id)?.group === group),
        query,
        activeWorkId: input.catalog.activeWorkId,
        activeDocumentId: input.catalog.activeDocumentId,
      }),
    [group, input.catalog.activeDocumentId, input.catalog.activeWorkId, query, targets, toolsById],
  );
  const visibleTargetIndex = useMemo(
    () => new Map(visibleTargets.map((target, index) => [target.id, index])),
    [visibleTargets],
  );
  const activeWork: WorkspaceWorkSummary | null =
    input.catalog.works.find(
      (work) => work.workId === input.catalog.activeWorkId,
    ) ?? null;
  const safeSelectedIndex =
    visibleTargets.length === 0
      ? -1
      : Math.min(selectedIndex, visibleTargets.length - 1);
  const memoProjection =
    memoState.status === "ready" || memoState.status === "saving"
      ? memoState.projection
      : null;
  const memoChanged =
    memoProjection !== null && memoDraft !== memoProjection.text;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: input.disabled || memoState.status === "saving",
    onClose: input.onClose,
  });

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>(`[data-result-index="${safeSelectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [safeSelectedIndex, query, group]);

  useEffect(() => {
    if (activeWork === null) {
      return;
    }
    let disposed = false;
    void input.client.getMemo({
      schemaVersion: 1,
      workId: activeWork.workId,
    }).then(
      (projection) => {
        if (disposed) return;
        setMemoDraft(projection.text);
        setMemoState({ status: "ready", projection });
      },
      () => {
        if (disposed) return;
        setMemoState({
          status: "error",
          message: "이 작품의 빠른 메모를 불러오지 못했습니다.",
        });
      },
    );
    return () => {
      disposed = true;
    };
  }, [activeWork, input.client]);

  const selectTarget = (target: QuickToolTarget | undefined) => {
    if (target === undefined || input.disabled || memoState.status === "saving" || toolsById.get(target.id)?.disabledReason) return;
    input.onSelect(target);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      input.onClose();
      return;
    }
    if (visibleTargets.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % visibleTargets.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(
        (current) => (current - 1 + visibleTargets.length) % visibleTargets.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectTarget(visibleTargets[safeSelectedIndex]);
    }
  };

  const saveMemo = () => {
    if (
      activeWork === null ||
      memoProjection === null ||
      memoState.status !== "ready" ||
      !memoChanged
    ) {
      return;
    }
    setMemoState({ status: "saving", projection: memoProjection });
    void input.client.saveMemo({
      schemaVersion: 1,
      workId: activeWork.workId,
      expectedRevision: memoProjection.revision,
      text: memoDraft,
    }).then(
      (projection) => {
        setMemoState({ status: "ready", projection });
      },
      () => {
        setMemoState({
          status: "error",
          message: "빠른 메모를 저장하지 못했습니다. 다시 열어 최신 상태를 확인해 주세요.",
        });
      },
    );
  };

  const renderTarget = (
    target: QuickToolTarget,
    hierarchyClassName: string,
  ) => {
    const index = visibleTargetIndex.get(target.id);
    if (index === undefined) return null;
    return (
      <button
        aria-selected={index === safeSelectedIndex}
        className={
          index === safeSelectedIndex
            ? `quick-tool-result ${hierarchyClassName} is-selected`
            : `quick-tool-result ${hierarchyClassName}`
        }
        disabled={input.disabled}
        id={`${identity}-target-${index}`}
        data-result-index={index}
        aria-disabled={Boolean(toolsById.get(target.id)?.disabledReason) || undefined}
        key={target.id}
        onClick={() => selectTarget(target)}
        onMouseEnter={() => setSelectedIndex(index)}
        role="option"
        tabIndex={-1}
        type="button"
      >
        <span className="quick-tool-result-icon">
          {target.id === QUICK_TOOL_CREATE_WORK_COMMAND_ID ? (
            <Plus aria-hidden="true" size={17} />
          ) : (
            target.kind === "command" && toolsById.has(target.id)
              ? <LayoutGrid aria-hidden="true" size={17} />
              : <TargetIcon kind={target.kind} />
          )}
        </span>
        <span className="quick-tool-result-copy">
          <strong>{target.label}</strong>
          <small>{target.detail}</small>
          {toolsById.get(target.id)?.disabledReason && (
            <span className="quick-tool-disabled-reason">{toolsById.get(target.id)?.disabledReason}</span>
          )}
        </span>
        <span className="quick-tool-result-kind">
          {target.kind === "document"
            ? "회차"
            : target.kind === "work"
              ? "작품"
              : "명령"}
        </span>
      </button>
    );
  };

  return (
    <div
      className="dialog-backdrop quick-tools-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="quick-tools-heading"
        aria-modal="true"
        className={showMemo ? "quick-tools-dialog is-memo-open" : "quick-tools-dialog"}
        ref={dialogRef}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ) ?? []).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}
        role="dialog"
      >
        <header className="quick-tools-header">
          <div>
            <p className="panel-kicker">작업실 도구</p>
            <h2 id="quick-tools-heading">빠른 도구</h2>
            <p className="quick-tools-description">기능을 찾거나 작품·회차로 바로 이동하세요.</p>
          </div>
          <div className="quick-tools-actions">
            <button
              aria-expanded={showMemo}
              aria-label={showMemo ? "빠른 메모 닫기" : "빠른 메모 열기"}
              className="quick-tools-memo-toggle"
              disabled={input.disabled || memoState.status === "saving"}
              onClick={() => setShowMemo((current) => !current)}
              type="button"
            >
              <StickyNote aria-hidden="true" size={15} />
              메모
            </button>
            <button
              aria-label="빠른 도구 닫기"
              className="dialog-close"
              disabled={input.disabled || memoState.status === "saving"}
              onClick={input.onClose}
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        </header>

        <div className="quick-tools-body">
          <section className="quick-switch-panel" aria-label="빠른 전환">
            <label className="quick-tool-search-field">
              <Search aria-hidden="true" size={17} />
              <span className="visually-hidden">작품, 회차 또는 명령 검색</span>
              <input
                aria-label="작품, 회차 또는 명령 검색"
                aria-controls={`${identity}-results`}
                aria-autocomplete="list"
                aria-expanded="true"
                role="combobox"
                aria-activedescendant={
                  safeSelectedIndex < 0
                    ? undefined
                    : `${identity}-target-${safeSelectedIndex}`
                }
                autoFocus
                disabled={input.disabled}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="기능, 작품, 회차 검색 · 예: 파편, 백업, 인물"
                ref={searchRef}
                type="search"
                value={query}
              />
              <kbd aria-hidden="true">Esc</kbd>
            </label>
            {groups.length > 0 && (
              <div className="quick-tool-categories" aria-label="도구 분류">
                {[null, ...groups, "작품·회차"].map((category) => (
                  <button
                    aria-pressed={group === category}
                    key={category ?? "all"}
                    onClick={() => { setGroup(category); setSelectedIndex(0); }}
                    type="button"
                  >{category ?? "전체"}</button>
                ))}
              </div>
            )}
            <div
              aria-label="빠른 이동 결과"
              id={`${identity}-results`}
              className="quick-tool-results"
              role="listbox"
            >
              {visibleTargets.length === 0 ? (
                <div className="quick-tool-empty">
                  <strong>일치하는 항목이 없습니다.</strong>
                  <p>다른 이름으로 검색하거나 전체 도구를 살펴보세요.</p>
                  <button onClick={() => { setQuery(""); setGroup(null); searchRef.current?.focus(); }} type="button">전체 도구 보기</button>
                </div>
              ) : (
                <>
                  {visibleTargetIndex.has(QUICK_TOOL_MAIN_COMMAND_ID) && (
                    <div
                      aria-label="메인 명령"
                      className="quick-tool-result-group quick-tool-command-group"
                      role="group"
                    >
                      <p className="quick-tool-group-label">메인</p>
                      {renderTarget(
                        targets.find(
                          (target) => target.id === QUICK_TOOL_MAIN_COMMAND_ID,
                        )!,
                        "quick-tool-command-result",
                      )}
                    </div>
                  )}
                  {groups.map((category) => {
                    const commands = visibleTargets.filter((target) => toolsById.get(target.id)?.group === category);
                    return commands.length === 0 ? null : (
                      <div className="quick-tool-result-group" aria-label={category} role="group" key={category}>
                        <p className="quick-tool-group-label">{category}</p>
                        {commands.map((target) => renderTarget(target, "quick-tool-command-result"))}
                      </div>
                    );
                  })}
                  {input.catalog.works.map((work) => {
                    const workTarget = targets.find(
                      (target) => target.id === `work:${work.workId}`,
                    );
                    const visibleDocuments = work.documents
                      .map((document) =>
                        targets.find(
                          (target) =>
                            target.id === `document:${document.documentId}`,
                        ),
                      )
                      .filter(
                        (target): target is QuickToolTarget =>
                          target !== undefined &&
                          visibleTargetIndex.has(target.id),
                      );
                    const showWork =
                      workTarget !== undefined &&
                      visibleTargetIndex.has(workTarget.id);
                    if (!showWork && visibleDocuments.length === 0) return null;
                    return (
                      <div
                        aria-label={`${work.title} 작품과 회차`}
                        className="quick-tool-result-group quick-tool-work-group"
                        key={work.workId}
                        role="group"
                      >
                        {showWork && workTarget !== undefined ? (
                          renderTarget(workTarget, "quick-tool-work-result")
                        ) : (
                          <p className="quick-tool-work-context">{work.title}</p>
                        )}
                        {visibleDocuments.map((target) =>
                          renderTarget(target, "quick-tool-document-result"),
                        )}
                      </div>
                    );
                  })}
                  {visibleTargetIndex.has(QUICK_TOOL_CREATE_WORK_COMMAND_ID) && (
                    <div
                      aria-label="새로 만들기 명령"
                      className="quick-tool-result-group quick-tool-create-group"
                      role="group"
                    >
                      <p className="quick-tool-group-label">새로 만들기</p>
                      {renderTarget(
                        targets.find(
                          (target) =>
                            target.id === QUICK_TOOL_CREATE_WORK_COMMAND_ID,
                        )!,
                        "quick-tool-command-result",
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {showMemo && <section className="quick-memo-panel" aria-labelledby="quick-memo-heading">
            <header>
              <span className="quick-memo-icon" aria-hidden="true">
                <StickyNote size={18} />
              </span>
              <div>
                <h3 id="quick-memo-heading">빠른 메모</h3>
                <p>{activeWork?.title ?? "열린 작품 없음"}</p>
              </div>
            </header>
            {activeWork === null ? (
              <p className="quick-memo-empty">
                작품을 열면 그 작품에만 속한 메모를 남길 수 있습니다.
              </p>
            ) : memoState.status === "loading" ? (
              <p className="quick-memo-empty">메모를 불러오는 중입니다.</p>
            ) : memoState.status === "error" ? (
              <p className="quick-memo-error" role="alert">{memoState.message}</p>
            ) : (
              <>
                <textarea
                  aria-label={`${activeWork.title} 빠른 메모`}
                  disabled={memoState.status === "saving"}
                  onChange={(event) => setMemoDraft(event.target.value)}
                  placeholder="이 작품에서 바로 확인할 내용을 적어 두세요."
                  value={memoDraft}
                />
                <div className="quick-memo-meta">
                  <span>{countQuickMemoCharacters(memoDraft)}자</span>
                  <span>
                    {memoState.projection.updatedAt === null
                      ? "저장된 메모 없음"
                      : formatUpdatedAt(memoState.projection.updatedAt)}
                  </span>
                </div>
                <p className="quick-memo-boundary">
                  이 메모는 작품에 저장되며 원고에 자동 삽입되지 않습니다.
                </p>
                <button
                  className="quick-memo-save"
                  disabled={
                    input.disabled || memoState.status === "saving" || !memoChanged
                  }
                  onClick={saveMemo}
                  type="button"
                >
                  <Save aria-hidden="true" size={15} />
                  {memoState.status === "saving" ? "저장 중" : "메모 저장"}
                </button>
              </>
            )}
          </section>}
        </div>
        <footer className="quick-tools-footer">
          <span className="quick-tool-result-count" aria-live="polite">{visibleTargets.length}개 항목</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> 이동</span>
          <span><kbd>Enter</kbd> 열기</span>
          <span><kbd>Esc</kbd> 닫기</span>
        </footer>
      </section>
    </div>
  );
}
