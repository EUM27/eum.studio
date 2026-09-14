import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { parseSharedMusicCommand, parseSharedMusicState, SHARED_MUSIC_ATTACH_CHANNEL, SHARED_MUSIC_COMMAND_CHANNEL, SHARED_MUSIC_DETACH_CHANNEL, SHARED_MUSIC_MESSAGE_CHANNEL, SHARED_MUSIC_PUBLISH_CHANNEL } from "../../application/music/shared-music-playback";
import { SharedMusicCoordinator } from "../shared-music-coordinator";

export function registerSharedMusicIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  coordinator: SharedMusicCoordinator;
  focusOwner: (clientId: number) => void;
}>): void {
  input.ipcMain.handle(SHARED_MUSIC_ATTACH_CHANNEL, (event) => {
    input.authorizeSender(event);
    const clientId = event.sender.id;
    event.sender.once("destroyed", () => input.coordinator.detach(clientId));
    return input.coordinator.attach(event.sender.id, (message) => {
      if (!event.sender.isDestroyed()) event.sender.send(SHARED_MUSIC_MESSAGE_CHANNEL, message);
    });
  });
  input.ipcMain.handle(SHARED_MUSIC_DETACH_CHANNEL, (event) => {
    input.authorizeSender(event);
    input.coordinator.detach(event.sender.id);
  });
  input.ipcMain.handle(SHARED_MUSIC_COMMAND_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    const command = parseSharedMusicCommand(value);
    const owner = input.coordinator.snapshot.ownerId;
    if (command.type === "video" && owner !== null) input.focusOwner(owner);
    input.coordinator.command(event.sender.id, command);
  });
  input.ipcMain.handle(SHARED_MUSIC_PUBLISH_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    if (typeof value !== "object" || value === null || !("epoch" in value) || !("state" in value) || !Number.isSafeInteger(value.epoch)) throw new Error("Invalid playback publication");
    input.coordinator.publish(event.sender.id, value.epoch as number, parseSharedMusicState(value.state));
  });
}
