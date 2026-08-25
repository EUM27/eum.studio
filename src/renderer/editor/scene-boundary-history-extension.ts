import { invertedEffects } from "@codemirror/commands";
import { StateEffect, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { EntityId } from "../../domain/writing";

export type SceneBoundaryHistoryEntry = Readonly<{
  historyId: string;
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  selection: Readonly<{
    anchor: number;
    head: number;
  }>;
  exactQuote: string;
}>;

export const recordSceneBoundaryHistoryEffect =
  StateEffect.define<SceneBoundaryHistoryEntry>();

const applySceneBoundaryHistoryEffect = StateEffect.define<Readonly<{
  entry: SceneBoundaryHistoryEntry;
  active: boolean;
}>>();

const sceneBoundaryHistory = invertedEffects.of((transaction) => {
  const inverse = [];
  for (const effect of transaction.effects) {
    if (effect.is(recordSceneBoundaryHistoryEffect)) {
      inverse.push(applySceneBoundaryHistoryEffect.of({
        entry: effect.value,
        active: false,
      }));
    } else if (effect.is(applySceneBoundaryHistoryEffect)) {
      inverse.push(applySceneBoundaryHistoryEffect.of({
        entry: effect.value.entry,
        active: !effect.value.active,
      }));
    }
  }
  return inverse;
});

export function createSceneBoundaryHistoryExtension(
  onToggle: (entry: SceneBoundaryHistoryEntry, active: boolean) => void,
): Extension {
  return [
    sceneBoundaryHistory,
    EditorView.updateListener.of((update) => {
      for (const transaction of update.transactions) {
        for (const effect of transaction.effects) {
          if (effect.is(applySceneBoundaryHistoryEffect)) {
            onToggle(effect.value.entry, effect.value.active);
          }
        }
      }
    }),
  ];
}
