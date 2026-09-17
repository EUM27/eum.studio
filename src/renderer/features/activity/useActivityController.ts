import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  WorkActivityProjection,
  WritingSessionProjection,
} from "../../../application/activity/work-activity-contract";
import type { PomodoroProjection } from "../../../application/activity/pomodoro-contract";
import type {
  WorkRecordsGoals,
  WorkRecordsGoalsProjection,
} from "../../../application/activity/work-records-preferences";
import type {
  WorkReadthroughEntry,
  WorkReadthroughProjection,
} from "../../../application/activity/work-readthrough-calculator";
import type { EntityId } from "../../../domain/writing";
import type { PomodoroDialogSubmitValue } from "../../activity/PomodoroDialog";
import {
  derivePomodoroPhaseAlert,
  playPomodoroPhaseAlertSound,
  preparePomodoroPhaseAlertSound,
  type PomodoroPhaseAlertProjection,
} from "../../activity/PomodoroPhaseAlert";
import { loadActivityWorkBundle } from "./activity-controller";

function remainingTimerMs(deadlineAt: string | null, now: number): number {
  if (deadlineAt === null) return 0;
  const deadlineAtMs = Date.parse(deadlineAt);
  return Number.isFinite(deadlineAtMs) ? Math.max(0, deadlineAtMs - now) : 0;
}

export type ActivityActionState =
  | "idle"
  | "starting-session"
  | "stopping-session"
  | "starting-focus"
  | "pausing-focus"
  | "resuming-focus"
  | "saving-focus-note"
  | "stopping-focus";

export type ActivityCoordinationRefs = Readonly<{
  activeWritingSessionRef: MutableRefObject<
    WritingSessionProjection | undefined
  >;
  manuscriptFocusOwnedWritingSessionIdRef: MutableRefObject<
    EntityId<"WritingSession"> | null
  >;
  manuscriptFocusSessionPendingRef: MutableRefObject<Promise<void>>;
}>;

type AutomaticWritingSessionClient = Pick<
  StudioBridge["activity"],
  "startSession" | "stopSession"
>;

export function startAutomaticWritingSession(
  client: AutomaticWritingSessionClient,
  document: ManuscriptDocumentSource,
): Promise<WorkActivityProjection> {
  return client.startSession({
    schemaVersion: 1,
    workId: document.workId,
    documentId: document.documentId,
    note: "",
  });
}

export function stopAutomaticWritingSession(
  client: AutomaticWritingSessionClient,
  workId: EntityId<"Work">,
  sessionId: EntityId<"WritingSession">,
): Promise<WorkActivityProjection> {
  return client.stopSession({
    schemaVersion: 1,
    workId,
    sessionId,
  });
}

export function useActivityController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: StudioBridge["activity"];
  document: ManuscriptDocumentSource | null;
  manuscriptFocusActive: boolean;
  coordination: ActivityCoordinationRefs;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  onPomodoroStarted: (
    document: ManuscriptDocumentSource,
  ) => Promise<void>;
}>) {
  const {
    activeWritingSessionRef,
    manuscriptFocusOwnedWritingSessionIdRef,
    manuscriptFocusSessionPendingRef,
  } = input.coordination;
  const [workActivity, setWorkActivity] =
    useState<WorkActivityProjection | null>(null);
  const [pomodoro, setPomodoro] = useState<PomodoroProjection | null>(null);
  const [pomodoroPhaseAlert, setPomodoroPhaseAlert] =
    useState<PomodoroPhaseAlertProjection | null>(null);
  const [dailyGoals, setDailyGoals] =
    useState<WorkRecordsGoalsProjection | null>(null);
  const [readthroughSettings, setReadthroughSettings] =
    useState<WorkReadthroughProjection | null>(null);
  const [readthroughActionState, setReadthroughActionState] = useState<
    "loading" | "idle" | "saving"
  >("loading");
  const [readthroughError, setReadthroughError] = useState<string | null>(null);
  const [recordsExportActionState, setRecordsExportActionState] = useState<
    "idle" | "exporting-json" | "exporting-csv"
  >("idle");
  const [recordsExportError, setRecordsExportError] = useState<string | null>(
    null,
  );
  const [recordsExportMessage, setRecordsExportMessage] = useState<
    string | null
  >(null);
  const [showDailyGoalDialog, setShowDailyGoalDialog] = useState(false);
  const [dailyGoalActionState, setDailyGoalActionState] = useState<
    "idle" | "saving"
  >("idle");
  const [dailyGoalError, setDailyGoalError] = useState<string | null>(null);
  const [activityActionState, setActivityActionState] =
    useState<ActivityActionState>("idle");
  const [activityActionError, setActivityActionError] = useState<string | null>(
    null,
  );
  const [showFocusDialog, setShowFocusDialog] = useState(false);
  const [activityClock, setActivityClock] = useState(() => Date.now());

  const editingDocumentKeyRef = useRef<string | null>(null);
  const deferredAutomaticActivityRef =
    useRef<WorkActivityProjection | null>(null);
  const deferredAutomaticActivityErrorRef = useRef<string | null>(null);
  const writingSessionTransitionPendingRef = useRef(false);
  const manuscriptFocusActiveRef = useRef(input.manuscriptFocusActive);
  const manuscriptFocusSessionTransitionPendingRef = useRef(false);
  const manuscriptFocusSessionAttemptedRef = useRef(false);
  const pomodoroReconcilePendingRef = useRef(false);
  const pomodoroResumePendingRef = useRef(false);
  const resumePausedPomodoroOnInputRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (!writingSessionTransitionPendingRef.current) {
        // Another window may have ended this session. The next input asks the
        // shared runtime to continue or switch the one authoritative session.
        activeWritingSessionRef.current = undefined;
        deferredAutomaticActivityRef.current = null;
      }
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [activeWritingSessionRef]);

  useEffect(() => {
    manuscriptFocusActiveRef.current = input.manuscriptFocusActive;
  }, [input.manuscriptFocusActive]);

  useEffect(() => {
    if (input.activeWorkId === null) {
      const reset = window.setTimeout(() => {
        setWorkActivity(null);
        setPomodoro(null);
        setDailyGoals(null);
        setReadthroughSettings(null);
        setReadthroughActionState("loading");
        setReadthroughError(null);
        setRecordsExportActionState("idle");
        setRecordsExportError(null);
        setRecordsExportMessage(null);
        setShowDailyGoalDialog(false);
        setDailyGoalError(null);
        setActivityActionError(null);
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void loadActivityWorkBundle(input.client, input.activeWorkId).then(
      ([
        activityProjection,
        pomodoroProjection,
        goalsProjection,
        readthroughProjection,
      ]) => {
        if (!disposed) {
          setWorkActivity(activityProjection);
          setPomodoro(pomodoroProjection);
          setDailyGoals(goalsProjection);
          setReadthroughSettings(readthroughProjection);
          setReadthroughActionState("idle");
          setReadthroughError(null);
          setDailyGoalError(null);
          setActivityActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setWorkActivity(null);
          setPomodoro(null);
          setDailyGoals(null);
          setReadthroughSettings(null);
          setReadthroughActionState("idle");
          setReadthroughError("집필 기록 설정을 불러오지 못했습니다.");
          setActivityActionError(
            "작업 기록과 집중 타이머를 불러오지 못했습니다.",
          );
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [input.activeWorkId, input.client]);

  const activeWritingSession =
    input.activeWorkId !== null && workActivity?.workId === input.activeWorkId
      ? workActivity.sessions.find(
          (session) => session.sessionId === workActivity.activeSessionId,
        )
      : undefined;
  useEffect(() => {
    activeWritingSessionRef.current = activeWritingSession;
  }, [activeWritingSession, activeWritingSessionRef]);
  const activeFocusCycle =
    input.activeWorkId !== null && workActivity?.workId === input.activeWorkId
      ? workActivity.focusCycles.find(
          (cycle) => cycle.focusCycleId === workActivity.activeFocusCycleId,
        )
      : undefined;
  const activePomodoroPhase =
    input.activeWorkId !== null && pomodoro?.workId === input.activeWorkId
      ? pomodoro.activePhase
      : null;

  useEffect(() => {
    if (
      activeWritingSession === undefined &&
      activeFocusCycle?.state !== "running" &&
      activePomodoroPhase?.state !== "running"
    ) {
      return;
    }
    const updateClock = () => {
      setActivityClock(Date.now());
    };
    const initialUpdate = window.setTimeout(updateClock, 0);
    const interval = window.setInterval(updateClock, 1_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, [activeFocusCycle, activePomodoroPhase, activeWritingSession]);

  useEffect(() => {
    if (
      pomodoro === null ||
      activePomodoroPhase?.state !== "running" ||
      activePomodoroPhase.deadlineAt === null ||
      remainingTimerMs(activePomodoroPhase.deadlineAt, activityClock) > 0 ||
      pomodoroReconcilePendingRef.current
    ) {
      return;
    }
    const workId = pomodoro.workId;
    const focusCycleId = activePomodoroPhase.focusCycleId;
    let disposed = false;
    pomodoroReconcilePendingRef.current = true;
    void (async () => {
      try {
        const nextPomodoro = await input.client.reconcilePomodoro({
          schemaVersion: 1,
          workId,
          focusCycleId,
        });
        const nextActivity = await input.client.listWork({
          schemaVersion: 1,
          workId,
        });
        if (!disposed) {
          const phaseAlert = derivePomodoroPhaseAlert(pomodoro, nextPomodoro);
          setPomodoro(nextPomodoro);
          setWorkActivity(nextActivity);
          if (phaseAlert !== null) {
            setPomodoroPhaseAlert(phaseAlert);
            playPomodoroPhaseAlertSound();
          }
          setActivityActionError(null);
        }
      } catch {
        if (!disposed) {
          setActivityActionError(
            "집중 타이머의 다음 단계를 불러오지 못했습니다.",
          );
        }
      } finally {
        pomodoroReconcilePendingRef.current = false;
      }
    })();
    return () => {
      disposed = true;
    };
  }, [activePomodoroPhase, activityClock, input.client, pomodoro]);

  const startWritingSession = useCallback(
    async (
      document: ManuscriptDocumentSource | null = input.document,
    ) => {
      if (document === null || activityActionState !== "idle") return null;
      setActivityActionState("starting-session");
      setActivityActionError(null);
      try {
        await input.persistDocument(document);
        const projection = await input.client.startSession({
          schemaVersion: 1,
          workId: document.workId,
          documentId: document.documentId,
          note: "",
        });
        activeWritingSessionRef.current =
          projection.sessions.find(
            (session) => session.sessionId === projection.activeSessionId,
          );
        deferredAutomaticActivityRef.current = null;
        setWorkActivity(projection);
        return projection;
      } catch {
        setActivityActionError("작업 기록을 시작하지 못했습니다.");
        return null;
      } finally {
        setActivityActionState("idle");
      }
    },
    [activeWritingSessionRef, activityActionState, input],
  );

  const stopWritingSession = useCallback(
    async (
      session: WritingSessionProjection | undefined = activeWritingSession,
      document: ManuscriptDocumentSource | null = input.document,
    ) => {
      if (
        document === null ||
        session === undefined ||
        activityActionState !== "idle"
      ) {
        return null;
      }
      setActivityActionState("stopping-session");
      setActivityActionError(null);
      try {
        await input.persistDocument(document);
        const projection = await input.client.stopSession({
          schemaVersion: 1,
          workId: document.workId,
          sessionId: session.sessionId,
        });
        activeWritingSessionRef.current =
          projection.sessions.find(
            (entry) => entry.sessionId === projection.activeSessionId,
          );
        deferredAutomaticActivityRef.current = null;
        setWorkActivity(projection);
        return projection;
      } catch {
        setActivityActionError("작업 기록을 종료하지 못했습니다.");
        return null;
      } finally {
        setActivityActionState("idle");
      }
    },
    [activeWritingSession, activeWritingSessionRef, activityActionState, input],
  );

  useEffect(() => {
    if (
      input.document === null ||
      activityActionState !== "idle" ||
      manuscriptFocusSessionTransitionPendingRef.current
    ) {
      return;
    }
    if (input.manuscriptFocusActive) {
      if (
        activeWritingSession !== undefined ||
        manuscriptFocusSessionAttemptedRef.current
      ) {
        return;
      }
      manuscriptFocusSessionAttemptedRef.current = true;
      manuscriptFocusSessionTransitionPendingRef.current = true;
      const document = input.document;
      const transition = startWritingSession(document).then(async (projection) => {
        const started = projection?.sessions.find(
          (session) => session.sessionId === projection.activeSessionId,
        );
        if (started === undefined) return;
        if (!manuscriptFocusActiveRef.current) {
          await stopWritingSession(started, document);
          return;
        }
        manuscriptFocusOwnedWritingSessionIdRef.current =
          started.sessionId;
      }).finally(() => {
        manuscriptFocusSessionTransitionPendingRef.current = false;
      });
      manuscriptFocusSessionPendingRef.current = transition;
      void transition;
      return;
    }
    manuscriptFocusSessionAttemptedRef.current = false;
    const ownedSessionId =
      manuscriptFocusOwnedWritingSessionIdRef.current;
    if (ownedSessionId === null) return;
    manuscriptFocusOwnedWritingSessionIdRef.current = null;
    if (activeWritingSession?.sessionId !== ownedSessionId) return;
    manuscriptFocusSessionTransitionPendingRef.current = true;
    const transition = stopWritingSession(
      activeWritingSession,
      input.document,
    ).then(() => undefined).finally(() => {
      manuscriptFocusSessionTransitionPendingRef.current = false;
    });
    manuscriptFocusSessionPendingRef.current = transition;
    void transition;
  }, [activeWritingSession, activityActionState, manuscriptFocusOwnedWritingSessionIdRef, manuscriptFocusSessionPendingRef, input, startWritingSession, stopWritingSession]);

  const handleDocumentEdited = useCallback(
    (document: ManuscriptDocumentSource) => {
      const documentKey = `${document.workId}:${document.documentId}`;
      editingDocumentKeyRef.current = documentKey;
      const currentWritingSession =
        activeWritingSessionRef.current;
      if (
        currentWritingSession?.documentId === document.documentId ||
        writingSessionTransitionPendingRef.current
      ) {
        return;
      }
      writingSessionTransitionPendingRef.current = true;
      void (async () => {
        try {
          if (currentWritingSession !== undefined) {
            const stoppedProjection = await stopAutomaticWritingSession(
              input.client,
              document.workId,
              currentWritingSession.sessionId,
            );
            activeWritingSessionRef.current =
              stoppedProjection.sessions.find(
                (session) =>
                  session.sessionId === stoppedProjection.activeSessionId,
              );
            deferredAutomaticActivityRef.current = stoppedProjection;
          }
          if (editingDocumentKeyRef.current !== documentKey) return;
          const projection = await startAutomaticWritingSession(
            input.client,
            document,
          );
          activeWritingSessionRef.current =
            projection.sessions.find(
              (session) => session.sessionId === projection.activeSessionId,
            );
          deferredAutomaticActivityRef.current = projection;
          deferredAutomaticActivityErrorRef.current = null;
          if (
            editingDocumentKeyRef.current === documentKey ||
            projection.activeSessionId === null
          ) {
            return;
          }
          const startedSession = projection.sessions.find(
            (session) => session.sessionId === projection.activeSessionId,
          );
          if (startedSession === undefined) return;
          const stoppedProjection = await stopAutomaticWritingSession(
            input.client,
            document.workId,
            startedSession.sessionId,
          );
          activeWritingSessionRef.current =
            stoppedProjection.sessions.find(
              (session) =>
                session.sessionId === stoppedProjection.activeSessionId,
            );
          deferredAutomaticActivityRef.current = stoppedProjection;
        } catch {
          deferredAutomaticActivityErrorRef.current =
            "작업 기록을 시작하지 못했습니다.";
        }
      })().finally(() => {
        writingSessionTransitionPendingRef.current = false;
        if (editingDocumentKeyRef.current === null) {
          const projection = deferredAutomaticActivityRef.current;
          deferredAutomaticActivityRef.current = null;
          if (projection !== null) setWorkActivity(projection);
          const error = deferredAutomaticActivityErrorRef.current;
          deferredAutomaticActivityErrorRef.current = null;
          if (error !== null) setActivityActionError(error);
        }
      });
    },
    [activeWritingSessionRef, input.client],
  );

  const handleDocumentBlur = useCallback(
    (document: ManuscriptDocumentSource) => {
      const documentKey = `${document.workId}:${document.documentId}`;
      if (editingDocumentKeyRef.current === documentKey) {
        editingDocumentKeyRef.current = null;
      }
      const deferredError = deferredAutomaticActivityErrorRef.current;
      deferredAutomaticActivityErrorRef.current = null;
      if (deferredError !== null) setActivityActionError(deferredError);
      const currentWritingSession =
        activeWritingSessionRef.current;
      if (input.manuscriptFocusActive) {
        if (!writingSessionTransitionPendingRef.current) {
          void input.persistDocument(document).catch(() => undefined);
        }
        return;
      }
      if (
        currentWritingSession?.documentId === document.documentId &&
        !writingSessionTransitionPendingRef.current
      ) {
        void stopWritingSession(currentWritingSession, document);
        return;
      }
      if (!writingSessionTransitionPendingRef.current) {
        void input.persistDocument(document).catch(() => undefined);
      }
    },
    [activeWritingSessionRef, input, stopWritingSession],
  );

  const configureAndStartPomodoro = useCallback(
    async (settings: PomodoroDialogSubmitValue) => {
      if (input.document === null || activityActionState !== "idle") return;
      preparePomodoroPhaseAlertSound();
      setActivityActionState("starting-focus");
      setActivityActionError(null);
      setPomodoroPhaseAlert(null);
      try {
        const document = input.document;
        await input.persistDocument(document);
        const nextPomodoro = await input.client.configureAndStartPomodoro({
          schemaVersion: 1,
          workId: document.workId,
          documentId: document.documentId,
          ...settings,
        });
        setPomodoro(nextPomodoro);
        setShowFocusDialog(false);
        const nextActivity = await input.client.listWork({
          schemaVersion: 1,
          workId: document.workId,
        });
        setWorkActivity(nextActivity);
        await input.onPomodoroStarted(document);
      } catch {
        setActivityActionError("집중 타이머를 시작하지 못했습니다.");
      } finally {
        setActivityActionState("idle");
      }
    },
    [activityActionState, input],
  );

  const pausePomodoro = useCallback(async () => {
    if (
      input.document === null ||
      activePomodoroPhase?.state !== "running" ||
      activityActionState !== "idle"
    ) return;
    setActivityActionState("pausing-focus");
    setActivityActionError(null);
    try {
      const nextPomodoro = await input.client.pausePomodoro({
        schemaVersion: 1,
        workId: input.document.workId,
        focusCycleId: activePomodoroPhase.focusCycleId,
      });
      setPomodoro(nextPomodoro);
      setWorkActivity(await input.client.listWork({
        schemaVersion: 1,
        workId: input.document.workId,
      }));
    } catch {
      setActivityActionError("집중 타이머를 일시정지하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [activePomodoroPhase, activityActionState, input]);

  const resumePomodoro = useCallback(async () => {
    if (
      input.document === null ||
      activePomodoroPhase?.state !== "paused" ||
      activityActionState !== "idle" ||
      pomodoroResumePendingRef.current
    ) return;
    pomodoroResumePendingRef.current = true;
    preparePomodoroPhaseAlertSound();
    setActivityActionState("resuming-focus");
    setActivityActionError(null);
    try {
      const nextPomodoro = await input.client.resumePomodoro({
        schemaVersion: 1,
        workId: input.document.workId,
        focusCycleId: activePomodoroPhase.focusCycleId,
      });
      setPomodoro(nextPomodoro);
      setWorkActivity(await input.client.listWork({
        schemaVersion: 1,
        workId: input.document.workId,
      }));
    } catch {
      setActivityActionError("집중 타이머를 재개하지 못했습니다.");
    } finally {
      pomodoroResumePendingRef.current = false;
      setActivityActionState("idle");
    }
  }, [activePomodoroPhase, activityActionState, input]);

  useEffect(() => {
    resumePausedPomodoroOnInputRef.current = () => {
      if (
        activePomodoroPhase?.state === "paused" &&
        activePomodoroPhase.phase === "work"
      ) {
        void resumePomodoro();
      }
    };
    return () => {
      resumePausedPomodoroOnInputRef.current = () => undefined;
    };
  }, [activePomodoroPhase, resumePomodoro]);

  const resumePausedPomodoroOnInput = useCallback(() => {
    resumePausedPomodoroOnInputRef.current();
  }, []);

  const savePomodoroNote = useCallback(async (note: string) => {
    if (
      input.document === null ||
      activePomodoroPhase === null ||
      activityActionState !== "idle"
    ) return;
    setActivityActionState("saving-focus-note");
    setActivityActionError(null);
    try {
      const nextPomodoro = await input.client.updatePomodoroNote({
        schemaVersion: 1,
        workId: input.document.workId,
        focusCycleId: activePomodoroPhase.focusCycleId,
        note,
      });
      setPomodoro(nextPomodoro);
      setWorkActivity(await input.client.listWork({
        schemaVersion: 1,
        workId: input.document.workId,
      }));
    } catch {
      setActivityActionError("세션 메모를 저장하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [activePomodoroPhase, activityActionState, input]);

  const stopPomodoro = useCallback(async () => {
    if (
      input.document === null ||
      activePomodoroPhase === null ||
      activityActionState !== "idle"
    ) return;
    setActivityActionState("stopping-focus");
    setActivityActionError(null);
    try {
      const nextPomodoro = await input.client.stopPomodoro({
        schemaVersion: 1,
        workId: input.document.workId,
        focusCycleId: activePomodoroPhase.focusCycleId,
      });
      setPomodoro(nextPomodoro);
      setWorkActivity(await input.client.listWork({
        schemaVersion: 1,
        workId: input.document.workId,
      }));
    } catch {
      setActivityActionError("집중 타이머를 종료하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [activePomodoroPhase, activityActionState, input]);

  const stopFocusCycle = useCallback(async () => {
    if (
      input.document === null ||
      activeFocusCycle === undefined ||
      activityActionState !== "idle"
    ) return;
    setActivityActionState("stopping-focus");
    setActivityActionError(null);
    try {
      await input.persistDocument(input.document);
      setWorkActivity(await input.client.stopFocus({
        schemaVersion: 1,
        workId: input.document.workId,
        focusCycleId: activeFocusCycle.focusCycleId,
      }));
    } catch {
      setActivityActionError("집중 시간을 종료하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [activeFocusCycle, activityActionState, input]);

  const exportRecords = useCallback(async (request: Readonly<{
    format: "json" | "csv";
    fromDate: string;
    toDate: string;
  }>) => {
    if (input.activeWorkId === null) return;
    setRecordsExportError(null);
    setRecordsExportMessage(null);
    setRecordsExportActionState(`exporting-${request.format}`);
    try {
      const result = await input.client.exportRecords({
        schemaVersion: 1,
        workId: input.activeWorkId,
        ...request,
      });
      setRecordsExportMessage(
        result.status === "cancelled"
          ? "기록 내보내기를 취소했습니다."
          : `${result.sessionCount}개 세션을 내보냈습니다.`,
      );
    } catch (reason) {
      setRecordsExportError(
        reason instanceof Error
          ? reason.message
          : "집필 기록을 내보내지 못했습니다.",
      );
    } finally {
      setRecordsExportActionState("idle");
    }
  }, [input.activeWorkId, input.client]);

  const saveRecordsGoals = useCallback(async (goals: WorkRecordsGoals) => {
    if (dailyGoals === null) return;
    setDailyGoalActionState("saving");
    setDailyGoalError(null);
    try {
      setDailyGoals(await input.client.saveRecordsGoals({
        schemaVersion: 1,
        workId: dailyGoals.workId,
        expectedRevision: dailyGoals.revision,
        goals,
      }));
    } catch {
      setDailyGoalError("집필 목표를 저장하지 못했습니다.");
    } finally {
      setDailyGoalActionState("idle");
    }
  }, [dailyGoals, input.client]);

  const saveDailyGoals = useCallback(async (goals: WorkRecordsGoals) => {
    if (dailyGoals === null) return;
    setDailyGoalActionState("saving");
    setDailyGoalError(null);
    try {
      setDailyGoals(await input.client.saveRecordsGoals({
        schemaVersion: 1,
        workId: dailyGoals.workId,
        expectedRevision: dailyGoals.revision,
        goals,
      }));
      setDailyGoalActionState("idle");
      setShowDailyGoalDialog(false);
    } catch {
      setDailyGoalError("오늘 목표를 저장하지 못했습니다.");
      setDailyGoalActionState("idle");
    }
  }, [dailyGoals, input.client]);

  const saveReadthrough = useCallback(async (
    entries: readonly WorkReadthroughEntry[],
  ) => {
    if (readthroughSettings === null) return;
    setReadthroughActionState("saving");
    setReadthroughError(null);
    try {
      setReadthroughSettings(await input.client.saveReadthrough({
        schemaVersion: 1,
        workId: readthroughSettings.workId,
        expectedRevision: readthroughSettings.revision,
        entries,
      }));
    } catch {
      setReadthroughError("연독률 기록을 저장하지 못했습니다.");
    } finally {
      setReadthroughActionState("idle");
    }
  }, [input.client, readthroughSettings]);

  const openFocusDialog = useCallback(() => {
    setActivityActionError(null);
    setShowFocusDialog(true);
  }, []);
  const closeFocusDialog = useCallback(() => {
    if (activityActionState !== "idle") return;
    setShowFocusDialog(false);
    setActivityActionError(null);
  }, [activityActionState]);
  const clearActivityActionError = useCallback(() => {
    setActivityActionError(null);
  }, []);
  const dismissPomodoroPhaseAlert = useCallback(() => {
    setPomodoroPhaseAlert(null);
  }, []);
  const openDailyGoalDialog = useCallback(() => {
    setDailyGoalError(null);
    setShowDailyGoalDialog(true);
  }, []);
  const closeDailyGoalDialog = useCallback(() => {
    if (dailyGoalActionState !== "idle") return;
    setShowDailyGoalDialog(false);
    setDailyGoalError(null);
  }, [dailyGoalActionState]);

  return {
    workActivity,
    pomodoro,
    pomodoroPhaseAlert,
    dailyGoals,
    readthroughSettings,
    readthroughActionState,
    readthroughError,
    recordsExportActionState,
    recordsExportError,
    recordsExportMessage,
    showDailyGoalDialog,
    dailyGoalActionState,
    dailyGoalError,
    activityActionState,
    activityActionError,
    showFocusDialog,
    activityClock,
    activeWritingSession,
    activeFocusCycle,
    activePomodoroPhase,
    startWritingSession,
    stopWritingSession,
    handleDocumentEdited,
    handleDocumentBlur,
    configureAndStartPomodoro,
    pausePomodoro,
    resumePomodoro,
    resumePausedPomodoroOnInput,
    savePomodoroNote,
    stopPomodoro,
    stopFocusCycle,
    exportRecords,
    saveRecordsGoals,
    saveDailyGoals,
    saveReadthrough,
    openFocusDialog,
    closeFocusDialog,
    clearActivityActionError,
    dismissPomodoroPhaseAlert,
    openDailyGoalDialog,
    closeDailyGoalDialog,
  };
}
