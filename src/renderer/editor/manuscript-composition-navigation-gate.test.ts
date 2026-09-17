import { describe, expect, it, vi } from "vitest";

import {
  ManuscriptCompositionNavigationGate,
} from "./manuscript-composition-navigation-gate";

const identity = Object.freeze({
  workId: "work-navigation-composition",
  documentId: "document-navigation-composition",
});

describe("ManuscriptCompositionNavigationGate", () => {
  it("does not wait or blur when composition is already settled", async () => {
    const blur = vi.fn();
    const afterPaint = vi.fn();
    const onFallbackEnd = vi.fn();
    const gate = new ManuscriptCompositionNavigationGate();

    await expect(gate.waitForEnd(identity, {
      isComposing: () => false,
      blur,
      afterPaint,
      onFallbackEnd,
    })).resolves.toBeUndefined();
    expect(blur).not.toHaveBeenCalled();
    expect(afterPaint).not.toHaveBeenCalled();
    expect(onFallbackEnd).not.toHaveBeenCalled();
  });

  it("commits composition by blurring and resolves on the matching event", async () => {
    const afterPaintCallbacks: Array<() => void> = [];
    const gate = new ManuscriptCompositionNavigationGate();
    const wait = gate.waitForEnd(identity, {
      isComposing: () => true,
      blur: vi.fn(),
      afterPaint: (callback) => {
        afterPaintCallbacks.push(callback);
      },
      onFallbackEnd: vi.fn(),
    });

    expect(gate.resolve(identity)).toBe(true);
    await expect(wait).resolves.toBeUndefined();
    afterPaintCallbacks[0]!();
  });

  it("settles after paint when composition ended without an event", async () => {
    let composing = true;
    const afterPaintCallbacks: Array<() => void> = [];
    const onFallbackEnd = vi.fn();
    const gate = new ManuscriptCompositionNavigationGate();
    const wait = gate.waitForEnd(identity, {
      isComposing: () => composing,
      blur: () => {
        composing = false;
      },
      afterPaint: (callback) => {
        afterPaintCallbacks.push(callback);
      },
      onFallbackEnd,
    });

    afterPaintCallbacks[0]!();
    await expect(wait).resolves.toBeUndefined();
    expect(onFallbackEnd).toHaveBeenCalledOnce();
  });

  it("rejects instead of waiting forever when composition remains stuck", async () => {
    const afterPaintCallbacks: Array<() => void> = [];
    const gate = new ManuscriptCompositionNavigationGate();
    const wait = gate.waitForEnd(identity, {
      isComposing: () => true,
      blur: vi.fn(),
      afterPaint: (callback) => {
        afterPaintCallbacks.push(callback);
      },
      onFallbackEnd: vi.fn(),
    });

    afterPaintCallbacks[0]!();
    await expect(wait).rejects.toThrow(
      "IME composition did not end for document-navigation-composition",
    );
    expect(gate.resolve(identity)).toBe(false);
  });
});
