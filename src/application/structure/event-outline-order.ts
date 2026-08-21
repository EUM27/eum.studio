import {
  compareFractionalOrderKeys,
} from "../../domain/fractional-order-key";
import type { EntityId } from "../../domain/writing";
import type { EventBlockProjection } from "./event-block-contract";

const FRACTIONAL_ORDER_KEY = /^-?(?:0|[1-9]\d*)\/[1-9]\d*$/u;

export type EventBlockMoveTarget = Readonly<{
  beforeEventBlockId?: EntityId<"EventBlock">;
  afterEventBlockId?: EntityId<"EventBlock">;
}>;

export function isFractionalEventOutlineOrderKey(value: string): boolean {
  return FRACTIONAL_ORDER_KEY.test(value);
}

export function compareEventOutlineOrderKeys(
  left: string,
  right: string,
): number {
  return isFractionalEventOutlineOrderKey(left) &&
      isFractionalEventOutlineOrderKey(right)
    ? compareFractionalOrderKeys(left, right)
    : left.localeCompare(right);
}

export function createEventBlockMoveTarget(
  events: readonly EventBlockProjection[],
  eventBlockId: EntityId<"EventBlock">,
  insertionIndex: number,
): EventBlockMoveTarget {
  const remaining = events.filter(
    (event) => event.eventBlockId !== eventBlockId,
  );
  if (
    !Number.isSafeInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > remaining.length
  ) {
    throw new Error("EventBlock insertion index is outside the outline");
  }
  const before = remaining[insertionIndex - 1];
  const after = remaining[insertionIndex];
  return Object.freeze({
    ...(before === undefined
      ? {}
      : { beforeEventBlockId: before.eventBlockId }),
    ...(after === undefined
      ? {}
      : { afterEventBlockId: after.eventBlockId }),
  });
}
