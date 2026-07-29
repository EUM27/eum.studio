import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  DURABLE_TEXT_REPRESENTATION_V1,
  classifyChangeBatchIdentity,
  encodeDurableText,
  parseCanonicalChangeBatch,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
} from "./change-batch";

function createBatchInput(insertedText: string): Record<string, unknown> {
  const beforeTextLengthUtf16 = randomInt(1, 32);

  return {
    schemaVersion: 1,
    textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId: randomUUID(),
    documentId: randomUUID(),
    baseRevisionId: randomUUID(),
    sequence: randomInt(0, 32),
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16,
    afterTextLengthUtf16:
      beforeTextLengthUtf16 + insertedText.length,
    changes: [
      {
        fromUtf16: beforeTextLengthUtf16,
        toUtf16: beforeTextLengthUtf16,
        insertedText,
      },
    ],
  };
}

function encodeUtf16Le(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    bytes[index * 2] = codeUnit & 0xff;
    bytes[index * 2 + 1] = codeUnit >>> 8;
  }
  return bytes;
}

describe("ChangeBatch durable representation", () => {
  it("preserves UTF-16 offsets, LF, and non-normalized text in deterministic canonical bytes", () => {
    const decomposedText = `e\u0301\n${String.fromCodePoint(0x1f31f)}`;
    const firstInput = createBatchInput(decomposedText);
    const secondInput = Object.fromEntries(
      Object.entries(firstInput).reverse(),
    );

    const first = parseChangeBatch(firstInput);
    const second = parseChangeBatch(secondInput);
    const firstBytes = serializeCanonicalChangeBatch(first);
    const secondBytes = serializeCanonicalChangeBatch(second);

    expect(first.changes[0]?.insertedText).toBe(decomposedText);
    expect(
      first.afterTextLengthUtf16 - first.beforeTextLengthUtf16,
    ).toBe(decomposedText.length);
    expect(Array.from(firstBytes)).toEqual(Array.from(secondBytes));
    expect(new TextDecoder().decode(firstBytes)).toContain(
      JSON.stringify(decomposedText),
    );
    expect(Array.from(encodeDurableText(decomposedText))).toEqual(
      Array.from(encodeUtf16Le(decomposedText)),
    );

    const normalizedInput = {
      ...firstInput,
      afterTextLengthUtf16:
        (firstInput.beforeTextLengthUtf16 as number) +
        decomposedText.normalize("NFC").length,
      changes: [
        {
          ...(firstInput.changes as Record<string, unknown>[])[0],
          insertedText: decomposedText.normalize("NFC"),
        },
      ],
    };
    const normalized = parseChangeBatch(normalizedInput);

    expect(
      Array.from(serializeCanonicalChangeBatch(normalized)),
    ).not.toEqual(Array.from(firstBytes));
  });

  it("decodes canonical bytes back to the exact validated batch", () => {
    const batch = parseChangeBatch(createBatchInput(randomUUID()));
    const bytes = serializeCanonicalChangeBatch(batch);

    expect(parseCanonicalChangeBatch(bytes)).toEqual(batch);
  });

  it("rejects unversioned fields instead of silently dropping them from canonical bytes", () => {
    const unexpectedField = randomUUID();
    const input = {
      ...createBatchInput(randomUUID()),
      [unexpectedField]: randomUUID(),
    };

    expect(() => parseChangeBatch(input)).toThrow(
      `Unsupported ChangeBatch field: ${unexpectedField}`,
    );
  });

  it("classifies an identical batch identity as an idempotent duplicate and changed bytes as a conflict", () => {
    const originalInput = createBatchInput(randomUUID());
    const original = parseChangeBatch(originalInput);
    const duplicate = parseChangeBatch(
      Object.fromEntries(Object.entries(originalInput).reverse()),
    );
    const changedText = randomUUID();
    const conflicting = parseChangeBatch({
      ...originalInput,
      afterTextLengthUtf16:
        (originalInput.beforeTextLengthUtf16 as number) +
        changedText.length,
      changes: [
        {
          ...(originalInput.changes as Record<string, unknown>[])[0],
          insertedText: changedText,
        },
      ],
    });
    const distinct = parseChangeBatch({
      ...originalInput,
      batchId: randomUUID(),
    });

    expect(classifyChangeBatchIdentity(original, duplicate)).toBe(
      "duplicate",
    );
    expect(classifyChangeBatchIdentity(original, conflicting)).toBe(
      "conflict",
    );
    expect(classifyChangeBatchIdentity(original, distinct)).toBe(
      "distinct",
    );
  });

  it("rejects CR input at the durable text boundary instead of silently rewriting it", () => {
    const firstLine = randomUUID();
    const secondLine = randomUUID();
    const canonicalText = `${firstLine}\n${secondLine}`;
    const platformText = `${firstLine}\r\n${secondLine}`;

    expect(() => encodeDurableText(canonicalText)).not.toThrow();
    expect(() => encodeDurableText(platformText)).toThrow(
      "LF line endings",
    );
    expect(() => parseChangeBatch(createBatchInput(platformText))).toThrow(
      "LF line endings",
    );
  });

  it.each([
    {
      label: "unsupported schema",
      mutate: (input: Record<string, unknown>) => ({
        ...input,
        schemaVersion: randomInt(2, 32),
      }),
      message: "schemaVersion",
    },
    {
      label: "unsafe sequence",
      mutate: (input: Record<string, unknown>) => ({
        ...input,
        sequence: Number.MAX_SAFE_INTEGER + 1,
      }),
      message: "sequence",
    },
    {
      label: "mismatched resulting length",
      mutate: (input: Record<string, unknown>) => ({
        ...input,
        afterTextLengthUtf16:
          (input.afterTextLengthUtf16 as number) + 1,
      }),
      message: "afterTextLengthUtf16",
    },
    {
      label: "overlapping changes",
      mutate: (input: Record<string, unknown>) => {
        const beforeTextLengthUtf16 =
          input.beforeTextLengthUtf16 as number;
        const insertedText = randomUUID();
        return {
          ...input,
          afterTextLengthUtf16:
            beforeTextLengthUtf16 + insertedText.length * 2,
          changes: [
            {
              fromUtf16: beforeTextLengthUtf16,
              toUtf16: beforeTextLengthUtf16,
              insertedText,
            },
            {
              fromUtf16: beforeTextLengthUtf16 - 1,
              toUtf16: beforeTextLengthUtf16 - 1,
              insertedText,
            },
          ],
        };
      },
      message: "ordered or overlaps",
    },
    {
      label: "no-op change",
      mutate: (input: Record<string, unknown>) => ({
        ...input,
        afterTextLengthUtf16: input.beforeTextLengthUtf16,
        changes: [
          {
            fromUtf16: input.beforeTextLengthUtf16,
            toUtf16: input.beforeTextLengthUtf16,
            insertedText: "",
          },
        ],
      }),
      message: "no-op",
    },
  ])("rejects $label", ({ mutate, message }) => {
    expect(() =>
      parseChangeBatch(mutate(createBatchInput(randomUUID()))),
    ).toThrow(message);
  });
});
