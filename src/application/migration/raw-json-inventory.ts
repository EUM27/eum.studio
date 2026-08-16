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

function inputRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmptyText(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function nonNegativeInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  return value;
}

function uniqueTextArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const values = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string`);
    }
    return entry;
  });
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
  return Object.freeze(values);
}

export function parseRawJsonInventoryReport(
  value: unknown,
): RawJsonInventoryReport {
  const label = "RawJsonInventoryReport";
  const input = inputRecord(value, label);
  exactFields(
    input,
    ["entries", "objectFields", "unknownFields", "secretLikePaths"],
    label,
  );
  if (
    !Array.isArray(input.entries) ||
    !Array.isArray(input.objectFields) ||
    !Array.isArray(input.unknownFields)
  ) {
    throw new Error(`${label} inventory collections must be arrays`);
  }
  const entryPaths = new Set<string>();
  const entries = Object.freeze(input.entries.map((entry, index) => {
    const entryLabel = `${label}.entries[${index}]`;
    const entryInput = inputRecord(entry, entryLabel);
    exactFields(
      entryInput,
      ["path", "observedKinds", "occurrenceCount"],
      entryLabel,
    );
    const path = nonEmptyText(entryInput, "path", entryLabel);
    if (entryPaths.has(path)) {
      throw new Error(`${label}.entries contains a duplicate path`);
    }
    entryPaths.add(path);
    if (!Array.isArray(entryInput.observedKinds) || entryInput.observedKinds.length === 0) {
      throw new Error(`${entryLabel}.observedKinds must be a non-empty array`);
    }
    const observedKinds = entryInput.observedKinds.map((kind) => {
      if (
        kind !== "array" &&
        kind !== "boolean" &&
        kind !== "null" &&
        kind !== "number" &&
        kind !== "object" &&
        kind !== "string"
      ) {
        throw new Error(`${entryLabel}.observedKinds contains an unsupported kind`);
      }
      return kind;
    });
    if (new Set(observedKinds).size !== observedKinds.length) {
      throw new Error(`${entryLabel}.observedKinds must not contain duplicates`);
    }
    return Object.freeze({
      path,
      observedKinds: Object.freeze(observedKinds),
      occurrenceCount: nonNegativeInteger(
        entryInput,
        "occurrenceCount",
        entryLabel,
      ),
    });
  }));
  const objectPaths = new Set<string>();
  const objectFields = Object.freeze(input.objectFields.map((entry, index) => {
    const entryLabel = `${label}.objectFields[${index}]`;
    const entryInput = inputRecord(entry, entryLabel);
    exactFields(
      entryInput,
      ["objectPath", "occurrenceCount", "fields"],
      entryLabel,
    );
    const objectPath = nonEmptyText(entryInput, "objectPath", entryLabel);
    if (objectPaths.has(objectPath)) {
      throw new Error(`${label}.objectFields contains a duplicate path`);
    }
    objectPaths.add(objectPath);
    return Object.freeze({
      objectPath,
      occurrenceCount: nonNegativeInteger(
        entryInput,
        "occurrenceCount",
        entryLabel,
      ),
      fields: uniqueTextArray(entryInput.fields, `${entryLabel}.fields`),
    });
  }));
  const unknownIdentities = new Set<string>();
  const unknownFields = Object.freeze(input.unknownFields.map((entry, index) => {
    const entryLabel = `${label}.unknownFields[${index}]`;
    const entryInput = inputRecord(entry, entryLabel);
    exactFields(entryInput, ["objectPath", "field", "disposition"], entryLabel);
    if (entryInput.disposition !== "raw-only") {
      throw new Error(`${entryLabel}.disposition must be raw-only`);
    }
    const objectPath = nonEmptyText(entryInput, "objectPath", entryLabel);
    const field = nonEmptyText(entryInput, "field", entryLabel);
    const identity = JSON.stringify([objectPath, field]);
    if (unknownIdentities.has(identity)) {
      throw new Error(`${label}.unknownFields contains a duplicate field`);
    }
    unknownIdentities.add(identity);
    return Object.freeze({ objectPath, field, disposition: "raw-only" as const });
  }));
  return Object.freeze({
    entries,
    objectFields,
    unknownFields,
    secretLikePaths: uniqueTextArray(
      input.secretLikePaths,
      `${label}.secretLikePaths`,
    ),
  });
}

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
