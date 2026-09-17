import type { IpcMain, IpcMainInvokeEvent } from "electron";

import { MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL } from "../../application/contracts/studio-bridge";
import type { LegacyLoreImportRehearsalActionResult } from "../../application/migration/legacy-lore-import-contract";

export function registerMigrationIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runLegacyLoreRehearsal: () => Promise<LegacyLoreImportRehearsalActionResult>;
}>): void {
  input.ipcMain.handle(MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.runLegacyLoreRehearsal();
  });
}
