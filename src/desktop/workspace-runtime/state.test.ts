import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { entityId } from "../../domain/writing";
import { workspaceWindowContext, type WorkspaceWindowContext } from "../workspace-window-context";
import { WorkspaceRuntimeState } from "./state";

describe("shared workspace window state", () => {
  it("keeps navigation and resume local across interleaved requests while sharing metadata", async () => {
    const workId = entityId<"Work">(randomUUID());
    const firstId = entityId<"Document">(randomUUID());
    const secondId = entityId<"Document">(randomUUID());
    const state = new WorkspaceRuntimeState({
      catalog: { schemaVersion: 1, works: [], activeWorkId: workId, activeDocumentId: firstId, canCreateFirstWork: false },
      documentProfile: { schemaVersion: 1, initialDocumentId: firstId, documents: [] },
      resumeProjection: { schemaVersion: 1, status: "missing", workId },
      documentTargets: [],
    });
    const first: WorkspaceWindowContext = { webContentsId: 1 };
    const second: WorkspaceWindowContext = { webContentsId: 2 };
    workspaceWindowContext.run(first, () => { expect(state.catalog.activeDocumentId).toBe(firstId); });
    await workspaceWindowContext.run(second, async () => {
      state.replaceCatalog({ ...state.catalog, activeDocumentId: secondId });
      state.replaceDocumentProfile({ ...state.documentProfile, initialDocumentId: secondId });
      state.replaceResumeProjection({ schemaVersion: 1, status: "unavailable" });
      await Promise.resolve();
      expect(state.catalog.activeDocumentId).toBe(secondId);
    });
    workspaceWindowContext.run(first, () => {
      expect(state.catalog.activeDocumentId).toBe(firstId);
      expect(state.documentProfile.initialDocumentId).toBe(firstId);
      expect(state.resumeProjection.status).toBe("missing");
    });
    workspaceWindowContext.run(second, () => {
      expect(state.catalog.activeDocumentId).toBe(secondId);
      expect(state.resumeProjection.status).toBe("unavailable");
    });
  });
});
