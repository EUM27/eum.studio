import { randomInt, randomUUID } from "node:crypto";

import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import {
  calculateManuscriptTextStatistics,
  manuscriptTextStatisticsExtension,
  readManuscriptTextStatistics,
} from "./manuscript-text-statistics";

const combiningMark = String.fromCodePoint(0x0301);
const joinedEmoji = String.fromCodePoint(0x1f469, 0x200d, 0x1f4bb);

function expectedStatistics(text: string) {
  const segments = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    ({ segment }) => segment,
  );
  return {
    characterCount: segments.length,
    characterCountWithoutWhitespace: segments.filter(
      (segment) => !/^\p{White_Space}/u.test(segment),
    ).length,
  };
}

describe("manuscript text statistics", () => {
  it("counts user-perceived characters separately from UTF-16 editor offsets", () => {
    const combinedCharacter = `${randomUUID()[0]}${combiningMark}`;
    const text = `${randomUUID()}${combinedCharacter}${joinedEmoji} \n${randomUUID()}`;
    const state = EditorState.create({
      doc: text,
      extensions: [manuscriptTextStatisticsExtension],
    });

    const statistics = readManuscriptTextStatistics(state);

    expect(statistics).toEqual(expectedStatistics(text));
    expect(state.doc.length).toBeGreaterThan(statistics.characterCount);
    expect(Object.isFrozen(statistics)).toBe(true);
  });

  it("updates changed lines when edits join graphemes and change line structure", () => {
    const prefix = randomUUID();
    const suffix = randomUUID();
    let state = EditorState.create({
      doc: `${prefix}\n${suffix}`,
      extensions: [manuscriptTextStatisticsExtension],
    });
    const splitAt = randomInt(1, suffix.length - 1);

    state = state.update({
      changes: [
        { from: prefix.length, to: prefix.length + 1, insert: joinedEmoji },
        {
          from: prefix.length + 1 + splitAt,
          insert: `\n${suffix[splitAt - 1]}${combiningMark}`,
        },
      ],
    }).state;

    expect(readManuscriptTextStatistics(state)).toEqual(
      calculateManuscriptTextStatistics(state.doc),
    );
  });

  it("reuses statistics for selection-only transactions", () => {
    const text = `${randomUUID()}${joinedEmoji}${randomUUID()}`;
    const state = EditorState.create({
      doc: text,
      extensions: [manuscriptTextStatisticsExtension],
    });
    const statistics = readManuscriptTextStatistics(state);
    const selected = state.update({
      selection: {
        anchor: text.length,
        head: randomInt(0, text.length),
      },
    }).state;

    expect(readManuscriptTextStatistics(selected)).toBe(statistics);
  });

  it("matches a full Unicode segmentation after repeated boundary edits", () => {
    const replacementTokens = [
      randomUUID()[0]!,
      " ",
      "\t",
      "\n",
      `${randomUUID()[0]}${combiningMark}`,
      joinedEmoji,
    ];
    let state = EditorState.create({
      doc: randomUUID(),
      extensions: [manuscriptTextStatisticsExtension],
    });

    for (let iteration = 0; iteration < 64; iteration += 1) {
      const text = state.doc.toString();
      const boundaries = [
        0,
        ...Array.from(
          new Intl.Segmenter(undefined, {
            granularity: "grapheme",
          }).segment(text),
          ({ index, segment }) => index + segment.length,
        ),
      ];
      const fromIndex = randomInt(0, boundaries.length);
      const toIndex = randomInt(fromIndex, boundaries.length);
      state = state.update({
        changes: {
          from: boundaries[fromIndex]!,
          to: boundaries[toIndex]!,
          insert: replacementTokens[
            randomInt(0, replacementTokens.length)
          ]!,
        },
      }).state;

      expect(readManuscriptTextStatistics(state)).toEqual(
        expectedStatistics(state.doc.toString()),
      );
    }
  });
});
