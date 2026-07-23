import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { entityId } from "../domain/writing";
import {
  createWorkspaceRailState,
  projectWorkspaceRails,
  setWorkspaceRailLayout,
  toggleWorkspaceRail,
} from "./workspace-rail-state";

describe("workspace rail state", () => {
  it("closes and restores left and right rails independently per Work", () => {
    const firstWorkId = entityId<"Work">(randomUUID());
    const secondWorkId = entityId<"Work">(randomUUID());
    let state = createWorkspaceRailState({
      layout: "wide",
      initialVisibility: {
        left: "open",
        right: "open",
      },
    });

    state = toggleWorkspaceRail(state, firstWorkId, "left");

    expect(projectWorkspaceRails(state, firstWorkId)).toEqual({
      left: { visible: false, reentryVisible: true },
      right: { visible: true, reentryVisible: false },
    });
    expect(projectWorkspaceRails(state, secondWorkId)).toEqual({
      left: { visible: true, reentryVisible: false },
      right: { visible: true, reentryVisible: false },
    });

    state = toggleWorkspaceRail(state, firstWorkId, "right");
    state = toggleWorkspaceRail(state, secondWorkId, "right");
    state = toggleWorkspaceRail(state, firstWorkId, "left");

    expect(projectWorkspaceRails(state, firstWorkId)).toEqual({
      left: { visible: true, reentryVisible: false },
      right: { visible: false, reentryVisible: true },
    });
    expect(projectWorkspaceRails(state, secondWorkId)).toEqual({
      left: { visible: true, reentryVisible: false },
      right: { visible: false, reentryVisible: true },
    });
  });

  it("shows at most one narrow overlay without changing the other rail's manual state", () => {
    const workId = entityId<"Work">(randomUUID());
    let state = createWorkspaceRailState({
      layout: "wide",
      initialVisibility: {
        left: "open",
        right: "open",
      },
    });

    state = setWorkspaceRailLayout(state, "narrow");
    expect(projectWorkspaceRails(state, workId)).toEqual({
      left: { visible: false, reentryVisible: true },
      right: { visible: false, reentryVisible: true },
    });

    state = toggleWorkspaceRail(state, workId, "left");
    expect(projectWorkspaceRails(state, workId)).toEqual({
      left: { visible: true, reentryVisible: false },
      right: { visible: false, reentryVisible: true },
    });

    state = toggleWorkspaceRail(state, workId, "right");
    expect(projectWorkspaceRails(state, workId)).toEqual({
      left: { visible: false, reentryVisible: true },
      right: { visible: true, reentryVisible: false },
    });

    state = toggleWorkspaceRail(state, workId, "right");
    state = setWorkspaceRailLayout(state, "wide");
    expect(projectWorkspaceRails(state, workId)).toEqual({
      left: { visible: true, reentryVisible: false },
      right: { visible: false, reentryVisible: true },
    });
  });
});
