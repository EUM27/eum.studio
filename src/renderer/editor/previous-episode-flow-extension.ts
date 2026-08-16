import { StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";

import type { PreviousEpisodeFlowPreview } from "../../application/editor/previous-episode-flow";

export const setPreviousEpisodeFlowPreviewEffect =
  StateEffect.define<PreviousEpisodeFlowPreview | null>();

class PreviousEpisodeFlowWidget extends WidgetType {
  constructor(private readonly preview: PreviousEpisodeFlowPreview) {
    super();
  }

  override eq(other: PreviousEpisodeFlowWidget): boolean {
    return (
      other.preview.sourceDocumentId === this.preview.sourceDocumentId &&
      other.preview.title === this.preview.title &&
      other.preview.text === this.preview.text
    );
  }

  override toDOM(): HTMLElement {
    const section = document.createElement("section");
    section.className = "previous-flow-context";
    section.setAttribute("aria-label", "이전 화 흐름");
    section.setAttribute("data-lore-exclude", "true");
    section.dataset.sourceDocumentId = this.preview.sourceDocumentId;
    section.contentEditable = "false";

    const header = document.createElement("div");
    header.className = "previous-flow-context-head";
    const label = document.createElement("span");
    label.textContent = "이전 화 흐름";
    const title = document.createElement("strong");
    title.textContent = this.preview.title;
    header.append(label, title);

    const body = document.createElement("div");
    body.className = "previous-flow-context-body";
    for (const paragraph of this.preview.text.split(/\n{2,}/u)) {
      const text = paragraph.trim();
      if (text.length === 0) {
        continue;
      }
      const line = document.createElement("p");
      line.className = "previous-flow-context-line cm-line";
      line.textContent = text;
      body.append(line);
    }

    section.append(header, body);
    return section;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function buildDecorations(
  preview: PreviousEpisodeFlowPreview | null,
): DecorationSet {
  if (preview === null || preview.text.trim().length === 0) {
    return Decoration.none;
  }
  return Decoration.set([
    Decoration.widget({
      block: true,
      side: -1,
      widget: new PreviousEpisodeFlowWidget(preview),
    }).range(0),
  ]);
}

export function createPreviousEpisodeFlowExtension(
  initialPreview: PreviousEpisodeFlowPreview | null,
): Extension {
  return StateField.define<{
    readonly preview: PreviousEpisodeFlowPreview | null;
    readonly decorations: DecorationSet;
  }>({
    create() {
      return {
        preview: initialPreview,
        decorations: buildDecorations(initialPreview),
      };
    },
    update(current, transaction) {
      const effect = transaction.effects.find((candidate) =>
        candidate.is(setPreviousEpisodeFlowPreviewEffect),
      );
      const preview = effect === undefined ? current.preview : effect.value;
      if (effect === undefined && !transaction.docChanged) {
        return current;
      }
      return {
        preview,
        decorations: buildDecorations(preview),
      };
    },
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });
}
