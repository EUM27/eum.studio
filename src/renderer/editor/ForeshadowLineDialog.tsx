import { useState } from "react";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

import type {
  ForeshadowLineProjection,
  UpdateForeshadowLineCommand,
} from "../../application/foreshadowing/foreshadow-line-contract";
import {
  deriveForeshadowLineResolution,
  type ForeshadowPointProfile,
  type ForeshadowPointProjection,
} from "../../application/foreshadowing/foreshadow-point-contract";
import type {
  LoreEntryProjection,
} from "../../application/lore/lore-entry-contract";
import type {
  LoreForeshadowLinkProjection,
} from "../../application/lore/lore-foreshadow-link-contract";

export type ForeshadowLineActionState =
  | "idle"
  | "creating"
  | "capturing"
  | "updating"
  | "retiring"
  | "linking-lore"
  | "unlinking-lore";

type ForeshadowLineChanges = UpdateForeshadowLineCommand["changes"];

function pointSourceStatus(point: ForeshadowPointProjection): string {
  if (point.integrity === "resolved") {
    return point.range === null
      ? "원문 위치 연결 손상"
      : `${point.range.from}–${point.range.to}`;
  }
  return point.integrity === "needsReview"
    ? "원문 위치 검토 필요"
    : "원문 위치 연결 손상";
}

function ForeshadowLoreLinks(input: {
  readonly actionState: ForeshadowLineActionState;
  readonly line: ForeshadowLineProjection;
  readonly links: readonly LoreForeshadowLinkProjection[];
  readonly loreEntries: readonly LoreEntryProjection[];
  readonly onLink: (
    line: ForeshadowLineProjection,
    loreEntryId: LoreEntryProjection["loreEntryId"],
  ) => void;
  readonly onUnlink: (link: LoreForeshadowLinkProjection) => void;
}) {
  const [loreEntryId, setLoreEntryId] = useState("");
  const busy = input.actionState !== "idle";
  const activeLinks = input.links.filter(
    (link) => link.lineId === input.line.lineId && link.unlinkedAt === null,
  );
  const activeLoreIds = new Set(activeLinks.map((link) => link.loreEntryId));
  const availableLoreEntries = input.loreEntries.filter(
    (entry) => !activeLoreIds.has(entry.loreEntryId),
  );
  const selectedLoreEntryId = availableLoreEntries.some(
    (entry) => entry.loreEntryId === loreEntryId,
  )
    ? loreEntryId
    : (availableLoreEntries[0]?.loreEntryId ?? "");

  return (
    <section
      aria-label={`${input.line.title} 연결된 별빛`}
      className="foreshadow-lore-links"
    >
      <header>
        <div>
          <span>연결된 별빛</span>
          <strong>{activeLinks.length}</strong>
        </div>
        <div>
          <select
            aria-label={`${input.line.title} 연결할 별빛`}
            disabled={busy || availableLoreEntries.length === 0}
            onChange={(event) => setLoreEntryId(event.target.value)}
            value={selectedLoreEntryId}
          >
            {availableLoreEntries.map((entry) => (
              <option key={entry.loreEntryId} value={entry.loreEntryId}>
                {entry.title}
              </option>
            ))}
          </select>
          <button
            disabled={busy || selectedLoreEntryId.length === 0}
            onClick={() => input.onLink(
              input.line,
              selectedLoreEntryId as LoreEntryProjection["loreEntryId"],
            )}
            type="button"
          >
            {input.actionState === "linking-lore" ? "연결 중" : "별빛 연결"}
          </button>
        </div>
      </header>
      {input.loreEntries.length === 0 ? (
        <p>먼저 이 작품에 별빛을 만드세요.</p>
      ) : activeLinks.length === 0 ? (
        <p>아직 연결한 별빛이 없습니다.</p>
      ) : (
        <ul>
          {activeLinks.map((link) => {
            const loreEntry = input.loreEntries.find(
              (entry) => entry.loreEntryId === link.loreEntryId,
            );
            return (
              <li key={link.linkId}>
                <strong>{loreEntry?.title ?? "연결된 별빛"}</strong>
                <button
                  disabled={busy}
                  onClick={() => input.onUnlink(link)}
                  type="button"
                >
                  연결 해제
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type ForeshadowLineDialogProps = {
  readonly actionState: ForeshadowLineActionState;
  readonly canCapture: boolean;
  readonly documentLabels: Readonly<Record<string, string>>;
  readonly embedded?: boolean;
  readonly error: string | null;
  readonly lines: readonly ForeshadowLineProjection[];
  readonly loreEntries: readonly LoreEntryProjection[];
  readonly loreForeshadowLinks: readonly LoreForeshadowLinkProjection[];
  readonly onCapture: (lineId: string, roleId: string, note: string) => void;
  readonly onClose: () => void;
  readonly onCreate: (title: string, note: string) => void;
  readonly onOpenPoint: (point: ForeshadowPointProjection) => void;
  readonly onLinkLore: (
    line: ForeshadowLineProjection,
    loreEntryId: LoreEntryProjection["loreEntryId"],
  ) => void;
  readonly onRetire: (line: ForeshadowLineProjection) => void;
  readonly onUpdate: (
    line: ForeshadowLineProjection,
    changes: ForeshadowLineChanges,
  ) => void;
  readonly onUnlinkLore: (link: LoreForeshadowLinkProjection) => void;
  readonly points: readonly ForeshadowPointProjection[];
  readonly profile: ForeshadowPointProfile;
  readonly selectedLineId: string | null;
};

export type ForeshadowLineContentProps = Omit<
  ForeshadowLineDialogProps,
  "embedded" | "onClose"
>;

export function ForeshadowLineDialog(input: ForeshadowLineDialogProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const initialLineId = input.selectedLineId !== null && input.lines.some(
    (line) => line.lineId === input.selectedLineId,
  )
    ? input.selectedLineId
    : (input.lines[0]?.lineId ?? "");
  const [captureLineId, setCaptureLineId] = useState(initialLineId);
  const [captureRoleId, setCaptureRoleId] = useState(
    input.profile.defaultRoleId,
  );
  const [captureNote, setCaptureNote] = useState("");
  const busy = input.actionState !== "idle";
  const onBackdropPointerDown = useDialogDismiss({
    active: !input.embedded,
    disabled: busy,
    onClose: input.onClose,
  });
  const selectedLineId = input.lines.some(
    (line) => line.lineId === captureLineId,
  )
    ? captureLineId
    : (input.lines[0]?.lineId ?? "");

  const content = (
      <section
        aria-labelledby="foreshadow-line-heading"
        aria-modal={input.embedded ? undefined : "true"}
        className={
          input.embedded
            ? "foreshadow-line-dialog foreshadow-line-content"
            : "foreshadow-line-dialog"
        }
        role={input.embedded ? "region" : "dialog"}
      >
        <header className="foreshadow-line-header">
          <div>
            <p className="panel-kicker">FORESHADOW LINES</p>
            <h2 id="foreshadow-line-heading">복선 라인</h2>
            <p>이 작품에서 이어 갈 복선과 정확한 원고 지점을 관리합니다.</p>
          </div>
          {!input.embedded && (
            <button
              aria-label="복선 라인 닫기"
              className="dialog-close"
              disabled={busy}
              onClick={input.onClose}
              type="button"
            >
              ×
            </button>
          )}
        </header>

        <div className="foreshadow-line-create">
          <label>
            <span>새 복선 이름</span>
            <input
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="복선 이름"
              value={title}
            />
          </label>
          <label>
            <span>작가 메모</span>
            <textarea
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder="이 복선을 어떻게 이어 갈지 적습니다."
              value={note}
            />
          </label>
          <button
            disabled={busy || title.trim().length === 0}
            onClick={() => input.onCreate(title, note)}
            type="button"
          >
            {input.actionState === "creating" ? "만드는 중" : "라인 만들기"}
          </button>
        </div>

        <div className="foreshadow-point-create">
          <label>
            <span>연결할 복선 라인</span>
            <select
              disabled={busy || input.lines.length === 0}
              onChange={(event) => setCaptureLineId(event.target.value)}
              value={selectedLineId}
            >
              {input.lines.map((line) => (
                <option key={line.lineId} value={line.lineId}>
                  {line.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>지점 역할</span>
            <select
              disabled={busy}
              onChange={(event) => setCaptureRoleId(event.target.value)}
              value={captureRoleId}
            >
              {input.profile.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label className="foreshadow-point-note-field">
            <span>지점 메모</span>
            <input
              disabled={busy}
              onChange={(event) => setCaptureNote(event.target.value)}
              placeholder="이 지점의 역할을 적습니다."
              value={captureNote}
            />
          </label>
          <button
            disabled={busy || !input.canCapture || selectedLineId.length === 0}
            onClick={() => input.onCapture(
              selectedLineId,
              captureRoleId,
              captureNote,
            )}
            type="button"
          >
            {input.actionState === "capturing"
              ? "연결 중"
              : "선택 지점 연결"}
          </button>
        </div>

        {input.error !== null && (
          <p className="foreshadow-line-error" role="alert">{input.error}</p>
        )}

        <div className="foreshadow-line-list-region">
          {input.lines.length === 0 ? (
            <p className="foreshadow-line-empty">
              이 작품에 만든 복선 라인이 없습니다.
            </p>
          ) : (
            <ul className="foreshadow-line-list">
              {input.lines.map((line) => {
                const linePoints = input.points.filter(
                  (point) => point.lineId === line.lineId,
                );
                const resolution = deriveForeshadowLineResolution({
                  points: linePoints,
                  payoffRoleId: input.profile.payoffRoleId,
                });
                return (
                  <li
                    aria-current={line.lineId === selectedLineId ? "true" : undefined}
                    className="foreshadow-line-card"
                    key={line.lineId}
                  >
                    <div className="foreshadow-line-card-fields">
                      <label>
                        <span>복선 이름</span>
                        <input
                          aria-label="복선 이름"
                          defaultValue={line.title}
                          disabled={busy}
                          onBlur={(event) => {
                            if (event.target.value !== line.title) {
                              input.onUpdate(line, { title: event.target.value });
                            }
                          }}
                        />
                      </label>
                      <label>
                        <span>작가 메모</span>
                        <textarea
                          aria-label="복선 작가 메모"
                          defaultValue={line.note}
                          disabled={busy}
                          onBlur={(event) => {
                            if (event.target.value !== line.note) {
                              input.onUpdate(line, { note: event.target.value });
                            }
                          }}
                          placeholder="작가 메모 없음"
                        />
                      </label>
                      <span className="foreshadow-line-resolution">
                        {resolution === "resolved" ? "회수 완료" : "미회수"}
                      </span>
                      <button
                        className="foreshadow-line-retire"
                        disabled={busy}
                        onClick={() => {
                          if (
                            globalThis.confirm(
                              "이 복선 라인을 목록에서 치울까요? 연결 데이터는 삭제하지 않습니다.",
                            )
                          ) {
                            input.onRetire(line);
                          }
                        }}
                        type="button"
                      >
                        라인 치우기
                      </button>
                    </div>
                    <ForeshadowLoreLinks
                      actionState={input.actionState}
                      line={line}
                      links={input.loreForeshadowLinks}
                      loreEntries={input.loreEntries}
                      onLink={input.onLinkLore}
                      onUnlink={input.onUnlinkLore}
                    />
                    {linePoints.length === 0 ? (
                      <p className="foreshadow-point-empty">
                        아직 연결한 원고 지점이 없습니다.
                      </p>
                    ) : (
                      <ol className="foreshadow-point-list">
                        {linePoints.map((point) => {
                          const roleLabel = input.profile.roles.find(
                            (role) => role.id === point.roleId,
                          )?.label ?? point.roleId;
                          const sourceResolved =
                            point.integrity === "resolved" &&
                            point.range !== null;
                          return (
                            <li key={point.pointId}>
                              <div>
                                <span>{roleLabel}</span>
                                <strong>
                                  {input.documentLabels[point.sourceDocumentId] ??
                                    "원본 회차"}
                                </strong>
                                <small>{pointSourceStatus(point)}</small>
                              </div>
                              <pre>{point.exactText}</pre>
                              {point.note.length > 0 && <p>{point.note}</p>}
                              <button
                                disabled={busy || !sourceResolved}
                                onClick={() => input.onOpenPoint(point)}
                                type="button"
                              >
                                원문 열기
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
  );
  return input.embedded ? content : (
    <div
      className="dialog-backdrop foreshadow-line-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      {content}
    </div>
  );
}

export function ForeshadowLineContent(input: ForeshadowLineContentProps) {
  return <ForeshadowLineDialog {...input} embedded onClose={() => undefined} />;
}
