import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_UI_PREFERENCES,
  parseSaveUiPreferencesCommand,
  parseUiPreferencesProjection,
  type SaveUiPreferencesCommand,
  type UiPreferencesProjection,
} from "../../application/settings/ui-preferences";

export type UiPreferencesStore = Readonly<{
  get(): Promise<UiPreferencesProjection>;
  save(value: SaveUiPreferencesCommand): Promise<UiPreferencesProjection>;
}>;

export async function openNodeUiPreferencesStore(input: {
  readonly rootDirectoryPath: string;
}): Promise<UiPreferencesStore> {
  if (!path.isAbsolute(input.rootDirectoryPath)) {
    throw new Error("UI preferences rootDirectoryPath must be absolute");
  }
  await mkdir(input.rootDirectoryPath, { recursive: true });
  const filePath = path.join(input.rootDirectoryPath, "preferences.json");

  async function writeProjection(
    projection: UiPreferencesProjection,
  ): Promise<void> {
    const temporaryPath = path.join(
      input.rootDirectoryPath,
      `preferences-${randomUUID()}.tmp`,
    );
    await writeFile(temporaryPath, `${JSON.stringify(projection)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  }

  async function readCurrent(): Promise<UiPreferencesProjection> {
    try {
      return parseUiPreferencesProjection(
        JSON.parse(await readFile(filePath, "utf8")),
      );
    } catch (reason) {
      if (
        typeof reason === "object" &&
        reason !== null &&
        "code" in reason &&
        reason.code === "ENOENT"
      ) {
        return DEFAULT_UI_PREFERENCES;
      }
      throw reason;
    }
  }

  return Object.freeze({
    get: readCurrent,
    async save(value) {
      const command = parseSaveUiPreferencesCommand(value);
      const current = await readCurrent();
      if (current.revision !== command.expectedRevision) {
        throw new Error(
          `UI preferences revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
        );
      }
      const saved = parseUiPreferencesProjection({
        schemaVersion: 2,
        revision: current.revision + 1,
        themeKey: command.themeKey,
        manuscriptFocus: command.manuscriptFocus,
      });
      await writeProjection(saved);
      return readCurrent();
    },
  });
}
