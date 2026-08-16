import { describe, expect, it } from "vitest";

import {
  PUBLISHING_EVIDENCE_TARGET_KINDS,
  parsePublishingEvidenceLinksProjection,
  parseSetPublishingEvidenceLinksCommand,
} from "./publishing-evidence-link-contract";

describe("publishing evidence link contract", () => {
  it("parses an explicit source selection for every publishing target kind", () => {
    for (const targetKind of PUBLISHING_EVIDENCE_TARGET_KINDS) {
      const command = {
        schemaVersion: 1,
        targetKind,
        targetId: `${targetKind}-a`,
        expectedRevision: 1,
        sourceIds: ["source-a"],
      } as const;
      expect(parseSetPublishingEvidenceLinksCommand(command)).toEqual(command);
      expect(parsePublishingEvidenceLinksProjection({
        schemaVersion: 1,
        targetKind,
        targetId: `${targetKind}-a`,
        revision: 2,
        sourceIds: ["source-a"],
        updatedAt: "2026-10-16T04:00:00.000Z",
      })).toMatchObject({ targetKind, revision: 2, sourceIds: ["source-a"] });
    }
  });
});
