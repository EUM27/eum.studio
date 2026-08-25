import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import { entityId } from "../../../domain/writing";
import {
  persistDocumentRegularly,
  SerialPersistenceLane,
  type RegularPersistenceQueuePort,
} from "./PersistenceCoordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const document = Object.freeze({
  workId: entityId<"Work">("work-regular-persistence"),
  documentId: entityId<"Document">("document-regular-persistence"),
  documentRevisionId: entityId<"DocumentRevision">(
    "revision-regular-persistence",
  ),
  label: "회차",
  initialText: "원고",
}) satisfies ManuscriptDocumentSource;

describe("regular document persistence", () => {
  it("keeps the null-queue await boundary before capturing the exact document", async () => {
    const captureResume = vi.fn(async () => undefined);
    const execution = persistDocumentRegularly({
      queue: null,
      document,
      captureResume,
    });
    expect(captureResume).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(captureResume).toHaveBeenCalledOnce();
    expect(captureResume).toHaveBeenCalledWith(document);
    await expect(execution).resolves.toBeUndefined();
  });

  it("waits for one exact flush before one exact capture", async () => {
    const flushGate = deferred<void>();
    const order: string[] = [];
    const flush = vi.fn((documentId: typeof document.documentId) => {
      expect(documentId).toBe(document.documentId);
      order.push("flush:start");
      return flushGate.promise.then(() => {
        order.push("flush:end");
      });
    });
    const captureResume = vi.fn(async (captured: ManuscriptDocumentSource) => {
      expect(captured).toBe(document);
      order.push("capture");
    });
    const queue: RegularPersistenceQueuePort = { flush };
    const execution = persistDocumentRegularly({
      queue,
      document,
      captureResume,
    });
    expect(flush).toHaveBeenCalledOnce();
    expect(captureResume).not.toHaveBeenCalled();
    flushGate.resolve();
    await expect(execution).resolves.toBeUndefined();
    expect(order).toEqual(["flush:start", "flush:end", "capture"]);
    expect(captureResume).toHaveBeenCalledOnce();
  });

  it("propagates the raw flush failure and short-circuits capture without retry", async () => {
    const failure = new Error("flush failed");
    const flush = vi.fn(() => Promise.reject(failure));
    const captureResume = vi.fn(async () => undefined);
    await expect(persistDocumentRegularly({
      queue: { flush },
      document,
      captureResume,
    })).rejects.toBe(failure);
    expect(flush).toHaveBeenCalledOnce();
    expect(captureResume).not.toHaveBeenCalled();
  });

  it("propagates the raw capture failure after exactly one successful flush", async () => {
    const failure = new Error("capture failed");
    const flush = vi.fn(async () => undefined);
    const captureResume = vi.fn(() => Promise.reject(failure));
    await expect(persistDocumentRegularly({
      queue: { flush },
      document,
      captureResume,
    })).rejects.toBe(failure);
    expect(flush).toHaveBeenCalledOnce();
    expect(captureResume).toHaveBeenCalledOnce();
    expect(captureResume).toHaveBeenCalledWith(document);
  });
});

describe("SerialPersistenceLane", () => {
  it("starts with a resolved pending wait and starts enqueued work only in a microtask", async () => {
    const lane = new SerialPersistenceLane();
    const initialPending = lane.waitForPending();
    const initialSettled = lane.waitForSettled();
    expect(initialPending).not.toBe(initialSettled);
    await expect(initialPending).resolves.toBeUndefined();
    await expect(initialSettled).resolves.toBeUndefined();
    let started = false;
    const execution = lane.enqueue(async () => {
      started = true;
    });
    expect(started).toBe(false);
    expect(lane.waitForPending()).toBe(execution);
    await Promise.resolve();
    expect(started).toBe(true);
    await expect(execution).resolves.toBeUndefined();
  });

  it("waits for the swallowed tail without changing the latest raw pending execution", async () => {
    const lane = new SerialPersistenceLane();
    const successGate = deferred<void>();
    const successfulExecution = lane.enqueue(() => successGate.promise);
    const successfulPending = lane.waitForPending();
    const successfulSettled = lane.waitForSettled();
    expect(successfulPending).toBe(successfulExecution);
    expect(lane.waitForPending()).toBe(successfulPending);
    successGate.resolve();
    await expect(successfulSettled).resolves.toBeUndefined();
    expect(lane.waitForPending()).toBe(successfulPending);

    const failure = new Error("settled tail failure");
    const failedExecution = lane.enqueue(() => Promise.reject(failure));
    const failedPending = lane.waitForPending();
    const failedSettled = lane.waitForSettled();
    expect(failedPending).toBe(failedExecution);
    expect(lane.waitForPending()).toBe(failedPending);
    await expect(failedExecution).rejects.toBe(failure);
    await expect(failedSettled).resolves.toBeUndefined();
    expect(lane.waitForPending()).toBe(failedPending);
  });

  it("runs tasks once without overlap and preserves enqueue order", async () => {
    const lane = new SerialPersistenceLane();
    const firstGate = deferred<void>();
    const order: string[] = [];
    let running = 0;
    let peakRunning = 0;
    const first = vi.fn(async () => {
      order.push("first:start");
      running += 1;
      peakRunning = Math.max(peakRunning, running);
      await firstGate.promise;
      running -= 1;
      order.push("first:end");
    });
    const second = vi.fn(async () => {
      order.push("second:start");
      running += 1;
      peakRunning = Math.max(peakRunning, running);
      running -= 1;
      order.push("second:end");
    });
    const firstExecution = lane.enqueue(first);
    const secondExecution = lane.enqueue(second);
    expect(lane.waitForPending()).toBe(secondExecution);
    await Promise.resolve();
    expect(order).toEqual(["first:start"]);
    expect(second).not.toHaveBeenCalled();
    firstGate.resolve();
    await firstExecution;
    await secondExecution;
    expect(order).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
    expect(peakRunning).toBe(1);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("returns the raw execution failure while swallowing only the tail for later work", async () => {
    const lane = new SerialPersistenceLane();
    const failure = new Error("raw persistence failure");
    const failedTask = vi.fn(() => Promise.reject(failure));
    const laterTask = vi.fn(async () => undefined);
    const failedExecution = lane.enqueue(failedTask);
    expect(lane.waitForPending()).toBe(failedExecution);
    await expect(failedExecution).rejects.toBe(failure);
    const laterExecution = lane.enqueue(laterTask);
    expect(lane.waitForPending()).toBe(laterExecution);
    await expect(laterExecution).resolves.toBeUndefined();
    expect(failedTask).toHaveBeenCalledOnce();
    expect(laterTask).toHaveBeenCalledOnce();
  });

  it("keeps serialization generic while persistence, reading, close, and editor slices own orchestration", () => {
    const laneSource = readFileSync(
      new URL("./PersistenceCoordinator.ts", import.meta.url),
      "utf8",
    );
    const appSource = readFileSync(
      new URL("../../App.tsx", import.meta.url),
      "utf8",
    );
    const persistenceHookSource = readFileSync(
      new URL("./usePersistenceCoordinator.ts", import.meta.url),
      "utf8",
    );
    const readingSource = readFileSync(
      new URL("./useReadingLayoutController.ts", import.meta.url),
      "utf8",
    );
    const closeSource = readFileSync(
      new URL("./useWorkspaceCloseController.ts", import.meta.url),
      "utf8",
    );
    const runtimeProjectionSource = readFileSync(
      new URL("./useWorkspaceRuntimeProjectionController.ts", import.meta.url),
      "utf8",
    );
    const dialogHostSource = readFileSync(
      new URL("../dialogs/WorkspaceDialogHost.tsx", import.meta.url),
      "utf8",
    );

    expect(persistenceHookSource).not.toContain(
      "continuousReadingSaveChainRef",
    );
    expect(persistenceHookSource).not.toContain(
      "continuousReadingPendingSaveRef",
    );
    expect(persistenceHookSource.match(/new SerialPersistenceLane\(\)/gu))
      .toHaveLength(2);
    expect(readingSource).toContain(
      "continuousReadingLane.enqueue(async () =>",
    );
    expect(readingSource).toContain(
      "continuousReadingLane.waitForPending()",
    );
    expect(readingSource).toContain(
      "manuscriptLayoutLane.waitForSettled()",
    );
    expect(readingSource).toContain(
      "input.client.saveContinuousReadingProgress({",
    );
    expect(closeSource).toContain(
      "input.focusModeSessionPendingRef.current",
    );
    expect(closeSource).toContain("coordinateWorkspaceCloseRequest({");
    expect(runtimeProjectionSource).toContain(
      "durableSaveQueueRef.current?.recordFormatting(",
    );
    expect(runtimeProjectionSource).toContain(
      "durableSaveQueueRef.current?.compositionEnd(",
    );
    expect(persistenceHookSource).toContain(
      "new ManuscriptDurableSaveQueue({",
    );
    expect(persistenceHookSource).toContain(
      "durableSaveQueueRef.current.registerDocument({",
    );
    expect(dialogHostSource).toContain("<ContinuousReadingDialog");
    expect(appSource.match(/persistDocumentRegularly\(/gu)).toHaveLength(1);
    expect(laneSource).not.toMatch(
      /window\.|React|useState|Work|continuousReading|durable|layout|IME|retry|fallback|debounce|coalesce|timeout|cancel/u,
    );
  });
});
