import type { EntityId } from "../../domain/writing";
import type { ManuscriptSaveState } from "./manuscript-durable-save-queue";

export const MANUSCRIPT_SAVE_STATE_LABELS: Readonly<
  Record<ManuscriptSaveState, string>
> = Object.freeze({
  editing: "편집 중",
  saving: "저장 중",
  saved: "저장됨",
  failed: "실패",
});

type SaveStateListener = () => void;

export class ManuscriptSaveStateStore {
  #snapshot: Readonly<Record<string, ManuscriptSaveState>> = Object.freeze({});
  readonly #listeners = new Set<SaveStateListener>();
  #notificationQueued = false;

  readonly getSnapshot = (): Readonly<Record<string, ManuscriptSaveState>> =>
    this.#snapshot;

  readonly subscribe = (listener: SaveStateListener): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  replace(states: Readonly<Record<string, ManuscriptSaveState>>): void {
    this.#snapshot = Object.freeze({ ...states });
    this.#scheduleNotification();
  }

  publish(
    documentId: EntityId<"Document">,
    state: ManuscriptSaveState,
  ): void {
    if (this.#snapshot[documentId] === state) return;
    this.#snapshot = Object.freeze({
      ...this.#snapshot,
      [documentId]: state,
    });
    this.#scheduleNotification();
  }

  #scheduleNotification(): void {
    if (this.#notificationQueued) return;
    this.#notificationQueued = true;
    queueMicrotask(() => {
      this.#notificationQueued = false;
      for (const listener of this.#listeners) listener();
    });
  }
}
