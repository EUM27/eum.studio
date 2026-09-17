import { describe, expect, it } from "vitest";

import {
  CANON_ENTITY_KINDS,
  canonEntityRefKey,
  parseCanonEntityRef,
  parseCanonEntityRefList,
} from "./canon-entity-ref";

describe("Canon entity reference", () => {
  it("parses every approved typed entity reference without changing its wire shape", () => {
    for (const kind of CANON_ENTITY_KINDS) {
      const parsed = parseCanonEntityRef({ kind, id: `${kind}-1` });
      expect(parsed).toEqual({ kind, id: `${kind}-1` });
      expect(canonEntityRefKey(parsed)).toBe(`${kind}:${kind}-1`);
    }
  });

  it("rejects unsupported fields, kinds, blank identities, and duplicate references", () => {
    expect(() => parseCanonEntityRef({
      kind: "character",
      id: "character-1",
      revision: 1,
    })).toThrow(/fields/u);
    expect(() => parseCanonEntityRef({ kind: "unknown", id: "entity-1" }))
      .toThrow(/kind/u);
    expect(() => parseCanonEntityRef({ kind: "character", id: " " }))
      .toThrow(/id/u);
    expect(() => parseCanonEntityRefList([
      { kind: "character", id: "character-1" },
      { kind: "character", id: "character-1" },
    ], "subjectRefs")).toThrow(/duplicate/u);
  });
});

