import { describe, expect, it } from "vitest";

import {
  compareFractionalOrderKeys,
  createOrderKeyBetween,
  createRebalancedOrderKeys,
} from "./fractional-order-key";

describe("fractional plot order keys", () => {
  it("creates sortable keys before, between, and after neighboring placements", () => {
    const first = createOrderKeyBetween(null, null);
    const after = createOrderKeyBetween(first, null);
    const between = createOrderKeyBetween(first, after);
    const before = createOrderKeyBetween(null, first);

    expect([before, first, between, after]).toEqual([
      "-1/1",
      "0/1",
      "1/2",
      "1/1",
    ]);
    expect(compareFractionalOrderKeys(before, first)).toBeLessThan(0);
    expect(compareFractionalOrderKeys(first, between)).toBeLessThan(0);
    expect(compareFractionalOrderKeys(between, after)).toBeLessThan(0);
    expect(createRebalancedOrderKeys(4)).toEqual([
      "0/1",
      "1/1",
      "2/1",
      "3/1",
    ]);
  });
});
