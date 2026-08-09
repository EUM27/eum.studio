export type RawJsonKind =
  | "array"
  | "boolean"
  | "null"
  | "number"
  | "object"
  | "string";

export type RawJsonInventoryEntry = {
  readonly path: string;
  readonly observedKinds: readonly RawJsonKind[];
  readonly occurrenceCount: number;
};

export type RawJsonObjectFieldInventory = {
  readonly objectPath: string;
  readonly occurrenceCount: number;
  readonly fields: readonly string[];
};

export type RawJsonUnknownFieldReceipt = {
  readonly objectPath: string;
  readonly field: string;
  readonly disposition: "raw-only";
};

export type RawJsonInventoryReport = {
  readonly entries: readonly RawJsonInventoryEntry[];
  readonly objectFields: readonly RawJsonObjectFieldInventory[];
  readonly unknownFields: readonly RawJsonUnknownFieldReceipt[];
  readonly secretLikePaths: readonly string[];
};

export type RawJsonKnownObjectFields = {
  readonly objectPath: string;
  readonly fields: readonly string[];
};

export type RawJsonInventoryProfile = {
  readonly dynamicObjectPaths: readonly string[];
  readonly knownObjectFields: readonly RawJsonKnownObjectFields[];
  readonly secretLikeFieldFragments: readonly string[];
};

export type ParsedRawJsonInventory = {
  readonly value: unknown;
  readonly report: RawJsonInventoryReport;
};

type MutableEntry = {
  readonly kinds: Set<RawJsonKind>;
  occurrenceCount: number;
};

type MutableObjectFields = {
  readonly fields: Set<string>;
  occurrenceCount: number;
};

function jsonKind(value: unknown): RawJsonKind {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  switch (typeof value) {
    case "boolean": return "boolean";
    case "number": return "number";
    case "object": return "object";
    case "string": return "string";
    default:
      throw new Error("JSON inventory received a non-JSON value");
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function childPath(
  parentPath: string,
  field: string,
): string {
  return `${parentPath}.${field}`;
}

function normalizeFragments(
  fragments: readonly string[],
): readonly string[] {
  return Object.freeze(
    [...new Set(
      fragments
        .map((fragment) => fragment.trim().toLocaleLowerCase("en-US"))
        .filter((fragment) => fragment.length > 0),
    )].sort(),
  );
}

export function parseRawJsonInventory(
  bytes: Uint8Array,
  profile: RawJsonInventoryProfile,
): ParsedRawJsonInventory {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value: unknown = JSON.parse(text);
  const entries = new Map<string, MutableEntry>();
  const objectFields = new Map<string, MutableObjectFields>();
  const dynamicObjectPaths = new Set(profile.dynamicObjectPaths);
  const secretFragments = normalizeFragments(
    profile.secretLikeFieldFragments,
  );
  const secretLikePaths = new Set<string>();

  const recordEntry = (path: string, current: unknown) => {
    const entry = entries.get(path) ?? {
      kinds: new Set<RawJsonKind>(),
      occurrenceCount: 0,
    };
    entry.kinds.add(jsonKind(current));
    entry.occurrenceCount += 1;
    entries.set(path, entry);
  };

  const visit = (current: unknown, path: string): void => {
    recordEntry(path, current);
    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item, `${path}[]`);
      }
      return;
    }
    if (!isRecord(current)) {
      return;
    }
    const fieldInventory = objectFields.get(path) ?? {
      fields: new Set<string>(),
      occurrenceCount: 0,
    };
    fieldInventory.occurrenceCount += 1;
    const dynamic = dynamicObjectPaths.has(path);
    for (const [field, fieldValue] of Object.entries(current)) {
      fieldInventory.fields.add(field);
      const normalizedField = field.toLocaleLowerCase("en-US");
      const nextPath = dynamic ? `${path}.*` : childPath(path, field);
      if (
        secretFragments.some((fragment) =>
          normalizedField.includes(fragment),
        )
      ) {
        secretLikePaths.add(nextPath);
      }
      visit(fieldValue, nextPath);
    }
    objectFields.set(path, fieldInventory);
  };

  visit(value, "$");

  const knownFieldsByPath = new Map(
    profile.knownObjectFields.map((known) => [
      known.objectPath,
      new Set(known.fields),
    ]),
  );
  const unknownFields: RawJsonUnknownFieldReceipt[] = [];
  for (const [objectPath, inventory] of objectFields) {
    const knownFields = knownFieldsByPath.get(objectPath);
    if (knownFields === undefined) {
      continue;
    }
    for (const field of inventory.fields) {
      if (!knownFields.has(field)) {
        unknownFields.push(Object.freeze({
          objectPath,
          field,
          disposition: "raw-only",
        }));
      }
    }
  }

  const report: RawJsonInventoryReport = Object.freeze({
    entries: Object.freeze(
      [...entries.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, entry]) => Object.freeze({
          path,
          observedKinds: Object.freeze([...entry.kinds].sort()),
          occurrenceCount: entry.occurrenceCount,
        })),
    ),
    objectFields: Object.freeze(
      [...objectFields.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([objectPath, inventory]) => Object.freeze({
          objectPath,
          occurrenceCount: inventory.occurrenceCount,
          fields: Object.freeze([...inventory.fields].sort()),
        })),
    ),
    unknownFields: Object.freeze(
      unknownFields.sort((left, right) =>
        `${left.objectPath}.${left.field}`.localeCompare(
          `${right.objectPath}.${right.field}`,
        ),
      ),
    ),
    secretLikePaths: Object.freeze([...secretLikePaths].sort()),
  });
  return Object.freeze({ value, report });
}
