import type { ManuscriptTextStatistics } from "./manuscript-text-statistics";

type StoreListener = () => void;

const emptyStatistics = Object.freeze({
  characterCount: 0,
  characterCountWithoutWhitespace: 0,
});

function statisticsEqual(
  left: ManuscriptTextStatistics,
  right: ManuscriptTextStatistics,
): boolean {
  return (
    left.characterCount === right.characterCount &&
    left.characterCountWithoutWhitespace ===
      right.characterCountWithoutWhitespace
  );
}

export class ManuscriptTelemetryStore {
  #statistics: ManuscriptTextStatistics = emptyStatistics;
  #hasSelection = false;
  readonly #statisticsListeners = new Set<StoreListener>();
  readonly #selectionListeners = new Set<StoreListener>();
  #statisticsNotificationQueued = false;

  readonly getStatisticsSnapshot = (): ManuscriptTextStatistics =>
    this.#statistics;

  readonly getSelectionSnapshot = (): boolean => this.#hasSelection;

  readonly subscribeStatistics = (
    listener: StoreListener,
  ): (() => void) => {
    this.#statisticsListeners.add(listener);
    return () => {
      this.#statisticsListeners.delete(listener);
    };
  };

  readonly subscribeSelection = (
    listener: StoreListener,
  ): (() => void) => {
    this.#selectionListeners.add(listener);
    return () => {
      this.#selectionListeners.delete(listener);
    };
  };

  #scheduleStatisticsNotification(): void {
    if (this.#statisticsNotificationQueued) {
      return;
    }
    this.#statisticsNotificationQueued = true;
    queueMicrotask(() => {
      this.#statisticsNotificationQueued = false;
      for (const listener of this.#statisticsListeners) {
        listener();
      }
    });
  }

  publish(
    statistics: ManuscriptTextStatistics,
    hasSelection: boolean,
  ): void {
    if (!statisticsEqual(this.#statistics, statistics)) {
      this.#statistics = Object.freeze({ ...statistics });
      this.#scheduleStatisticsNotification();
    }
    if (this.#hasSelection !== hasSelection) {
      this.#hasSelection = hasSelection;
      for (const listener of this.#selectionListeners) {
        listener();
      }
    }
  }
}
