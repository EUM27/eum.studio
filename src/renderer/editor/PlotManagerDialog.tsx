import { useState } from "react";

import type {
  CreatePlotThreadCommand,
  PlotThreadProjection,
  UpdatePlotThreadCommand,
} from "../../application/plots/plot-contract";
import type {
  PlotThreadSourceProjection,
} from "../../application/plots/plot-source-contract";

export type PlotManagerActionState =
  | "idle"
  | "creating"
  | "updating"
  | "retiring"
  | "linking-source";

export type PlotDraft = Pick<
  CreatePlotThreadCommand,
  "title" | "stage" | "summary" | "note"
>;

function PlotFields(input: {
  readonly actionState: PlotManagerActionState;
  readonly onCreate: (draft: PlotDraft) => void;
  readonly onRetire: (plot: PlotThreadProjection) => void;
  readonly onUpdate: (
    plot: PlotThreadProjection,
    changes: UpdatePlotThreadCommand["changes"],
  ) => void;
  readonly plot: PlotThreadProjection | null;
}) {
  const [title, setTitle] = useState(input.plot?.title ?? "");
  const [stage, setStage] = useState(input.plot?.stage ?? "");
  const [summary, setSummary] = useState(input.plot?.summary ?? "");
  const [note, setNote] = useState(input.plot?.note ?? "");
  const plot = input.plot;
  const busy = input.actionState !== "idle";
  const creating = plot === null;

  return (
    <form
      className="character-manager-fields plot-manager-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (plot === null) {
          input.onCreate({ title, stage, summary, note });
          return;
        }
        input.onUpdate(plot, { title, stage, summary, note });
      }}
    >
      <label>
        <span>플롯 제목</span>
        <input
          aria-label="플롯 제목"
          autoFocus
          disabled={busy}
          name="title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="플롯 제목을 입력하세요"
          value={title}
        />
      </label>
      <label>
        <span>단계</span>
        <input
          aria-label="플롯 단계"
          disabled={busy}
          name="stage"
          onChange={(event) => setStage(event.target.value)}
          placeholder="현재 단계를 자유롭게 적습니다"
          value={stage}
        />
      </label>
      <label>
        <span>플롯 요약</span>
        <textarea
          aria-label="플롯 요약"
          disabled={busy}
          name="summary"
          onChange={(event) => setSummary(event.target.value)}
          placeholder="갈등, 진행 상황, 회수 방향처럼 집필에 필요한 내용을 적습니다."
          rows={5}
          value={summary}
        />
      </label>
      <label>
        <span>작가 메모</span>
        <textarea
          aria-label="플롯 작가 메모"
          disabled={busy}
          name="note"
          onChange={(event) => setNote(event.target.value)}
          placeholder="확인할 점이나 작업 메모를 적습니다."
          rows={3}
          value={note}
        />
      </label>
      <div className="character-manager-field-actions plot-manager-field-actions">
        {plot !== null && (
          <button
            className="danger-action"
            disabled={busy}
            onClick={() => input.onRetire(plot)}
            type="button"
          >
            {input.actionState === "retiring" ? "치우는 중" : "플롯 치우기"}
          </button>
        )}
        <button
          className="primary-action"
          disabled={busy || title.trim().length === 0}
          type="submit"
        >
          {creating
            ? input.actionState === "creating" ? "만드는 중" : "플롯 만들기"
            : input.actionState === "updating" ? "저장 중" : "변경 저장"}
        </button>
      </div>
    </form>
  );
}

export function PlotManagerDialog(input: {
  readonly actionState: PlotManagerActionState;
  readonly canLinkSource: boolean;
  readonly documentLabels: Readonly<Record<string, string>>;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onCreate: (draft: PlotDraft) => void;
  readonly onRetire: (plot: PlotThreadProjection) => void;
  readonly onLinkSource: (plot: PlotThreadProjection) => void;
  readonly onOpenSource: (source: PlotThreadSourceProjection) => void;
  readonly onSelect: (plotThreadId: string | null) => void;
  readonly onUpdate: (
    plot: PlotThreadProjection,
    changes: UpdatePlotThreadCommand["changes"],
  ) => void;
  readonly plots: readonly PlotThreadProjection[];
  readonly sources: readonly PlotThreadSourceProjection[];
  readonly selectedPlotThreadId: string | null;
}) {
  const [query, setQuery] = useState("");
  const busy = input.actionState !== "idle";
  const selectedPlot = input.plots.find(
    (plot) => plot.plotThreadId === input.selectedPlotThreadId,
  ) ?? null;
  const selectedSource = selectedPlot === null
    ? null
    : input.sources.find(
        (source) => source.plotThreadId === selectedPlot.plotThreadId,
      ) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePlots = normalizedQuery.length === 0
    ? input.plots
    : input.plots.filter((plot) =>
        `${plot.title}\n${plot.stage}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      );

  return (
    <div
      className="dialog-backdrop character-manager-backdrop plot-manager-backdrop"
      role="presentation"
    >
      <section
        aria-labelledby="plot-manager-heading"
        aria-modal="true"
        className="character-manager-dialog plot-manager-dialog"
        role="dialog"
      >
        <header className="character-manager-header plot-manager-header">
          <div>
            <p className="panel-kicker">PLOTS</p>
            <h2 id="plot-manager-heading">플롯 관리</h2>
            <p>현재 작품의 플롯 진행과 작가 메모를 관리합니다.</p>
          </div>
          <button
            aria-label="플롯 관리 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="character-manager-body plot-manager-body">
          <section
            aria-label="플롯 목록"
            className="character-manager-list plot-manager-list"
          >
            <div className="character-manager-list-tools plot-manager-list-tools">
              <input
                aria-label="플롯 검색"
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="제목·단계 검색"
                value={query}
              />
              <button
                disabled={busy}
                onClick={() => input.onSelect(null)}
                type="button"
              >
                새 플롯
              </button>
            </div>
            {input.plots.length === 0 && (
              <p className="character-manager-empty plot-manager-empty">
                이 작품에 등록한 플롯이 없습니다.
              </p>
            )}
            {input.plots.length > 0 && visiblePlots.length === 0 && (
              <p className="character-manager-empty plot-manager-empty">
                검색 결과가 없습니다.
              </p>
            )}
            <ul>
              {visiblePlots.map((plot) => (
                <li key={plot.plotThreadId}>
                  <button
                    aria-pressed={plot.plotThreadId === selectedPlot?.plotThreadId}
                    disabled={busy}
                    onClick={() => input.onSelect(plot.plotThreadId)}
                    type="button"
                  >
                    <strong>{plot.title}</strong>
                    <span>{plot.stage || "단계 미입력"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-label="플롯 상세 편집"
            className="character-manager-detail plot-manager-detail"
          >
            <PlotFields
              actionState={input.actionState}
              key={selectedPlot?.plotThreadId ?? "new-plot"}
              onCreate={input.onCreate}
              onRetire={input.onRetire}
              onUpdate={input.onUpdate}
              plot={selectedPlot}
            />
            {selectedPlot !== null && (
              <section
                aria-label="플롯 원문 출처"
                className="plot-source-panel"
              >
                <header>
                  <div>
                    <span>원문 출처</span>
                    <strong>
                      {selectedSource === null
                        ? "연결 안 됨"
                        : input.documentLabels[selectedSource.sourceDocumentId] ??
                          "원본 회차"}
                    </strong>
                  </div>
                  <button
                    disabled={busy || !input.canLinkSource}
                    onClick={() => input.onLinkSource(selectedPlot)}
                    type="button"
                  >
                    {input.actionState === "linking-source"
                      ? "연결 중"
                      : selectedSource === null
                        ? "현재 선택 연결"
                        : "현재 선택으로 교체"}
                  </button>
                </header>
                {selectedSource === null ? (
                  <p>원고에서 정확한 범위를 선택해 이 플롯의 출처로 연결합니다.</p>
                ) : (
                  <>
                    <blockquote>{selectedSource.exactText}</blockquote>
                    <div className="plot-source-actions">
                      <span>
                        {selectedSource.integrity === "resolved"
                          ? "정확한 위치 확인됨"
                          : "원문 위치 검토 필요"}
                      </span>
                      <button
                        disabled={
                          busy ||
                          selectedSource.integrity !== "resolved" ||
                          selectedSource.range === null
                        }
                        onClick={() => input.onOpenSource(selectedSource)}
                        type="button"
                      >
                        원문 열기
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </section>
        </div>

        {input.error !== null && (
          <p className="character-manager-error plot-manager-error" role="alert">
            {input.error}
          </p>
        )}
      </section>
    </div>
  );
}
