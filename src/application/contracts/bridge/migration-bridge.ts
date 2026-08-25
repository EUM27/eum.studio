import {
  parseLegacyLoreImportRehearsalActionResult,
  type LegacyLoreImportRehearsalActionResult,
} from "../../migration/legacy-lore-import-contract";

export const MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL =
  "studio:migration:run-legacy-rehearsal";

export type MigrationBridgeChannel =
  typeof MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL;

export type MigrationBridge = Readonly<{
  runLegacyLoreRehearsal: () => Promise<LegacyLoreImportRehearsalActionResult>;
}>;

export type MigrationBridgeInvoke = (
  channel: MigrationBridgeChannel,
) => Promise<unknown>;

export function createMigrationBridge(
  invoke: MigrationBridgeInvoke,
): MigrationBridge {
  return Object.freeze({
    runLegacyLoreRehearsal: async () => {
      const value = await invoke(MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL);
      try {
        return parseLegacyLoreImportRehearsalActionResult(value);
      } catch {
        throw new Error("Invalid legacy import rehearsal result");
      }
    },
  });
}
