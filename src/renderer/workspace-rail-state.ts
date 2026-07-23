import type { EntityId } from "../domain/writing";

export type WorkspaceRail = "left" | "right";
export type WorkspaceRailLayout = "wide" | "narrow";
export type WorkspaceRailVisibility = "open" | "closed";

type WorkRailVisibility = Readonly<
  Record<WorkspaceRail, WorkspaceRailVisibility>
>;

export type WorkspaceRailState = {
  readonly layout: WorkspaceRailLayout;
  readonly initialVisibility: WorkRailVisibility;
  readonly visibilityByWork: ReadonlyMap<
    EntityId<"Work">,
    WorkRailVisibility
  >;
  readonly activeNarrowRailByWork: ReadonlyMap<
    EntityId<"Work">,
    WorkspaceRail
  >;
};

export type WorkspaceRailProjection = Readonly<
  Record<
    WorkspaceRail,
    {
      readonly visible: boolean;
      readonly reentryVisible: boolean;
    }
  >
>;

function freezeVisibility(
  visibility: WorkRailVisibility,
): WorkRailVisibility {
  return Object.freeze({ ...visibility });
}

function freezeState(
  state: WorkspaceRailState,
): WorkspaceRailState {
  return Object.freeze(state);
}

function visibilityForWork(
  state: WorkspaceRailState,
  workId: EntityId<"Work">,
): WorkRailVisibility {
  return (
    state.visibilityByWork.get(workId) ?? state.initialVisibility
  );
}

export function createWorkspaceRailState(input: {
  readonly layout: WorkspaceRailLayout;
  readonly initialVisibility: WorkRailVisibility;
}): WorkspaceRailState {
  return freezeState({
    layout: input.layout,
    initialVisibility: freezeVisibility(input.initialVisibility),
    visibilityByWork: new Map(),
    activeNarrowRailByWork: new Map(),
  });
}

export function setWorkspaceRailLayout(
  state: WorkspaceRailState,
  layout: WorkspaceRailLayout,
): WorkspaceRailState {
  if (state.layout === layout) {
    return state;
  }
  return freezeState({
    ...state,
    layout,
    activeNarrowRailByWork: new Map(),
  });
}

export function toggleWorkspaceRail(
  state: WorkspaceRailState,
  workId: EntityId<"Work">,
  rail: WorkspaceRail,
): WorkspaceRailState {
  const currentVisibility = visibilityForWork(state, workId);
  const visibilityByWork = new Map(state.visibilityByWork);
  const activeNarrowRailByWork = new Map(
    state.activeNarrowRailByWork,
  );

  if (state.layout === "wide") {
    visibilityByWork.set(
      workId,
      freezeVisibility({
        ...currentVisibility,
        [rail]:
          currentVisibility[rail] === "open" ? "closed" : "open",
      }),
    );
  } else if (
    currentVisibility[rail] === "open" &&
    activeNarrowRailByWork.get(workId) === rail
  ) {
    visibilityByWork.set(
      workId,
      freezeVisibility({
        ...currentVisibility,
        [rail]: "closed",
      }),
    );
    activeNarrowRailByWork.delete(workId);
  } else {
    visibilityByWork.set(
      workId,
      freezeVisibility({
        ...currentVisibility,
        [rail]: "open",
      }),
    );
    activeNarrowRailByWork.set(workId, rail);
  }

  return freezeState({
    ...state,
    visibilityByWork,
    activeNarrowRailByWork,
  });
}

export function projectWorkspaceRails(
  state: WorkspaceRailState,
  workId: EntityId<"Work">,
): WorkspaceRailProjection {
  const visibility = visibilityForWork(state, workId);
  const activeNarrowRail =
    state.activeNarrowRailByWork.get(workId);
  const isVisible = (rail: WorkspaceRail) =>
    visibility[rail] === "open" &&
    (state.layout === "wide" || activeNarrowRail === rail);

  const leftVisible = isVisible("left");
  const rightVisible = isVisible("right");
  return Object.freeze({
    left: Object.freeze({
      visible: leftVisible,
      reentryVisible: !leftVisible,
    }),
    right: Object.freeze({
      visible: rightVisible,
      reentryVisible: !rightVisible,
    }),
  });
}
