import { useCallback, useEffect, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { WorkInspirationSettingsProjection } from "../../../application/inspiration/work-inspiration-settings";
import type { EntityId } from "../../../domain/writing";

export function useInspirationController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: Pick<
    StudioBridge["settings"],
    "getWorkInspiration" | "saveWorkInspiration"
  >;
}>) {
  const [workInspirationSettings, setWorkInspirationSettings] =
    useState<WorkInspirationSettingsProjection | null>(null);
  const [inspirationActionState, setInspirationActionState] =
    useState<"idle" | "saving">("idle");
  const [inspirationActionError, setInspirationActionError] =
    useState<string | null>(null);

  useEffect(() => {
    if (input.activeWorkId === null) {
      const reset = window.setTimeout(() => {
        setWorkInspirationSettings(null);
        setInspirationActionError(null);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    let disposed = false;
    void input.client.getWorkInspiration({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setWorkInspirationSettings(projection);
          setInspirationActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setWorkInspirationSettings(null);
          setInspirationActionError("뽑기 키워드를 불러오지 못했습니다.");
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [input.activeWorkId, input.client]);

  const saveWorkInspirationSettings = useCallback(async (
    settings: WorkInspirationSettingsProjection["settings"],
  ) => {
    const current = workInspirationSettings;
    if (
      input.activeWorkId === null ||
      current === null ||
      current.workId !== input.activeWorkId ||
      inspirationActionState !== "idle"
    ) return null;
    setInspirationActionState("saving");
    setInspirationActionError(null);
    try {
      const saved = await input.client.saveWorkInspiration({
        schemaVersion: 1,
        workId: input.activeWorkId,
        expectedRevision: current.revision,
        settings,
      });
      setWorkInspirationSettings((latest) =>
        latest?.workId === saved.workId ? saved : latest
      );
      return saved;
    } catch {
      setInspirationActionError("뽑기 키워드를 저장하지 못했습니다.");
      return null;
    } finally {
      setInspirationActionState("idle");
    }
  }, [
    input.activeWorkId,
    input.client,
    inspirationActionState,
    workInspirationSettings,
  ]);

  const addCharacterInspirationKeywords = useCallback((
    keywords: readonly string[],
  ) => {
    const current = workInspirationSettings;
    if (current === null) return;
    const characterKeywords = Object.freeze([
      ...new Set([...current.settings.characterKeywords, ...keywords]),
    ]);
    void saveWorkInspirationSettings(Object.freeze({
      ...current.settings,
      characterKeywords,
    }));
  }, [saveWorkInspirationSettings, workInspirationSettings]);

  const deleteCharacterInspirationKeyword = useCallback((keyword: string) => {
    const current = workInspirationSettings;
    if (current === null) return;
    void saveWorkInspirationSettings(Object.freeze({
      ...current.settings,
      characterKeywords: Object.freeze(
        current.settings.characterKeywords.filter((entry) => entry !== keyword),
      ),
    }));
  }, [saveWorkInspirationSettings, workInspirationSettings]);

  const addEventInspirationKeywords = useCallback((
    keywords: readonly string[],
  ) => {
    const current = workInspirationSettings;
    if (current === null) return;
    const eventKeywords = Object.freeze([
      ...new Set([...current.settings.eventKeywords, ...keywords]),
    ]);
    void saveWorkInspirationSettings(Object.freeze({
      ...current.settings,
      eventKeywords,
    }));
  }, [saveWorkInspirationSettings, workInspirationSettings]);

  const deleteEventInspirationKeyword = useCallback((keyword: string) => {
    const current = workInspirationSettings;
    if (current === null) return;
    void saveWorkInspirationSettings(Object.freeze({
      ...current.settings,
      eventKeywords: Object.freeze(
        current.settings.eventKeywords.filter((entry) => entry !== keyword),
      ),
    }));
  }, [saveWorkInspirationSettings, workInspirationSettings]);

  return {
    workInspirationSettings,
    inspirationActionState,
    inspirationActionError,
    addCharacterInspirationKeywords,
    deleteCharacterInspirationKeyword,
    addEventInspirationKeywords,
    deleteEventInspirationKeyword,
  };
}
