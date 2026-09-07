import { BarChart3, Repeat2, Ruler, Tags } from "lucide-react";
import { useMemo } from "react";

import { analyzeManuscriptText } from "./manuscript-analysis";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

export function ManuscriptAnalysisDialog(input: {
  readonly documentTitle: string;
  readonly manuscript: string;
  readonly onClose: () => void;
}) {
  const analysis = useMemo(
    () => analyzeManuscriptText(input.manuscript),
    [input.manuscript],
  );
  const onBackdropPointerDown = useDialogDismiss({ onClose: input.onClose });

  return (
    <div
      className="dialog-backdrop manuscript-analysis-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="manuscript-analysis-heading"
        aria-modal="true"
        className="manuscript-analysis-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">MANUSCRIPT ANALYSIS</p>
            <h2 id="manuscript-analysis-heading">원고 분석</h2>
            <p>{input.documentTitle}</p>
          </div>
          <button
            aria-label="원고 분석 닫기"
            className="dialog-close"
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="manuscript-analysis-body">
          <section className="manuscript-analysis-summary">
            <Tags aria-hidden="true" size={18} />
            <div>
              <span>분석 요약</span>
              <strong>{analysis.summary}</strong>
            </div>
          </section>

          <section className="manuscript-analysis-card">
            <header>
              <BarChart3 aria-hidden="true" size={17} />
              <h3>많이 사용한 단어</h3>
            </header>
            {analysis.topWords.length === 0 ? (
              <p>아직 분석할 원고가 없습니다.</p>
            ) : (
              <ol>
                {analysis.topWords.map((entry) => (
                  <li key={entry.word}>
                    <span>{entry.word}</span>
                    <strong>{entry.count}회</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="manuscript-analysis-card">
            <header>
              <Ruler aria-hidden="true" size={17} />
              <h3>문장 길이</h3>
            </header>
            <dl className="manuscript-analysis-metrics">
              <div><dt>문장 수</dt><dd>{analysis.sentences.count}개</dd></div>
              <div><dt>평균</dt><dd>{analysis.sentences.averageLength}자</dd></div>
              <div><dt>최소</dt><dd>{analysis.sentences.minimumLength}자</dd></div>
              <div><dt>최대</dt><dd>{analysis.sentences.maximumLength}자</dd></div>
            </dl>
          </section>

          <section className="manuscript-analysis-card manuscript-analysis-density">
            <header>
              <Repeat2 aria-hidden="true" size={17} />
              <h3>반복 어휘 밀도</h3>
            </header>
            <strong>{analysis.repetitionDensityPercent}%</strong>
            <p>상위 10개 어휘가 전체 어휘에서 차지하는 비율</p>
          </section>
        </div>
      </section>
    </div>
  );
}
