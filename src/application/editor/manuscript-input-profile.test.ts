import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseManuscriptInputProfile } from "./manuscript-input-profile";

describe("manuscript input profile", () => {
  it("preserves caller-provided pairs and replacements as immutable runtime data", () => {
    const pair = {
      open: randomUUID(),
      close: randomUUID(),
    };
    const replacement = {
      trigger: randomUUID(),
      replacement: randomUUID(),
    };

    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [pair],
      textReplacements: [replacement],
    });

    expect(profile).toEqual({
      schemaVersion: 1,
      autoClosePairs: [pair],
      textReplacements: [replacement],
    });
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.autoClosePairs)).toBe(true);
    expect(Object.isFrozen(profile.autoClosePairs[0])).toBe(true);
    expect(Object.isFrozen(profile.textReplacements)).toBe(true);
    expect(Object.isFrozen(profile.textReplacements[0])).toBe(true);
  });

  it("rejects ambiguous opening tokens", () => {
    const open = randomUUID();

    expect(() =>
      parseManuscriptInputProfile({
        schemaVersion: 1,
        autoClosePairs: [
          { open, close: randomUUID() },
          { open, close: randomUUID() },
        ],
        textReplacements: [],
      }),
    ).toThrow("autoClosePairs contains an ambiguous opening token");
  });

  it("rejects ambiguous replacement triggers", () => {
    const trigger = randomUUID();

    expect(() =>
      parseManuscriptInputProfile({
        schemaVersion: 1,
        autoClosePairs: [],
        textReplacements: [
          { trigger, replacement: randomUUID() },
          { trigger, replacement: randomUUID() },
        ],
      }),
    ).toThrow("textReplacements contains an ambiguous trigger");
  });

  it("preserves distinct typed triggers and ordered evolution cycles", () => {
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [
        { trigger: "\"", open: "“", close: "”" },
      ],
      evolutionCycles: [
        {
          trigger: "(",
          pairs: [
            { open: "(", close: ")" },
            { open: "【", close: "】" },
          ],
        },
      ],
      textReplacements: [],
    });

    expect(profile.autoClosePairs[0]).toEqual({
      trigger: "\"",
      open: "“",
      close: "”",
    });
    expect(profile.evolutionCycles?.[0]?.pairs).toEqual([
      { open: "(", close: ")" },
      { open: "【", close: "】" },
    ]);
  });
});
