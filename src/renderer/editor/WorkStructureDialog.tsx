import type {
  WorkStructureOverviewCharacter,
  WorkStructureOverviewDocument,
  WorkStructureOverviewEvent,
  WorkStructureOverviewPlot,
  WorkStructureOverviewPlotSource,
  WorkStructureOverviewProjection,
  WorkStructureOverviewSceneBoundary,
} from "../../application/structure/work-structure-overview";

const sceneOperationLabels: Record<
  WorkStructureOverviewSceneBoundary["operation"],
  string
> = {
  add: "추가",
  ignore: "제외",
  merge: "합치기",
  split: "나누기",
};

function integrityLabel(
  integrity: "resolved" | "needsReview" | "broken",
): string {
  if (integrity === "resolved") return "위치 확인됨";
  if (integrity === "needsReview") return "위치 검토 필요";
  return "위치 연결 손상";
}

export function WorkStructureDialog(input: {
  readonly busy: boolean;
  readonly error: string | null;
  readonly loreEntryCount: number;
  readonly onClose: () => void;
  readonly onOpenCharacter: (character: WorkStructureOverviewCharacter) => void;
  readonly onOpenDocument: (document: WorkStructureOverviewDocument) => void;
  readonly onOpenEvent: (event: WorkStructureOverviewEvent) => void;
  readonly onOpenLore: () => void;
  readonly onOpenPlot: (plot: WorkStructureOverviewPlot) => void;
  readonly onOpenPlotSource: (source: WorkStructureOverviewPlotSource) => void;
  readonly onOpenSceneBoundary: (
    boundary: WorkStructureOverviewSceneBoundary,
  ) => void;
  readonly projection: WorkStructureOverviewProjection;
}) {
  const labels = new Map(
    input.projection.documents.map((document) => [
      document.documentId,
      document.label,
    ] as const),
  );
  const totals = input.projection.totals;

  return (
    <div className="dialog-backdrop work-structure-backdrop" role="presentation">
      <section
        aria-labelledby="work-structure-heading"
        aria-modal="true"
        className="work-structure-dialog"
        role="dialog"
      >
        <header className="work-structure-header">
          <div>
            <p className="panel-kicker">WORK STRUCTURE</p>
            <h2 id="work-structure-heading">작품 구조</h2>
            <p>{input.projection.workTitle}</p>
          </div>
          <button
            aria-label="작품 구조 닫기"
            className="dialog-close"
            disabled={input.busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <section aria-label="작품 구조 요약" className="work-structure-metrics">
          {([
            ["회차", totals.documents, "documents"],
            ["인물", totals.characters, "characters"],
            ["플롯", totals.plots, "plots"],
            ["플롯 출처", totals.plotSources, "plot-sources"],
            ["사건", totals.events, "events"],
            ["장면 경계", totals.sceneBoundaries, "scene-boundaries"],
            ["별빛", input.loreEntryCount, "lore-entries"],
          ] as const).map(([label, value, testId]) => (
            <div data-testid={`structure-total-${testId}`} key={testId}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <div className="work-structure-body">
          <section aria-label="회차 구조" className="work-structure-panel">
            <header>
              <h3>회차</h3>
              <span>{totals.documents}</span>
            </header>
            {input.projection.documents.length === 0 ? (
              <p className="work-structure-empty">이 작품에 회차가 없습니다.</p>
            ) : (
              <ul>
                {input.projection.documents.map((document) => (
                  <li key={document.documentId}>
                    <button
                      disabled={input.busy}
                      onClick={() => input.onOpenDocument(document)}
                      type="button"
                    >
                      <strong>{document.label}</strong>
                      <span>
                        사건 {document.eventCount} · 장면 {document.sceneBoundaryCount} ·
                        플롯 출처 {document.plotSourceCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="인물 구조" className="work-structure-panel">
            <header>
              <h3>인물</h3>
              <span>{totals.characters}</span>
            </header>
            {input.projection.characters.length === 0 ? (
              <p className="work-structure-empty">등록한 인물이 없습니다.</p>
            ) : (
              <ul>
                {input.projection.characters.map((character) => (
                  <li key={character.characterId}>
                    <button
                      aria-label={`${character.name} 인물 열기`}
                      disabled={input.busy}
                      onClick={() => input.onOpenCharacter(character)}
                      type="button"
                    >
                      <strong>{character.name}</strong>
                      <span>{character.role || "역할 미입력"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="별빛 구조" className="work-structure-panel">
            <header>
              <h3>별빛</h3>
              <span>{input.loreEntryCount}</span>
            </header>
            <p className="work-structure-empty">
              작품에서 확정한 설정·분류·별칭과 원고 근거를 관리합니다.
            </p>
            <div className="work-structure-row-actions">
              <button
                aria-label="별빛 관리 열기"
                disabled={input.busy}
                onClick={input.onOpenLore}
                type="button"
              >
                별빛 관리 열기
              </button>
            </div>
          </section>

          <section aria-label="플롯 구조" className="work-structure-panel work-structure-wide-panel">
            <header>
              <h3>플롯과 출처</h3>
              <span>{totals.plots}</span>
            </header>
            {input.projection.plots.length === 0 ? (
              <p className="work-structure-empty">등록한 플롯이 없습니다.</p>
            ) : (
              <ul>
                {input.projection.plots.map((plot) => {
                  const source = plot.source;
                  return (
                  <li className="work-structure-plot" key={plot.plotThreadId}>
                    <div>
                      <strong>{plot.title}</strong>
                      <span>{plot.stage || "단계 미입력"}</span>
                    </div>
                    {source === null ? (
                      <p>연결된 원문 출처가 없습니다.</p>
                    ) : (
                      <blockquote>
                        <span>
                          {labels.get(source.sourceDocumentId) ?? "원본 회차"}
                          {` · ${integrityLabel(source.integrity)}`}
                        </span>
                        {source.exactText}
                      </blockquote>
                    )}
                    <div className="work-structure-row-actions">
                      <button
                        aria-label={`${plot.title} 플롯 열기`}
                        disabled={input.busy}
                        onClick={() => input.onOpenPlot(plot)}
                        type="button"
                      >
                        플롯 열기
                      </button>
                      {source !== null && (
                        <button
                          aria-label={`${plot.title} 원문 열기`}
                          disabled={
                            input.busy ||
                            source.integrity !== "resolved" ||
                            source.range === null
                          }
                          onClick={() => input.onOpenPlotSource(source)}
                          type="button"
                        >
                          원문 열기
                        </button>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label="사건 구조" className="work-structure-panel">
            <header>
              <h3>사건</h3>
              <span>{totals.events}</span>
            </header>
            {input.projection.events.length === 0 ? (
              <p className="work-structure-empty">등록한 사건이 없습니다.</p>
            ) : (
              <ul>
                {input.projection.events.map((event) => (
                  <li key={event.eventBlockId}>
                    <button
                      aria-label={`${event.title} 사건 원문 열기`}
                      disabled={
                        input.busy ||
                        event.integrity !== "resolved" ||
                        event.range === null
                      }
                      onClick={() => input.onOpenEvent(event)}
                      type="button"
                    >
                      <strong>{event.title}</strong>
                      <span>
                        {labels.get(event.documentId) ?? "원본 회차"}
                        {` · ${integrityLabel(event.integrity)}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="장면 경계 구조" className="work-structure-panel">
            <header>
              <h3>장면 경계</h3>
              <span>{totals.sceneBoundaries}</span>
            </header>
            {input.projection.sceneBoundaries.length === 0 ? (
              <p className="work-structure-empty">추가한 장면 경계가 없습니다.</p>
            ) : (
              <ul>
                {input.projection.sceneBoundaries.map((boundary, index) => {
                  const label = labels.get(boundary.documentId) ?? "원본 회차";
                  return (
                    <li key={`${boundary.sceneOverrideId}:${boundary.anchorId}`}>
                      <button
                        aria-label={`${label} 장면 경계 ${index + 1} 원문 열기`}
                        disabled={
                          input.busy ||
                          boundary.integrity !== "resolved" ||
                          boundary.range === null
                        }
                        onClick={() => input.onOpenSceneBoundary(boundary)}
                        type="button"
                      >
                        <strong>{`${label} · ${sceneOperationLabels[boundary.operation]}`}</strong>
                        <span>{integrityLabel(boundary.integrity)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {input.error !== null && (
          <p className="work-structure-error" role="alert">{input.error}</p>
        )}
      </section>
    </div>
  );
}
