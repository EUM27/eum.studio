import { describe, expect, it } from "vitest";

import {
  parseCreatePublishingSourceCommand,
  parseListPublishingSourcesCommand,
  parsePublishingSourceListProjection,
} from "./publishing-source-contract";

describe("publishing source contract", () => {
  it("parses an immutable Studio-shared source without fixed kind or authority defaults", () => {
    const create = {
      schemaVersion: 1,
      kind: "사용자 진술",
      label: "계약서 원본 확인",
      url: null,
      observedAt: "2026-10-16T03:30:00.000Z",
      authority: "직접 확인",
      importedFields: {},
    } as const;
    expect(parseCreatePublishingSourceCommand(create)).toEqual(create);
    expect(parseListPublishingSourcesCommand({ schemaVersion: 1 }))
      .toEqual({ schemaVersion: 1 });
    expect(parsePublishingSourceListProjection({
      schemaVersion: 1,
      sources: [{
        ...create,
        sourceId: "source-a",
        revision: 1,
        createdAt: "2026-10-16T03:31:00.000Z",
      }],
    }).sources[0]).toMatchObject({
      sourceId: "source-a",
      kind: "사용자 진술",
      label: "계약서 원본 확인",
      authority: "직접 확인",
    });
  });
});
