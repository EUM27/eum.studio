import { describe, expect, it } from "vitest";

import {
  canonicalizeNarrativeDigestSourceManifest,
  createNarrativeDigestSourceManifestHash,
  parseNarrativeDigestSourceManifest,
  parseNarrativeDigestScope,
  parseNarrativeDigestSceneSource,
  projectNarrativeDigestIntegrity,
} from "./narrative-digest-manifest";

describe("NarrativeDigest source manifest", () => {
  it("canonicalizes scope and every source revision deterministically", () => {
    const raw = {
      schemaVersion: 1,
      scope: { kind: "relationship", firstCharacterId: "character-b", secondCharacterId: "character-a" },
      promptVersion: "eum-narrative-digest-v1",
      documents: [
        { documentId: "document-b", documentRevisionId: "revision-b" },
        { documentId: "document-a", documentRevisionId: "revision-a" },
      ],
      eventBlocks: [{ entityId: "event-b", revision: 2 }, { entityId: "event-a", revision: 1 }],
      characters: [{ entityId: "character-b", revision: 2 }, { entityId: "character-a", revision: 1 }],
      characterRelations: [{ entityId: "relation-1", revision: 3 }],
      loreEntries: [{ entityId: "lore-1", revision: 4 }],
      continuityThreads: [{ entityId: "thread-1", revision: 5 }],
      characterKnowledge: [{ entityId: "knowledge-1", revision: 6 }],
    };
    const first = parseNarrativeDigestSourceManifest(raw);
    const second = parseNarrativeDigestSourceManifest({
      ...raw,
      documents: [...raw.documents].reverse(),
      eventBlocks: [...raw.eventBlocks].reverse(),
      characters: [...raw.characters].reverse(),
    });
    expect(canonicalizeNarrativeDigestSourceManifest(first))
      .toBe(canonicalizeNarrativeDigestSourceManifest(second));
    expect(first.scope).toEqual({
      kind: "relationship",
      firstCharacterId: "character-a",
      secondCharacterId: "character-b",
    });
    expect(createNarrativeDigestSourceManifestHash(first, (canonical) => `sha256:${canonical.length}`))
      .toMatch(/^sha256:/u);
  });

  it("marks changed source hashes stale without changing text", () => {
    expect(projectNarrativeDigestIntegrity("hash-a", "hash-a")).toBe("current");
    expect(projectNarrativeDigestIntegrity("hash-a", "hash-b")).toBe("stale");
  });

  it("binds a Scene digest hash to its exact stable Scene range", () => {
    const sceneSource = parseNarrativeDigestSceneSource({
      sceneId: "scene-1",
      documentId: "document-a",
      documentRevisionId: "revision-a",
      from: 2,
      to: 9,
      textHash: "scene-text-hash",
      trigger: "scene-transition",
    });
    const manifest = parseNarrativeDigestSourceManifest({
      schemaVersion: 1,
      scope: { kind: "scene", sceneId: "scene-1" },
      promptVersion: "eum-narrative-digest-v2",
      documents: [{ documentId: "document-a", documentRevisionId: "revision-a" }],
      eventBlocks: [], characters: [], characterRelations: [], loreEntries: [],
      continuityThreads: [], characterKnowledge: [],
    });
    const checksum = (canonical: string) => canonical;
    expect(createNarrativeDigestSourceManifestHash(manifest, checksum, sceneSource))
      .not.toBe(createNarrativeDigestSourceManifestHash(manifest, checksum, {
        ...sceneSource,
        to: 10,
      }));
  });

  it("rejects implicit scope, same-character relationships, duplicates, and missing revisions", () => {
    expect(() => parseNarrativeDigestScope({ kind: "recent", count: 5 })).toThrow(/scope/u);
    expect(() => parseNarrativeDigestScope({ kind: "relationship", firstCharacterId: "a", secondCharacterId: "a" }))
      .toThrow(/different/u);
    expect(() => parseNarrativeDigestSourceManifest({
      schemaVersion: 1,
      scope: { kind: "work" },
      promptVersion: "v1",
      documents: [{ documentId: "d", documentRevisionId: "r" }, { documentId: "d", documentRevisionId: "r" }],
      eventBlocks: [], characters: [], characterRelations: [], loreEntries: [],
      continuityThreads: [], characterKnowledge: [],
    })).toThrow(/duplicate/u);
    expect(() => parseNarrativeDigestSourceManifest({
      schemaVersion: 1,
      scope: { kind: "work" }, promptVersion: "v1", documents: [],
      eventBlocks: [{ entityId: "e", revision: 0 }], characters: [],
      characterRelations: [], loreEntries: [], continuityThreads: [], characterKnowledge: [],
    })).toThrow(/revision/u);
  });
});
