import { randomInt } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { ManuscriptTelemetryStore } from "./manuscript-telemetry-store";

describe("ManuscriptTelemetryStore", () => {
  it("notifies character statistics and selection subscribers independently", async () => {
    const store = new ManuscriptTelemetryStore();
    const statisticsListener = vi.fn();
    const selectionListener = vi.fn();
    const unsubscribeStatistics =
      store.subscribeStatistics(statisticsListener);
    const unsubscribeSelection =
      store.subscribeSelection(selectionListener);
    const statistics = {
      characterCount: randomInt(1, 1000),
      characterCountWithoutWhitespace: randomInt(1, 1000),
    };

    store.publish(statistics, false);

    expect(store.getStatisticsSnapshot()).toEqual(statistics);
    expect(store.getSelectionSnapshot()).toBe(false);
    await Promise.resolve();
    expect(statisticsListener).toHaveBeenCalledOnce();
    expect(selectionListener).not.toHaveBeenCalled();

    store.publish(statistics, true);

    expect(statisticsListener).toHaveBeenCalledOnce();
    expect(selectionListener).toHaveBeenCalledOnce();
    expect(store.getSelectionSnapshot()).toBe(true);

    unsubscribeStatistics();
    unsubscribeSelection();
    store.publish(
      {
        characterCount: statistics.characterCount + 1,
        characterCountWithoutWhitespace:
          statistics.characterCountWithoutWhitespace + 1,
      },
      false,
    );
    await Promise.resolve();
    expect(statisticsListener).toHaveBeenCalledOnce();
    expect(selectionListener).toHaveBeenCalledOnce();
  });

  it("defers statistics subscribers beyond the editor transaction while publishing the snapshot", async () => {
    const store = new ManuscriptTelemetryStore();
    const statisticsListener = vi.fn();
    store.subscribeStatistics(statisticsListener);
    const statistics = {
      characterCount: randomInt(1, 1000),
      characterCountWithoutWhitespace: randomInt(1, 1000),
    };

    store.publish(statistics, false);

    expect(store.getStatisticsSnapshot()).toEqual(statistics);
    expect(statisticsListener).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(statisticsListener).toHaveBeenCalledOnce();
  });

  it("keeps stable frozen snapshots when values do not change", () => {
    const store = new ManuscriptTelemetryStore();
    const statistics = {
      characterCount: randomInt(1, 1000),
      characterCountWithoutWhitespace: randomInt(1, 1000),
    };

    store.publish(statistics, false);
    const firstSnapshot = store.getStatisticsSnapshot();
    store.publish({ ...statistics }, false);

    expect(store.getStatisticsSnapshot()).toBe(firstSnapshot);
    expect(Object.isFrozen(firstSnapshot)).toBe(true);
  });
});
