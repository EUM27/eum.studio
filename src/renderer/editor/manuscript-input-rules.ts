import { Transaction, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { ManuscriptInputProfile } from "../../application/editor/manuscript-input-profile";

export type ManuscriptTypingInput = {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly userEvent: string;
  readonly isComposing: boolean;
  readonly readText: (from: number, to: number) => string;
};

export type ManuscriptTypingEdit = {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
  readonly anchor: number;
  readonly head: number;
};

function getReplacementEdit(
  profile: ManuscriptInputProfile,
  input: ManuscriptTypingInput,
): ManuscriptTypingEdit | null {
  let matchingRule: ManuscriptInputProfile["textReplacements"][number] | null =
    null;

  for (const rule of profile.textReplacements) {
    if (!rule.trigger.endsWith(input.text)) {
      continue;
    }
    const precedingTrigger = rule.trigger.slice(
      0,
      rule.trigger.length - input.text.length,
    );
    const changeFrom = input.from - precedingTrigger.length;
    if (
      changeFrom < 0 ||
      input.readText(changeFrom, input.from) !== precedingTrigger
    ) {
      continue;
    }
    if (
      matchingRule === null ||
      rule.trigger.length > matchingRule.trigger.length
    ) {
      matchingRule = rule;
    }
  }

  if (matchingRule === null) {
    return null;
  }

  const precedingLength = matchingRule.trigger.length - input.text.length;
  const from = input.from - precedingLength;
  const cursor = from + matchingRule.replacement.length;
  return {
    from,
    to: input.to,
    insert: matchingRule.replacement,
    anchor: cursor,
    head: cursor,
  };
}

function getEvolutionEdit(
  profile: ManuscriptInputProfile,
  input: ManuscriptTypingInput,
): ManuscriptTypingEdit | null {
  for (const cycle of profile.evolutionCycles ?? []) {
    if (!cycle.trigger.endsWith(input.text)) continue;
    for (let index = 0; index < cycle.pairs.length; index += 1) {
      const pair = cycle.pairs[index]!;
      const pairFrom = input.from - pair.open.length;
      if (
        pairFrom < 0 ||
        input.readText(pairFrom, input.from) !== pair.open ||
        input.readText(input.from, input.from + pair.close.length) !== pair.close
      ) {
        continue;
      }
      const next = cycle.pairs[(index + 1) % cycle.pairs.length]!;
      const cursor = pairFrom + next.open.length;
      return {
        from: pairFrom,
        to: input.from + pair.close.length,
        insert: `${next.open}${next.close}`,
        anchor: cursor,
        head: cursor,
      };
    }

    const typedPrefix = cycle.trigger.slice(
      0,
      cycle.trigger.length - input.text.length,
    );
    const from = input.from - typedPrefix.length;
    if (from < 0 || input.readText(from, input.from) !== typedPrefix) {
      continue;
    }
    const first = cycle.pairs[0]!;
    const cursor = from + first.open.length;
    return {
      from,
      to: input.to,
      insert: `${first.open}${first.close}`,
      anchor: cursor,
      head: cursor,
    };
  }
  return null;
}

export function getManuscriptTypingEdit(
  profile: ManuscriptInputProfile,
  input: ManuscriptTypingInput,
): ManuscriptTypingEdit | null {
  if (
    input.isComposing ||
    input.userEvent !== "input.type" ||
    !Number.isInteger(input.from) ||
    !Number.isInteger(input.to) ||
    input.from < 0 ||
    input.to !== input.from ||
    input.text.length === 0
  ) {
    return null;
  }

  const evolutionEdit = getEvolutionEdit(profile, input);
  if (evolutionEdit !== null) {
    return evolutionEdit;
  }

  const replacementEdit = getReplacementEdit(profile, input);
  if (replacementEdit !== null) {
    return replacementEdit;
  }

  let matchingCloser:
    | {
        readonly close: string;
        readonly from: number;
      }
    | undefined;
  for (const pair of profile.autoClosePairs) {
    const closingTrigger = pair.trigger ?? pair.close;
    if (!closingTrigger.endsWith(input.text)) {
      continue;
    }
    const typedPrefix = closingTrigger.slice(
      0,
      closingTrigger.length - input.text.length,
    );
    const changeFrom = input.from - typedPrefix.length;
    if (
      changeFrom < 0 ||
      input.readText(changeFrom, input.from) !== typedPrefix ||
      input.readText(input.from, input.from + pair.close.length) !== pair.close
    ) {
      continue;
    }
    if (
      matchingCloser === undefined ||
      pair.close.length > matchingCloser.close.length
    ) {
      matchingCloser = {
        close: pair.close,
        from: changeFrom,
      };
    }
  }
  if (matchingCloser !== undefined) {
    const cursor = matchingCloser.from + matchingCloser.close.length;
    return {
      from: matchingCloser.from,
      to: input.to,
      insert: "",
      anchor: cursor,
      head: cursor,
    };
  }

  let matchingPair:
    | {
        readonly open: string;
        readonly close: string;
        readonly from: number;
      }
    | undefined;
  for (const pair of profile.autoClosePairs) {
    const openingTrigger = pair.trigger ?? pair.open;
    if (!openingTrigger.endsWith(input.text)) {
      continue;
    }
    const typedPrefix = openingTrigger.slice(
      0,
      openingTrigger.length - input.text.length,
    );
    const changeFrom = input.from - typedPrefix.length;
    if (
      changeFrom < 0 ||
      input.readText(changeFrom, input.from) !== typedPrefix
    ) {
      continue;
    }
    if (
      matchingPair === undefined ||
      pair.open.length > matchingPair.open.length
    ) {
      matchingPair = {
        open: pair.open,
        close: pair.close,
        from: changeFrom,
      };
    }
  }
  if (matchingPair === undefined) {
    return null;
  }

  const cursor = matchingPair.from + matchingPair.open.length;
  return {
    from: matchingPair.from,
    to: input.to,
    insert: `${matchingPair.open}${matchingPair.close}`,
    anchor: cursor,
    head: cursor,
  };
}

export function createManuscriptInputRules(
  profile: ManuscriptInputProfile,
): Extension {
  return EditorView.inputHandler.of((view, from, to, text, insert) => {
    if (view.state.selection.ranges.length !== 1) {
      return false;
    }

    const defaultTransaction = insert();
    const userEvent =
      defaultTransaction.annotation(Transaction.userEvent) ?? "";
    const edit = getManuscriptTypingEdit(profile, {
      from,
      to,
      text,
      userEvent,
      isComposing: view.composing || view.compositionStarted,
      readText: (readFrom, readTo) =>
        view.state.sliceDoc(readFrom, readTo),
    });
    if (edit === null) {
      return false;
    }

    view.dispatch({
      changes: {
        from: edit.from,
        to: edit.to,
        insert: edit.insert,
      },
      selection: {
        anchor: edit.anchor,
        head: edit.head,
      },
      annotations: Transaction.userEvent.of(userEvent),
      scrollIntoView: true,
    });
    return true;
  });
}
