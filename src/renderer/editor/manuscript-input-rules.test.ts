import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseManuscriptInputProfile } from "../../application/editor/manuscript-input-profile";
import { getManuscriptTypingEdit } from "./manuscript-input-rules";

function createInput(
  doc: string,
  from: number,
  text: string,
  overrides: Partial<{
    to: number;
    userEvent: string;
    isComposing: boolean;
  }> = {},
) {
  return {
    from,
    to: overrides.to ?? from,
    text,
    userEvent: overrides.userEvent ?? "input.type",
    isComposing: overrides.isComposing ?? false,
    readText: (readFrom: number, readTo: number) =>
      doc.slice(readFrom, readTo),
  };
}

describe("manuscript input rules", () => {
  it("auto-closes every pair supplied by the runtime profile", () => {
    const prefix = randomUUID();
    const pairs = Array.from({ length: 3 }, () => ({
      open: randomUUID(),
      close: randomUUID(),
    }));
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: pairs,
      textReplacements: [],
    });

    for (const pair of pairs) {
      expect(
        getManuscriptTypingEdit(
          profile,
          createInput(prefix, prefix.length, pair.open),
        ),
      ).toEqual({
        from: prefix.length,
        to: prefix.length,
        insert: `${pair.open}${pair.close}`,
        anchor: prefix.length + pair.open.length,
        head: prefix.length + pair.open.length,
      });
    }
  });

  it("moves across an existing registered closer without inserting a duplicate", () => {
    const prefix = randomUUID();
    const close = randomUUID();
    const suffix = randomUUID();
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [{ open: randomUUID(), close }],
      textReplacements: [],
    });
    const doc = `${prefix}${close}${suffix}`;

    expect(
      getManuscriptTypingEdit(
        profile,
        createInput(doc, prefix.length, close),
      ),
    ).toEqual({
      from: prefix.length,
      to: prefix.length,
      insert: "",
      anchor: prefix.length + close.length,
      head: prefix.length + close.length,
    });
  });

  it("auto-closes a multi-character opener when its final input arrives", () => {
    const prefix = randomUUID();
    const open = randomUUID();
    const close = randomUUID();
    const typedPrefix = open.slice(0, -1);
    const finalInput = open.slice(-1);
    const doc = `${prefix}${typedPrefix}`;
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [{ open, close }],
      textReplacements: [],
    });

    expect(
      getManuscriptTypingEdit(
        profile,
        createInput(doc, doc.length, finalInput),
      ),
    ).toEqual({
      from: prefix.length,
      to: doc.length,
      insert: `${open}${close}`,
      anchor: prefix.length + open.length,
      head: prefix.length + open.length,
    });
  });

  it("removes a typed multi-character prefix before skipping an existing closer", () => {
    const prefix = randomUUID();
    const close = randomUUID();
    const suffix = randomUUID();
    const typedPrefix = close.slice(0, -1);
    const finalInput = close.slice(-1);
    const from = prefix.length + typedPrefix.length;
    const doc = `${prefix}${typedPrefix}${close}${suffix}`;
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [{ open: randomUUID(), close }],
      textReplacements: [],
    });

    expect(
      getManuscriptTypingEdit(
        profile,
        createInput(doc, from, finalInput),
      ),
    ).toEqual({
      from: prefix.length,
      to: from,
      insert: "",
      anchor: prefix.length + close.length,
      head: prefix.length + close.length,
    });
  });

  it("skips a symmetric closer before treating the same token as an opener", () => {
    const token = randomUUID();
    const prefix = randomUUID();
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [{ open: token, close: token }],
      textReplacements: [],
    });
    const doc = `${prefix}${token}`;

    expect(
      getManuscriptTypingEdit(
        profile,
        createInput(doc, prefix.length, token),
      ),
    ).toMatchObject({
      insert: "",
      anchor: prefix.length + token.length,
      head: prefix.length + token.length,
    });
  });

  it("inserts curved quotes from a distinct keyboard trigger and skips the closer", () => {
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [{ trigger: "\"", open: "“", close: "”" }],
      textReplacements: [],
    });

    expect(getManuscriptTypingEdit(profile, createInput("", 0, "\""))).toEqual({
      from: 0,
      to: 0,
      insert: "“”",
      anchor: 1,
      head: 1,
    });
    expect(getManuscriptTypingEdit(profile, createInput("“”", 1, "\""))).toEqual({
      from: 1,
      to: 1,
      insert: "",
      anchor: 2,
      head: 2,
    });
  });

  it("evolves a registered bracket pair when the trigger repeats inside it", () => {
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [],
      evolutionCycles: [
        {
          trigger: "(",
          pairs: [
            { open: "(", close: ")" },
            { open: "【", close: "】" },
            { open: "〖", close: "〗" },
          ],
        },
      ],
      textReplacements: [],
    });

    expect(getManuscriptTypingEdit(profile, createInput("", 0, "("))).toEqual({
      from: 0,
      to: 0,
      insert: "()",
      anchor: 1,
      head: 1,
    });
    expect(getManuscriptTypingEdit(profile, createInput("()", 1, "("))).toEqual({
      from: 0,
      to: 2,
      insert: "【】",
      anchor: 1,
      head: 1,
    });
    expect(getManuscriptTypingEdit(profile, createInput("【】", 1, "("))).toEqual({
      from: 0,
      to: 2,
      insert: "〖〗",
      anchor: 1,
      head: 1,
    });
  });

  it("replaces three consecutive periods with the registered midline ellipsis", () => {
    const prefix = randomUUID();
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [],
      textReplacements: [{ trigger: "...", replacement: "⋯" }],
    });
    const doc = `${prefix}..`;

    expect(
      getManuscriptTypingEdit(
        profile,
        createInput(doc, doc.length, "."),
      ),
    ).toEqual({
      from: prefix.length,
      to: doc.length,
      insert: "⋯",
      anchor: prefix.length + 1,
      head: prefix.length + 1,
    });
  });

  it("leaves composition, paste, and selected-range input to CodeMirror", () => {
    const open = randomUUID();
    const profile = parseManuscriptInputProfile({
      schemaVersion: 1,
      autoClosePairs: [{ open, close: randomUUID() }],
      textReplacements: [],
    });
    const doc = randomUUID();

    expect(
      getManuscriptTypingEdit(
        profile,
        createInput(doc, doc.length, open, { isComposing: true }),
      ),
    ).toBeNull();
    expect(
      getManuscriptTypingEdit(
        profile,
        createInput(doc, doc.length, open, { userEvent: "input.paste" }),
      ),
    ).toBeNull();
    expect(
      getManuscriptTypingEdit(
        profile,
        createInput(doc, 0, open, { to: doc.length }),
      ),
    ).toBeNull();
  });
});
