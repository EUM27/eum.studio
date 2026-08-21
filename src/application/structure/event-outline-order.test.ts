import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { EventBlockProjection } from "./event-block-contract";
import {
  compareEventOutlineOrderKeys,
  createEventBlockMoveTarget,
} from "./event-outline-order";

function event(id: string, orderKey: string): EventBlockProjection {
  return {
    schemaVersion: 1,
    eventBlockId: entityId<"EventBlock">(id),
    revision: 1,
    workId: entityId<"Work">("work-a"),
    title: id,
    note: "",
    parentEventId: null,
    outlineOrderKey: orderKey,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    retiredAt: null,
  };
}

describe("EventBlock outline order", () => {
  it("compares legacy keys and fractional keys without merging their meaning", () => {
    expect(compareEventOutlineOrderKeys("0/1", "1/2")).toBeLessThan(0);
    expect(
      compareEventOutlineOrderKeys(
        '["2026-08-20","event-a"]',
        '["2026-08-21","event-b"]',
      ),
    ).toBeLessThan(0);
  });

  it("creates exact neighboring EventBlock identities for a drag insertion", () => {
    const events = [event("event-a", "0/1"), event("event-b", "1/1")];
    expect(
      createEventBlockMoveTarget(
        events,
        entityId<"EventBlock">("event-b"),
        0,
      ),
    ).toEqual({ afterEventBlockId: "event-a" });
  });
});
