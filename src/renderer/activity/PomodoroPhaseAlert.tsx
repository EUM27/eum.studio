import { X } from "lucide-react";

import type {
  PomodoroPhase,
  PomodoroProjection,
} from "../../application/activity/pomodoro-contract";

export type PomodoroPhaseAlertProjection = {
  readonly alertId: string;
  readonly workId: PomodoroProjection["workId"];
  readonly phase: PomodoroPhase;
  readonly title: string;
  readonly message: string;
};

export function derivePomodoroPhaseAlert(
  previous: PomodoroProjection,
  next: PomodoroProjection,
): PomodoroPhaseAlertProjection | null {
  const previousPhase = previous.activePhase;
  const nextPhase = next.activePhase;
  if (
    previous.workId !== next.workId ||
    previousPhase === null ||
    nextPhase === null ||
    previousPhase.focusCycleId === nextPhase.focusCycleId ||
    previousPhase.phase === nextPhase.phase ||
    next.settings === null
  ) {
    return null;
  }

  const completed = `작업 ${next.completedWorkCycles}/${next.settings.workCycleCount}회 완료`;
  return Object.freeze({
    alertId: `${next.workId}:${nextPhase.focusCycleId}`,
    workId: next.workId,
    phase: nextPhase.phase,
    title:
      nextPhase.phase === "break"
        ? "휴식 시간입니다"
        : "작업을 재개할 시간입니다",
    message:
      nextPhase.phase === "break"
        ? `${completed} · ${nextPhase.cycleNumber}번째 휴식을 시작하세요.`
        : `${completed} · ${nextPhase.cycleNumber}번째 작업을 시작하세요.`,
  });
}

let alertAudioContext: AudioContext | null = null;

function getAlertAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  try {
    alertAudioContext ??= new AudioContext();
    return alertAudioContext;
  } catch {
    return null;
  }
}

export function preparePomodoroPhaseAlertSound(): void {
  const context = getAlertAudioContext();
  if (context?.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
}

export function playPomodoroPhaseAlertSound(): void {
  const context = getAlertAudioContext();
  if (context === null) return;

  const play = () => {
    const startedAt = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, startedAt);
    oscillator.frequency.exponentialRampToValueAtTime(988, startedAt + 0.22);
    gain.gain.setValueAtTime(0.0001, startedAt);
    gain.gain.exponentialRampToValueAtTime(0.16, startedAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.36);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(startedAt);
    oscillator.stop(startedAt + 0.37);
  };

  if (context.state === "suspended") {
    void context.resume().then(play, () => undefined);
    return;
  }
  play();
}

export function PomodoroPhaseAlert(input: {
  readonly alert: PomodoroPhaseAlertProjection;
  readonly onDismiss: () => void;
}) {
  return (
    <section
      aria-label="집중 단계 알림"
      aria-live="assertive"
      className="pomodoro-phase-alert"
      data-pomodoro-phase={input.alert.phase}
      data-testid="pomodoro-phase-alert"
      role="status"
    >
      <div>
        <strong>{input.alert.title}</strong>
        <span>{input.alert.message}</span>
      </div>
      <button
        aria-label="집중 단계 알림 닫기"
        onClick={input.onDismiss}
        type="button"
      >
        <X aria-hidden="true" size={15} />
      </button>
    </section>
  );
}
