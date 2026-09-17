import { useCallback, useMemo, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { LoreCue } from "../../../application/lore/lore-cue-projection";
import type { EntityId } from "../../../domain/writing";
import type { LoreCueInteraction } from "../../editor/lore-cue-extension";

export type LoreCueState = ReturnType<typeof useLoreCueState>;

export function useLoreCueState() {
  const [hoveredLoreCue, setHoveredLoreCue] =
    useState<LoreCueInteraction | null>(null);
  const [pinnedLoreCue, setPinnedLoreCue] = useState<LoreCue | null>(null);
  const [loreCueActionError, setLoreCueActionError] = useState<string | null>(
    null,
  );

  const resetLoreCue = useCallback(() => {
    setHoveredLoreCue(null);
    setPinnedLoreCue(null);
    setLoreCueActionError(null);
  }, []);

  return useMemo(() => ({
    hoveredLoreCue,
    setHoveredLoreCue,
    pinnedLoreCue,
    setPinnedLoreCue,
    loreCueActionError,
    setLoreCueActionError,
    resetLoreCue,
  }), [hoveredLoreCue, loreCueActionError, pinnedLoreCue, resetLoreCue]);
}

export function useLoreCueController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  captureResume: (document: ManuscriptDocumentSource) => Promise<unknown>;
  editor: Readonly<{
    selectDocumentRange: (
      document: ManuscriptDocumentSource,
      range: Readonly<{ from: number; to: number }>,
    ) => boolean;
  }>;
  openInspectorRail: (workId: EntityId<"Work">) => void;
  state: LoreCueState;
}>) {
  const handleLoreCueHover = useCallback((
    interaction: LoreCueInteraction | null,
  ) => {
    if (
      interaction !== null &&
      (input.activeDocument === null ||
        interaction.cue.workId !== input.activeDocument.workId ||
        interaction.cue.documentId !== input.activeDocument.documentId)
    ) return;
    input.state.setHoveredLoreCue(interaction);
  }, [input]);

  const openLoreCueInspector = useCallback((cue: LoreCue) => {
    if (
      input.activeDocument === null ||
      cue.workId !== input.activeDocument.workId ||
      cue.documentId !== input.activeDocument.documentId
    ) return;
    input.state.setHoveredLoreCue(null);
    input.state.setPinnedLoreCue(cue);
    input.state.setLoreCueActionError(null);
    input.openInspectorRail(cue.workId);
  }, [input]);

  const selectLoreCueOccurrence = useCallback((
    occurrence: LoreCue["occurrences"][number],
  ) => {
    if (
      input.activeDocument === null ||
      input.state.pinnedLoreCue === null ||
      input.state.pinnedLoreCue.workId !== input.activeDocument.workId ||
      input.state.pinnedLoreCue.documentId !== input.activeDocument.documentId
    ) {
      input.state.setLoreCueActionError(
        "현재 원고에서 별빛 위치를 열 수 없습니다.",
      );
      return;
    }
    const selected = input.editor.selectDocumentRange(
      input.activeDocument,
      { from: occurrence.from, to: occurrence.to },
    );
    if (!selected) {
      input.state.setLoreCueActionError(
        "별빛의 정확한 원고 범위를 선택하지 못했습니다.",
      );
      return;
    }
    input.state.setLoreCueActionError(null);
    void input.captureResume(input.activeDocument).catch(() => undefined);
  }, [input]);

  const closeLoreCueInspector = useCallback(() => {
    input.state.setPinnedLoreCue(null);
    input.state.setLoreCueActionError(null);
  }, [input.state]);

  return {
    handleLoreCueHover,
    openLoreCueInspector,
    selectLoreCueOccurrence,
    closeLoreCueInspector,
  };
}
