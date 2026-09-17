import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import { entityId } from "../../../domain/writing";
import { useEditorToolsController, type EditorToolsPort } from "./useEditorToolsController";

// Exercise the actual controller callbacks; the harness only supplies React's
// state slots so no browser or manuscript-storage implementation is substituted.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useRef: <T>(initial: T) => {
    const slot = hooks.cursor++;
    hooks.slots[slot] ??= { current: initial };
    return hooks.slots[slot];
  },
  useState: <T>(initial: T) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
    return [hooks.slots[slot], (next: T | ((current: T) => T)) => {
      hooks.slots[slot] = typeof next === "function"
        ? (next as (current: T) => T)(hooks.slots[slot] as T) : next;
    }];
  },
}));

beforeEach(() => { hooks.slots = []; hooks.cursor = 0; });

function setup() {
  const workId = entityId<"Work">(randomUUID());
  const documents = Array.from({ length: 3 }, (_, index): ManuscriptDocumentSource => ({
    workId,
    documentId: entityId<"Document">(randomUUID()),
    documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
    label: String(index),
    initialText: randomUUID(),
  }));
  const materializeDocumentText = vi.fn((document: ManuscriptDocumentSource) => {
    if (document === documents[1]) throw new Error("Unselected manuscript is unreadable");
    return document.initialText;
  });
  const exportManuscriptText = vi.fn().mockResolvedValue({ status: "exported" });
  const input = {
    client: { exportManuscriptText } as unknown as StudioBridge["editor"],
    document: documents[0]!, documents,
    editor: { materializeDocumentText } as unknown as EditorToolsPort,
    workTitle: randomUUID(),
  };
  const ControllerHarness = () => { hooks.cursor = 0; return useEditorToolsController(input); };
  ControllerHarness().openManuscriptBulkExport();
  return { controller: ControllerHarness(), documents, materializeDocumentText, exportManuscriptText };
}

it("reads only selected episodes in catalog order through the export controller", async () => {
  const { controller, documents, materializeDocumentText, exportManuscriptText } = setup();
  await controller.exportManuscriptBulk([documents[2]!.documentId, documents[0]!.documentId]);
  expect(materializeDocumentText.mock.calls.map(([document]) => document.documentId))
    .toEqual([documents[0]!.documentId, documents[2]!.documentId]);
  expect(exportManuscriptText).toHaveBeenCalledWith(expect.objectContaining({
    documentId: documents[0]!.documentId,
    text: `${documents[0]!.initialText}\n\n${documents[2]!.initialText}`,
  }));
});

it("validates selection before reading any manuscript", () => {
  const { controller, documents, materializeDocumentText, exportManuscriptText } = setup();
  for (const selected of [[], [entityId<"Document">(randomUUID())], [documents[0]!.documentId, documents[0]!.documentId]]) {
    expect(() => controller.exportManuscriptBulk(selected)).toThrow();
  }
  expect(materializeDocumentText).not.toHaveBeenCalled();
  expect(exportManuscriptText).not.toHaveBeenCalled();
});
