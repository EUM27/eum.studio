import type { IpcMain, IpcMainInvokeEvent, WebContents } from "electron";
import { MUSIC_SETTINGS_SAVE_WORK_CHANNEL } from "../../application/contracts/bridge/settings-bridge";
import { WORK_MUSIC_SETTINGS_CHANGED_CHANNEL } from "../../application/music/shared-music-playback";
import {
  SHARED_WORKSPACE_CHANGED_CHANNEL,
  SHARED_WORKSPACE_SNAPSHOT_CHANNEL,
  type SharedWorkspaceSnapshot,
} from "../../application/workspace/shared-workspace-snapshot";
import { workspaceWindowContext, type WorkspaceWindowContext } from "../workspace-window-context";

export function createWindowScopedIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  getContext: (event: IpcMainInvokeEvent) => WorkspaceWindowContext;
  getPeers: (context: WorkspaceWindowContext) => readonly Pick<WebContents, "send" | "isDestroyed">[];
  getSnapshot: () => SharedWorkspaceSnapshot;
}>): Pick<IpcMain, "handle"> {
  const scoped: Pick<IpcMain, "handle"> = {
    handle: (channel, listener) => input.ipcMain.handle(channel, (event, ...args) => {
      input.authorizeSender(event);
      const context = input.getContext(event);
      return workspaceWindowContext.run(context, () => {
        const before = input.getSnapshot();
        const notifyChanges = (result?: unknown) => {
          if (channel === MUSIC_SETTINGS_SAVE_WORK_CHANNEL && typeof result === "object" && result !== null && "workId" in result && typeof result.workId === "string") {
            for (const peer of input.getPeers(context)) if (!peer.isDestroyed()) peer.send(WORK_MUSIC_SETTINGS_CHANGED_CHANNEL, result.workId);
          }
          const after = input.getSnapshot();
          if (before.catalog.works === after.catalog.works &&
            before.documentProfile.documents === after.documentProfile.documents) return;
          for (const peer of input.getPeers(context)) {
            if (!peer.isDestroyed()) peer.send(SHARED_WORKSPACE_CHANGED_CHANNEL);
          }
        };
        const result: unknown = listener(event, ...args);
        if (result instanceof Promise) return result.then((value: unknown) => { notifyChanges(value); return value; });
        notifyChanges(result);
        return result;
      });
    }),
  };
  scoped.handle(SHARED_WORKSPACE_SNAPSHOT_CHANNEL, input.getSnapshot);
  return scoped;
}
