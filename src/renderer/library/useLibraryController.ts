import { useCallback, useEffect, useMemo, useState } from "react";

import type { StudioBridge } from "../../application/contracts/studio-bridge";
import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../application/workspace/workspace-contract";
import type { WorkCoverProjection } from "../../application/workspace/work-covers";
import type { EntityId } from "../../domain/writing";
import type { ManuscriptResumePreview } from "../WorkspaceRoot";
import type { WorkspaceController } from "../workspace/lifecycle/WorkspaceController";
import { localDateKey } from "../schedule/work-schedule-summary";

type CatalogState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly catalog: WorkspaceCatalogProjection }
  | { readonly status: "error" };

type LibraryActionState =
  | "idle"
  | "opening"
  | "creating"
  | "leaving"
  | "retiring"
  | "retiring-document"
  | "moving-document"
  | "renaming-work"
  | "favoriting-work"
  | "selecting-cover";

export function useLibraryController(input: Readonly<{
  confirm: (message: string) => boolean;
  scheduleClient: StudioBridge["schedule"];
  workspaceClient: StudioBridge["workspace"];
  workspaceController: Pick<
    WorkspaceController,
    | "isAvailable"
    | "activateLocation"
    | "openSchedule"
    | "openCompletedRevision"
    | "prepareForMain"
    | "createWork"
    | "renameWork"
    | "retireWork"
    | "retireDocument"
    | "moveDocument"
  >;
}>) {
  const [activePage, setActivePage] = useState<"main" | "workspace">("main");
  const [catalogState, setCatalogState] = useState<CatalogState>({
    status: "loading",
  });
  const [favoriteWorkIds, setFavoriteWorkIds] = useState<
    readonly EntityId<"Work">[]
  >([]);
  const [workCovers, setWorkCovers] = useState<readonly WorkCoverProjection[]>(
    [],
  );
  const [resumePreview, setResumePreview] =
    useState<ManuscriptResumePreview | null>(null);
  const [showCreateWork, setShowCreateWork] = useState(false);
  const [renameWorkTarget, setRenameWorkTarget] =
    useState<WorkspaceWorkSummary | null>(null);
  const [actionState, setActionState] =
    useState<LibraryActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [scheduleByWork, setScheduleByWork] = useState<
    Readonly<Record<string, WorkCalendarProjection>>
  >({});
  const [scheduleRefreshRevision, setScheduleRefreshRevision] = useState(0);

  const catalog = catalogState.status === "ready"
    ? catalogState.catalog
    : null;
  const busy = actionState !== "idle";

  useEffect(() => {
    const shared = input.workspaceClient.shared;
    if (shared === undefined) return;
    let disposed = false;
    const refresh = () => {
      void input.workspaceClient.getCatalog().then((next) => {
        if (!disposed) setCatalogState({ status: "ready", catalog: next });
      }).catch(() => {
        if (!disposed) setActionError("다른 창의 작품 목록을 불러오지 못했습니다.");
      });
    };
    const unsubscribe = shared.onChanged(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, [input.workspaceClient]);

  const loadCatalog = useCallback(async () => {
    setCatalogState({ status: "loading" });
    try {
      const [loadedCatalog, loadedFavorites, loadedCovers] = await Promise.all([
        input.workspaceClient.getCatalog(),
        input.workspaceClient.getFavorites(),
        input.workspaceClient.getCovers(),
      ]);
      setCatalogState({ status: "ready", catalog: loadedCatalog });
      setFavoriteWorkIds(loadedFavorites.workIds);
      setWorkCovers(loadedCovers.covers);
    } catch {
      setCatalogState({ status: "error" });
    }
  }, [input.workspaceClient]);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      input.workspaceClient.getCatalog(),
      input.workspaceClient.getFavorites(),
      input.workspaceClient.getCovers(),
    ]).then(
      ([loadedCatalog, loadedFavorites, loadedCovers]) => {
        if (!disposed) {
          setCatalogState({ status: "ready", catalog: loadedCatalog });
          setFavoriteWorkIds(loadedFavorites.workIds);
          setWorkCovers(loadedCovers.covers);
        }
      },
      () => {
        if (!disposed) setCatalogState({ status: "error" });
      },
    );
    return () => {
      disposed = true;
    };
  }, [input.workspaceClient]);

  useEffect(() => {
    if (catalog === null || catalog.works.length === 0) {
      let disposed = false;
      queueMicrotask(() => {
        if (!disposed) setScheduleByWork({});
      });
      return () => {
        disposed = true;
      };
    }
    let disposed = false;
    const today = localDateKey();
    void input.scheduleClient.listToday({ schemaVersion: 1, date: today }).then(
      (projection) => {
        if (!disposed) {
          setScheduleByWork(Object.freeze(Object.fromEntries(
            projection.works.map((work) => [
              work.workId,
              work.calendar,
            ] as const),
          )));
        }
      },
      () => {
        if (!disposed) setScheduleByWork({});
      },
    );
    return () => {
      disposed = true;
    };
  }, [catalog, input.scheduleClient, scheduleRefreshRevision]);

  const acceptCatalog = useCallback((
    nextCatalog: WorkspaceCatalogProjection,
  ) => {
    setCatalogState({ status: "ready", catalog: nextCatalog });
  }, []);
  const acceptResumePreview = useCallback((
    preview: ManuscriptResumePreview | null,
  ) => {
    setResumePreview(preview);
  }, []);
  const refreshSchedule = useCallback(() => {
    setScheduleRefreshRevision((current) => current + 1);
  }, []);
  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);
  const openCreateWorkDialog = useCallback(() => {
    setActionError(null);
    setShowCreateWork(true);
  }, []);
  const closeCreateWorkDialog = useCallback(() => {
    if (actionState !== "idle") return;
    setShowCreateWork(false);
    setActionError(null);
  }, [actionState]);
  const openRenameWorkDialog = useCallback((work: WorkspaceWorkSummary) => {
    setActionError(null);
    setRenameWorkTarget(work);
  }, []);
  const closeRenameWorkDialog = useCallback(() => {
    if (actionState !== "idle") return;
    setRenameWorkTarget(null);
    setActionError(null);
  }, [actionState]);

  const toggleWorkFavorite = useCallback((work: WorkspaceWorkSummary) => {
    if (catalogState.status !== "ready" || actionState !== "idle") return;
    const favorite = !favoriteWorkIds.includes(work.workId);
    setActionState("favoriting-work");
    setActionError(null);
    void input.workspaceClient.setFavorite({
      schemaVersion: 1,
      workId: work.workId,
      favorite,
    }).then(
      (projection) => {
        setFavoriteWorkIds(projection.workIds);
        setActionState("idle");
      },
      () => {
        setActionError("즐겨찾기를 변경하지 못했습니다.");
        setActionState("idle");
      },
    );
  }, [actionState, catalogState.status, favoriteWorkIds, input.workspaceClient]);

  const selectWorkCover = useCallback((work: WorkspaceWorkSummary) => {
    if (catalogState.status !== "ready" || actionState !== "idle") return;
    setActionState("selecting-cover");
    setActionError(null);
    void input.workspaceClient.selectCover({
      schemaVersion: 1,
      workId: work.workId,
    }).then(
      (cover) => {
        if (cover !== null) {
          setWorkCovers((current) => [
            ...current.filter((candidate) => candidate.workId !== cover.workId),
            cover,
          ]);
        }
        setActionState("idle");
      },
      () => {
        setActionError("표지 이미지를 등록하지 못했습니다.");
        setActionState("idle");
      },
    );
  }, [actionState, catalogState.status, input.workspaceClient]);

  const openLocation = useCallback(async (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"] | null,
  ) => {
    if (
      catalogState.status !== "ready" ||
      !input.workspaceController.isAvailable() ||
      actionState !== "idle"
    ) return;
    setActionState("opening");
    setActionError(null);
    try {
      const nextCatalog = await input.workspaceController.activateLocation({
        schemaVersion: 1,
        workId,
        documentId,
      });
      acceptCatalog(nextCatalog);
      setActivePage("workspace");
    } catch {
      setActionError("선택한 작품을 열지 못했습니다.");
    } finally {
      setActionState("idle");
    }
  }, [acceptCatalog, actionState, catalogState.status, input.workspaceController]);

  const revealActiveWorkspace = useCallback((): boolean => {
    if (catalogState.status !== "ready" || catalogState.catalog.activeWorkId === null || actionState !== "idle") return false;
    setActivePage("workspace");
    return true;
  }, [actionState, catalogState]);

  const openWorkSchedule = useCallback(async (work: WorkspaceWorkSummary) => {
    await openLocation(
      work.workId,
      work.workId === catalog?.activeWorkId
        ? catalog.activeDocumentId
        : (work.documents[0]?.documentId ?? null),
    );
    if (input.workspaceController.isAvailable()) {
      input.workspaceController.openSchedule();
    }
  }, [catalog, input.workspaceController, openLocation]);

  const openCompletedRevision = useCallback(async (
    work: WorkspaceWorkSummary,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
  ) => {
    if (
      catalogState.status !== "ready" ||
      !input.workspaceController.isAvailable() ||
      actionState !== "idle"
    ) return;
    setActionState("opening");
    setActionError(null);
    try {
      const nextCatalog = await input.workspaceController.openCompletedRevision(
        work.workId,
        documentId,
        revisionId,
      );
      acceptCatalog(nextCatalog);
      setActivePage("workspace");
    } catch {
      setActionError("완료 당시 버전을 열지 못했습니다.");
    } finally {
      setActionState("idle");
    }
  }, [acceptCatalog, actionState, catalogState.status, input.workspaceController]);

  const returnToMain = useCallback(() => {
    if (actionState !== "idle") return;
    if (!input.workspaceController.isAvailable()) {
      setActivePage("main");
      return;
    }
    setActionState("leaving");
    setActionError(null);
    void input.workspaceController.prepareForMain().then(
      (nextCatalog) => {
        acceptCatalog(nextCatalog);
        setActivePage("main");
        setActionState("idle");
      },
      () => {
        setActionError(
          "원고 저장을 마치지 못해 메인으로 이동하지 않았습니다.",
        );
        setActionState("idle");
      },
    );
  }, [acceptCatalog, actionState, input.workspaceController]);

  const createWork = useCallback((work: Readonly<{
    title: string;
    firstDocumentTitle: string;
  }>) => {
    if (catalogState.status !== "ready" || actionState !== "idle") return;
    setActionState("creating");
    setActionError(null);
    void (async () => {
      try {
        let nextCatalog: WorkspaceCatalogProjection;
        if (catalogState.catalog.canCreateFirstWork) {
          await input.workspaceClient.createFirstWork({
            schemaVersion: 1,
            title: work.title,
            firstDocumentTitle: work.firstDocumentTitle,
          });
          nextCatalog = await input.workspaceClient.getCatalog();
        } else {
          if (!input.workspaceController.isAvailable()) {
            throw new Error("The manuscript workspace is unavailable");
          }
          nextCatalog = await input.workspaceController.createWork({
            schemaVersion: 1,
            title: work.title,
            firstDocumentTitle: work.firstDocumentTitle,
          });
        }
        acceptCatalog(nextCatalog);
        setShowCreateWork(false);
        setActivePage("workspace");
      } catch {
        setActionError("작품을 만들지 못했습니다.");
      } finally {
        setActionState("idle");
      }
    })();
  }, [acceptCatalog, actionState, catalogState, input]);

  const renameWork = useCallback((
    work: WorkspaceWorkSummary,
    title: string,
  ) => {
    if (
      catalogState.status !== "ready" ||
      !input.workspaceController.isAvailable() ||
      actionState !== "idle"
    ) return;
    setActionState("renaming-work");
    setActionError(null);
    void input.workspaceController.renameWork(work.workId, title).then(
      (nextCatalog) => {
        acceptCatalog(nextCatalog);
        setRenameWorkTarget(null);
        setActionState("idle");
      },
      () => {
        setActionError("작품 이름을 변경하지 못했습니다.");
        setActionState("idle");
      },
    );
  }, [acceptCatalog, actionState, catalogState.status, input.workspaceController]);

  const retireWork = useCallback((work: WorkspaceWorkSummary) => {
    if (
      catalogState.status !== "ready" ||
      !input.workspaceController.isAvailable() ||
      actionState !== "idle"
    ) return;
    if (!input.confirm(
      `‘${work.title}’ 작품을 작업실에서 삭제할까요?\n원고와 기록은 복구를 위해 보존됩니다.`,
    )) return;
    setActionState("retiring");
    setActionError(null);
    void input.workspaceController.retireWork(work.workId).then(
      (nextCatalog) => {
        acceptCatalog(nextCatalog);
        setActivePage("main");
        setActionState("idle");
      },
      () => {
        setActionError("작품을 삭제하지 못했습니다.");
        setActionState("idle");
      },
    );
  }, [acceptCatalog, actionState, catalogState.status, input]);

  const retireDocument = useCallback((
    work: WorkspaceWorkSummary,
    document: WorkspaceWorkSummary["documents"][number],
  ) => {
    if (
      catalogState.status !== "ready" ||
      !input.workspaceController.isAvailable() ||
      actionState !== "idle"
    ) return;
    if (!input.confirm(
      `‘${document.title}’ 회차를 삭제할까요?\n원고와 기록은 복구를 위해 보존됩니다.`,
    )) return;
    setActionState("retiring-document");
    setActionError(null);
    void input.workspaceController
      .retireDocument(work.workId, document.documentId)
      .then(
        (nextCatalog) => {
          acceptCatalog(nextCatalog);
          setActivePage("main");
          setActionState("idle");
        },
        () => {
          setActionError("회차를 삭제하지 못했습니다.");
          setActionState("idle");
        },
      );
  }, [acceptCatalog, actionState, catalogState.status, input]);

  const moveDocument = useCallback((
    work: WorkspaceWorkSummary,
    document: WorkspaceWorkSummary["documents"][number],
    direction: "earlier" | "later",
  ) => {
    if (
      catalogState.status !== "ready" ||
      !input.workspaceController.isAvailable() ||
      actionState !== "idle"
    ) return;
    setActionState("moving-document");
    setActionError(null);
    void input.workspaceController
      .moveDocument(work.workId, document.documentId, direction)
      .then(
        (nextCatalog) => {
          acceptCatalog(nextCatalog);
          setActionState("idle");
        },
        () => {
          setActionError("회차 순서를 변경하지 못했습니다.");
          setActionState("idle");
        },
      );
  }, [acceptCatalog, actionState, catalogState.status, input.workspaceController]);

  return useMemo(() => ({
    activePage,
    catalogState,
    catalog,
    favoriteWorkIds,
    workCovers,
    resumePreview,
    showCreateWork,
    renameWorkTarget,
    actionState,
    actionError,
    scheduleByWork,
    busy,
    loadCatalog,
    acceptCatalog,
    acceptResumePreview,
    refreshSchedule,
    clearActionError,
    openCreateWorkDialog,
    closeCreateWorkDialog,
    openRenameWorkDialog,
    closeRenameWorkDialog,
    toggleWorkFavorite,
    selectWorkCover,
    openLocation,
    revealActiveWorkspace,
    openWorkSchedule,
    openCompletedRevision,
    returnToMain,
    createWork,
    renameWork,
    retireWork,
    retireDocument,
    moveDocument,
  }), [
    acceptCatalog,
    acceptResumePreview,
    actionError,
    actionState,
    activePage,
    busy,
    catalog,
    catalogState,
    clearActionError,
    closeCreateWorkDialog,
    closeRenameWorkDialog,
    createWork,
    favoriteWorkIds,
    loadCatalog,
    moveDocument,
    openCompletedRevision,
    openCreateWorkDialog,
    openLocation,
    revealActiveWorkspace,
    openRenameWorkDialog,
    openWorkSchedule,
    renameWork,
    renameWorkTarget,
    resumePreview,
    retireDocument,
    retireWork,
    returnToMain,
    scheduleByWork,
    selectWorkCover,
    showCreateWork,
    toggleWorkFavorite,
    workCovers,
    refreshSchedule,
  ]);
}
