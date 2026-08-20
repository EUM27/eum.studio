import { StateEffect, StateField, type Extension, type Text } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";

export type ManuscriptSceneBoundaryPreview = {
  readonly boundaryId: string;
  readonly offset: number;
  readonly beforeTitle: string;
  readonly afterTitle: string;
};

export const setSceneBoundaryPreviewsEffect =
  StateEffect.define<readonly ManuscriptSceneBoundaryPreview[]>();

class SceneBoundaryPreviewWidget extends WidgetType {
  constructor(readonly preview: ManuscriptSceneBoundaryPreview) {
    super();
  }

  override eq(other: SceneBoundaryPreviewWidget): boolean {
    return (
      other.preview.boundaryId === this.preview.boundaryId &&
      other.preview.offset === this.preview.offset &&
      other.preview.beforeTitle === this.preview.beforeTitle &&
      other.preview.afterTitle === this.preview.afterTitle
    );
  }

  override toDOM(): HTMLElement {
    const boundary = document.createElement("div");
    boundary.className = "cm-scene-boundary-preview";
    boundary.contentEditable = "false";
    boundary.dataset.boundaryId = this.preview.boundaryId;
    boundary.dataset.loreExclude = "true";
    boundary.setAttribute(
      "aria-label",
      `장면 경계 미리보기: ${this.preview.beforeTitle}에서 ${this.preview.afterTitle}`,
    );

    const before = document.createElement("span");
    before.className = "cm-scene-boundary-preview-line";
    const label = document.createElement("strong");
    label.textContent = `${this.preview.beforeTitle} → ${this.preview.afterTitle}`;
    const after = document.createElement("span");
    after.className = "cm-scene-boundary-preview-line";
    boundary.append(before, label, after);
    return boundary;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

export function normalizeSceneBoundaryPreviews(
  previews: readonly ManuscriptSceneBoundaryPreview[],
  document: Text,
): readonly ManuscriptSceneBoundaryPreview[] {
  const byIdentity = new Map<string, ManuscriptSceneBoundaryPreview>();
  for (const preview of previews) {
    if (
      !Number.isSafeInteger(preview.offset) ||
      preview.offset < 0 ||
      preview.offset > document.length ||
      preview.boundaryId.length === 0 ||
      preview.beforeTitle.length === 0 ||
      preview.afterTitle.length === 0
    ) {
      continue;
    }
    byIdentity.set(preview.boundaryId, Object.freeze({ ...preview }));
  }
  return Object.freeze(
    [...byIdentity.values()].sort((first, second) =>
      first.offset - second.offset ||
      first.boundaryId.localeCompare(second.boundaryId)
    ),
  );
}

function buildDecorations(
  previews: readonly ManuscriptSceneBoundaryPreview[],
): DecorationSet {
  return Decoration.set(
    previews.map((preview) => Decoration.widget({
      block: true,
      side: -1,
      widget: new SceneBoundaryPreviewWidget(preview),
    }).range(preview.offset)),
    true,
  );
}

export function createSceneBoundaryPreviewExtension(
  initialPreviews: readonly ManuscriptSceneBoundaryPreview[],
): Extension {
  return StateField.define<{
    readonly previews: readonly ManuscriptSceneBoundaryPreview[];
    readonly decorations: DecorationSet;
  }>({
    create(state) {
      const previews = normalizeSceneBoundaryPreviews(initialPreviews, state.doc);
      return Object.freeze({ previews, decorations: buildDecorations(previews) });
    },
    update(current, transaction) {
      const effect = transaction.effects.find((candidate) =>
        candidate.is(setSceneBoundaryPreviewsEffect),
      );
      if (effect === undefined && !transaction.docChanged) return current;
      const previews = transaction.docChanged && effect === undefined
        ? Object.freeze([])
        : normalizeSceneBoundaryPreviews(
            effect?.value ?? current.previews,
            transaction.newDoc,
          );
      return Object.freeze({ previews, decorations: buildDecorations(previews) });
    },
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });
}
