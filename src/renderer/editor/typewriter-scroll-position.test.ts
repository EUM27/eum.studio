import { describe, expect, it } from "vitest";

import { resolveTypewriterScrollTop } from "./typewriter-scroll-position";

describe("typewriter scroll position", () => {
  it("places the cursor center at the selected viewport percentage", () => {
    expect(resolveTypewriterScrollTop({
      currentScrollTop: 300,
      cursorBottom: 530,
      cursorTop: 510,
      maxScrollTop: 1_500,
      positionPercent: 30,
      scrollerTop: 100,
      viewportHeight: 1_000,
    })).toBe(420);
    expect(resolveTypewriterScrollTop({
      currentScrollTop: 600,
      cursorBottom: 530,
      cursorTop: 510,
      maxScrollTop: 1_500,
      positionPercent: 65,
      scrollerTop: 100,
      viewportHeight: 1_000,
    })).toBe(370);
  });

  it("clamps the requested position to the available scroll range", () => {
    expect(resolveTypewriterScrollTop({
      currentScrollTop: 0,
      cursorBottom: 40,
      cursorTop: 20,
      maxScrollTop: 800,
      positionPercent: 90,
      scrollerTop: 0,
      viewportHeight: 1_000,
    })).toBe(0);
    expect(resolveTypewriterScrollTop({
      currentScrollTop: 700,
      cursorBottom: 1_400,
      cursorTop: 1_380,
      maxScrollTop: 800,
      positionPercent: 10,
      scrollerTop: 0,
      viewportHeight: 1_000,
    })).toBe(800);
  });
});
