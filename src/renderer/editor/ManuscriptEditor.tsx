import { history, historyKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useEffectEvent, useRef } from "react";

import type { ManuscriptInputProfile } from "../../application/editor/manuscript-input-profile";
import { createManuscriptInputRules } from "./manuscript-input-rules";
import {
  extractManuscriptTransaction,
  type ManuscriptTransaction,
} from "./manuscript-transaction";

export type ManuscriptEditorProps = {
  readonly accessibleName: string;
  readonly initialText: string;
  readonly inputProfile: ManuscriptInputProfile;
  readonly onTransaction: (transaction: ManuscriptTransaction) => void;
};

export function ManuscriptEditor({
  accessibleName,
  initialText,
  inputProfile,
  onTransaction,
}: ManuscriptEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const notifyTransaction = useEffectEvent(onTransaction);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        history(),
        keymap.of(historyKeymap),
        EditorView.lineWrapping,
        createManuscriptInputRules(inputProfile),
        EditorView.contentAttributes.of({
          "aria-label": accessibleName,
          "aria-multiline": "true",
        }),
        EditorView.updateListener.of((update) => {
          for (const transaction of update.transactions) {
            if (
              !transaction.changes.empty ||
              transaction.selection !== undefined
            ) {
              notifyTransaction(extractManuscriptTransaction(transaction));
            }
          }
        }),
      ],
    });
    const view = new EditorView({
      parent: host,
      state,
    });

    return () => {
      view.destroy();
    };
  }, [accessibleName, initialText, inputProfile]);

  return <div className="manuscript-editor" ref={hostRef} />;
}
