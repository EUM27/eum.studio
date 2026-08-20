import { describe, expect, it } from "vitest";

import { clampFloatingPanelPosition } from "./floating-panel-position";

describe("floating panel position", () => {
  it("keeps a moved panel within every viewport edge", () => {
    expect(clampFloatingPanelPosition({
      margin: 8,
      panelHeight: 120,
      panelWidth: 240,
      viewportHeight: 600,
      viewportWidth: 800,
      x: -50,
      y: 700,
    })).toEqual({ x: 8, y: 472 });
  });

  it("keeps an oversized panel anchored to the available margin", () => {
    expect(clampFloatingPanelPosition({
      margin: 8,
      panelHeight: 700,
      panelWidth: 900,
      viewportHeight: 600,
      viewportWidth: 800,
      x: 400,
      y: 300,
    })).toEqual({ x: 8, y: 8 });
  });
});
