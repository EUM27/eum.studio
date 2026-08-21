export function ManuscriptReviewPanel(input: {
  readonly disabled: boolean;
  readonly error: string | null;
  readonly onOpenAnalysis: () => void;
  readonly onOpenContinuousReading: () => void;
  readonly onOpenPreflight: () => void;
}) {
  return (
    <section aria-label="원고 점검" className="review-panel manuscript-review-panel">
      <header>
        <p className="panel-kicker">MANUSCRIPT REVIEW</p>
        <h3>원고 점검</h3>
        <p>현재 원고의 분석·사전 점검·연속 읽기를 다시 여는 정식 위치입니다.</p>
      </header>
      <div className="manuscript-review-actions">
        <button disabled={input.disabled} onClick={input.onOpenAnalysis} type="button">
          <strong>원고 분석</strong>
          <span>문장 길이·반복 단어·상위 어휘·밀도 히트맵</span>
        </button>
        <button disabled={input.disabled} onClick={input.onOpenPreflight} type="button">
          <strong>사전 점검</strong>
          <span>입력 규칙·표기 검사·치환 미리보기·TXT 내보내기</span>
        </button>
        <button disabled={input.disabled} onClick={input.onOpenContinuousReading} type="button">
          <strong>연속 읽기</strong>
          <span>작품의 실제 회차 순서로 원고를 이어 읽습니다.</span>
        </button>
      </div>
      {input.error !== null && <p className="event-action-error" role="alert">{input.error}</p>}
    </section>
  );
}
