import { describe, expect, it } from "vitest";

import {
  parseLinkLoreForeshadowCommand,
  parseListLoreForeshadowLinksCommand,
  parseLoreForeshadowLinkListProjection,
  parseLoreForeshadowLinkProjection,
  parseUnlinkLoreForeshadowCommand,
} from "./lore-foreshadow-link-contract";

describe("lore foreshadow link contract", () => {
  it("parses Work-owned link, list, unlink, and projection values", () => {
    expect(parseLinkLoreForeshadowCommand({
      schemaVersion: 1,
      workId: "work-a",
      loreEntryId: "lore-a",
      lineId: "line-a",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      loreEntryId: "lore-a",
      lineId: "line-a",
    });
    expect(parseListLoreForeshadowLinksCommand({
      schemaVersion: 1,
      workId: "work-a",
    })).toEqual({ schemaVersion: 1, workId: "work-a" });
    expect(parseUnlinkLoreForeshadowCommand({
      schemaVersion: 1,
      workId: "work-a",
      linkId: "link-a",
      expectedRevision: 1,
    })).toMatchObject({ linkId: "link-a", expectedRevision: 1 });
    expect(parseLoreForeshadowLinkProjection({
      schemaVersion: 1,
      linkId: "link-a",
      revision: 2,
      workId: "work-a",
      loreEntryId: "lore-a",
      lineId: "line-a",
      linkedAt: "2026-08-10T00:00:00.000Z",
      unlinkedAt: "2026-08-10T00:01:00.000Z",
      unlinkReason: "user",
    })).toMatchObject({ unlinkReason: "user" });
  });

  it("does not admit copied lore or foreshadow content into a link", () => {
    expect(() => parseLinkLoreForeshadowCommand({
      schemaVersion: 1,
      workId: "work-a",
      loreEntryId: "lore-a",
      lineId: "line-a",
      title: "복제하면 안 되는 제목",
    })).toThrow("Unsupported LinkLoreForeshadowCommand field: title");
  });

  it("requires consistent unlink state and rejects cross-Work lists", () => {
    expect(() => parseLoreForeshadowLinkProjection({
      schemaVersion: 1,
      linkId: "link-a",
      revision: 1,
      workId: "work-a",
      loreEntryId: "lore-a",
      lineId: "line-a",
      linkedAt: "2026-08-10T00:00:00.000Z",
      unlinkedAt: null,
      unlinkReason: "user",
    })).toThrow("unlink state is inconsistent");
    expect(() => parseLoreForeshadowLinkListProjection({
      schemaVersion: 1,
      workId: "work-a",
      links: [{
        schemaVersion: 1,
        linkId: "link-b",
        revision: 1,
        workId: "work-b",
        loreEntryId: "lore-b",
        lineId: "line-b",
        linkedAt: "2026-08-10T00:00:00.000Z",
        unlinkedAt: null,
        unlinkReason: null,
      }],
    })).toThrow("outside Work work-a");
  });
});
