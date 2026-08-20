import { useState } from "react";

export function ForwardWritingGoalDialog(input: {
  readonly onCancel: () => void;
  readonly onStart: (goalCharacters: number) => void;
}) {
  const [goal, setGoal] = useState("");
  const parsedGoal = Number(goal);
  const canStart =
    goal.length > 0 && Number.isSafeInteger(parsedGoal) && parsedGoal > 0;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="forward-writing-goal-heading"
        aria-modal="true"
        className="create-work-dialog forward-writing-goal-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">FORWARD WRITING</p>
            <h2 id="forward-writing-goal-heading">수정금지 집필 설정</h2>
          </div>
          <button
            aria-label="수정금지 집필 설정 닫기"
            className="dialog-close"
            onClick={input.onCancel}
            type="button"
          >
            ×
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canStart) input.onStart(parsedGoal);
          }}
        >
          <p className="dialog-description">
            일반 원고 편집기에서 기존 본문은 잠그고 그 뒤부터 계속 씁니다.
          </p>
          <label>
            <span>목표 글자 수</span>
            <input
              aria-label="목표 글자 수"
              autoFocus
              min="1"
              onChange={(event) => setGoal(event.target.value)}
              step="1"
              type="number"
              value={goal}
            />
          </label>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={input.onCancel}
              type="button"
            >
              취소
            </button>
            <button className="primary-button" disabled={!canStart} type="submit">
              시작
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
