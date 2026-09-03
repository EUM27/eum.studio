import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import { ManuscriptSaveStateStore } from "./manuscript-save-state-store";

describe("ManuscriptSaveStateStore", () => {
  it("publishes queue state without requiring a React owner state update", async () => {
    const store = new ManuscriptSaveStateStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const documentId = entityId<"Document">("document-save-state");

    store.replace({ [documentId]: "saved" });
    store.publish(documentId, "editing");
    store.publish(documentId, "saving");

    expect(store.getSnapshot()[documentId]).toBe("saving");
    expect(listener).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("does not notify when a document state is unchanged", async () => {
    const store = new ManuscriptSaveStateStore();
    const listener = vi.fn();
    const documentId = entityId<"Document">("document-save-state");
    store.replace({ [documentId]: "saved" });
    await Promise.resolve();
    store.subscribe(listener);

    store.publish(documentId, "saved");
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
  });
});
