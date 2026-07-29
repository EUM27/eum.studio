import {
  randomUUID,
} from "node:crypto";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  InstalledPackageResourceSlot,
} from "./poc-2-installed-package-resource-slot";

describe("installed-package active resource cleanup", () => {
  it("disposes the first active resource when its scenario fails", async () => {
    const resource = {
      id: randomUUID(),
    };
    const dispose =
      vi.fn(async () => undefined);
    const slot =
      new InstalledPackageResourceSlot<
        typeof resource
      >();
    slot.track(resource);

    await slot.cleanup(dispose);
    await slot.cleanup(dispose);

    expect(dispose).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledWith(
      resource,
    );
  });

  it("releases a completed resource and cleans only the next failed resource", async () => {
    const completed = {
      id: randomUUID(),
    };
    const failed = {
      id: randomUUID(),
    };
    const dispose =
      vi.fn(async () => undefined);
    const slot =
      new InstalledPackageResourceSlot<
        typeof completed
      >();
    slot.track(completed);
    slot.release(completed);
    slot.track(failed);

    await slot.cleanup(dispose);

    expect(dispose).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledWith(
      failed,
    );
  });
});
