import { useMemo, useState } from "react";

import type {
  FragmentProjection,
  FragmentShelfProfile,
  UpdateFragmentCommand,
} from "../../application/fragments/fragment-contract";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

export type FragmentShelfActionState =
  | "idle"
  | "capturing"
  | "moving"
  | "inserting"
  | "updating"
  | "retiring";

type FragmentChanges = UpdateFragmentCommand["changes"];

function sourceStatus(fragment: FragmentProjection): string {
  if (fragment.integrity === "resolved") {
    return fragment.range === null
      ? "원문 위치 연결 손상"
      : `${fragment.range.from}–${fragment.range.to}`;
  }
  return fragment.integrity === "needsReview"
    ? "원문 위치 검토 필요"
    : "원문 위치 연결 손상";
}

export function FragmentShelfDialog(input: {
  readonly actionState: FragmentShelfActionState;
  readonly canCapture: boolean;
  readonly canInsert: boolean;
  readonly documentLabels: Readonly<Record<string, string>>;
  readonly error: string | null;
  readonly fragments: readonly FragmentProjection[];
  readonly onCapture: (kindId: string) => void;
  readonly onClose: () => void;
  readonly onInsert: (fragment: FragmentProjection) => void;
  readonly onMove: (kindId: string) => void;
  readonly onOpenSource: (fragment: FragmentProjection) => void;
  readonly onRetire: (fragment: FragmentProjection) => void;
  readonly onUpdate: (
    fragment: FragmentProjection,
    changes: FragmentChanges,
  ) => void;
  readonly profile: FragmentShelfProfile;
}) {
  const [captureKindId, setCaptureKindId] = useState(
    input.profile.defaultKindId,
  );
  const [kindFilter, setKindFilter] = useState("all");
  const [query, setQuery] = useState("");
  const busy = input.actionState !== "idle";
  const onBackdropPointerDown = useDialogDismiss({
    disabled: busy,
    onClose: input.onClose,
  });
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleFragments = useMemo(
    () =>
      [...input.fragments]
        .filter(
          (fragment) =>
            kindFilter === "all" || fragment.kindId === kindFilter,
        )
        .filter((fragment) => {
          if (normalizedQuery.length === 0) {
            return true;
          }
          return `${fragment.title}\n${fragment.exactText}`
            .toLocaleLowerCase()
            .includes(normalizedQuery);
        })
        .sort((left, right) => {
          if (left.pinned !== right.pinned) {
            return left.pinned ? -1 : 1;
          }
          return right.updatedAt.localeCompare(left.updatedAt);
        }),
    [input.fragments, kindFilter, normalizedQuery],
  );

  return (
    <div
      className="dialog-backdrop fragment-shelf-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="fragment-shelf-heading"
        aria-modal="true"
        className="fragment-shelf-dialog"
        role="dialog"
      >
        <header className="fragment-shelf-header">
          <div>
            <p className="panel-kicker">FRAGMENT SHELF</p>
            <h2 id="fragment-shelf-heading">파편 서랍</h2>
            <p>
              선택 원문을 그대로 복사하거나 명시적으로 이동해 이 작품에
              보관합니다.
            </p>
          </div>
          <button
            aria-label="파편 서랍 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="fragment-shelf-toolbar">
          <label>
            <span>새 파편 종류</span>
            <select
              disabled={busy}
              onChange={(event) => setCaptureKindId(event.target.value)}
              value={captureKindId}
            >
              {input.profile.kinds.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="fragment-capture-button"
            disabled={busy || !input.canCapture}
            onClick={() => input.onCapture(captureKindId)}
            type="button"
          >
            {input.actionState === "capturing"
              ? "복사 중"
              : "선택을 복사"}
          </button>
          <button
            className="fragment-capture-button fragment-move-button"
            disabled={busy || !input.canCapture}
            onClick={() => input.onMove(captureKindId)}
            type="button"
          >
            {input.actionState === "moving"
              ? "이동 중"
              : "선택을 이동"}
          </button>
          <label className="fragment-search-field">
            <span>파편 검색</span>
            <input
              disabled={busy}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목 또는 원문"
              type="search"
              value={query}
            />
          </label>
          <label>
            <span>종류 보기</span>
            <select
              disabled={busy}
              onChange={(event) => setKindFilter(event.target.value)}
              value={kindFilter}
            >
              <option value="all">전체</option>
              {input.profile.kinds.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {input.error !== null && (
          <p className="fragment-shelf-error" role="alert">
            {input.error}
          </p>
        )}

        <div className="fragment-shelf-content">
          {visibleFragments.length === 0 ? (
            <p className="fragment-shelf-empty">
              {input.fragments.length === 0
                ? "이 작품에 보관한 파편이 없습니다."
                : "검색 조건에 맞는 파편이 없습니다."}
            </p>
          ) : (
            <ul className="fragment-card-list">
              {visibleFragments.map((fragment) => {
                const sourceResolved =
                  fragment.integrity === "resolved" &&
                  fragment.range !== null;
                const sourceLabel =
                  input.documentLabels[fragment.sourceDocumentId] ??
                  "원본 회차";
                return (
                  <li
                    className="fragment-card"
                    data-fragment-id={fragment.fragmentId}
                    key={fragment.fragmentId}
                  >
                    <div className="fragment-card-head">
                      <input
                        aria-label="파편 제목"
                        defaultValue={fragment.title}
                        disabled={busy}
                        onBlur={(event) => {
                          if (event.target.value !== fragment.title) {
                            input.onUpdate(fragment, {
                              title: event.target.value,
                            });
                          }
                        }}
                        placeholder="제목 없음"
                      />
                      <select
                        aria-label="파편 종류"
                        disabled={busy}
                        onChange={(event) =>
                          input.onUpdate(fragment, {
                            kindId: event.target.value,
                          })
                        }
                        value={fragment.kindId}
                      >
                        {input.profile.kinds.map((kind) => (
                          <option key={kind.id} value={kind.id}>
                            {kind.label}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-pressed={fragment.pinned}
                        disabled={busy}
                        onClick={() =>
                          input.onUpdate(fragment, {
                            pinned: !fragment.pinned,
                          })
                        }
                        type="button"
                      >
                        {fragment.pinned ? "고정 해제" : "상단 고정"}
                      </button>
                    </div>
                    <pre>{fragment.exactText}</pre>
                    <div className="fragment-source-row">
                      <span>
                        <strong>{sourceLabel}</strong>
                        <small>{`${sourceStatus(fragment)} · ${fragment.useCount}회 사용`}</small>
                      </span>
                      <button
                        disabled={busy || !input.canInsert}
                        onClick={() => input.onInsert(fragment)}
                        type="button"
                      >
                        {input.actionState === "inserting"
                          ? "삽입 중"
                          : "커서에 삽입"}
                      </button>
                      <button
                        disabled={busy || !sourceResolved}
                        onClick={() => input.onOpenSource(fragment)}
                        type="button"
                      >
                        원문 열기
                      </button>
                      <button
                        className="fragment-retire-button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            globalThis.confirm(
                              "이 파편을 서랍에서 치울까요? 원고는 바뀌지 않습니다.",
                            )
                          ) {
                            input.onRetire(fragment);
                          }
                        }}
                        type="button"
                      >
                        서랍에서 치우기
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
