import {
  basename,
  isAbsolute,
  resolve,
} from "node:path";

export type NodeImmutableBlobStoreProfile = {
  readonly rootDirectoryPath: string;
  readonly checksum: {
    readonly identity: string;
    readonly algorithm: string;
  };
  readonly publishedLayout: {
    readonly directorySegments:
      readonly string[];
    readonly shardWidths:
      readonly number[];
    readonly fileNamePrefix:
      string;
    readonly fileNameSuffix:
      string;
  };
  readonly temporaryLayout: {
    readonly directorySegments:
      readonly string[];
  };
};

function readRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} must be an object`,
    );
  }
  return value as Record<
    string,
    unknown
  >;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(
        `Unsupported ${label} field: ${field}`,
      );
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(
        `${label} is missing ${field}`,
      );
    }
  }
}

function readString(
  input: Record<string, unknown>,
  field: string,
  label: string,
  allowEmpty: boolean,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    (
      !allowEmpty &&
      value.length === 0
    )
  ) {
    throw new Error(
      `${label}.${field} must be a string`,
    );
  }
  return value;
}

function readPathSegments(
  value: unknown,
  label: string,
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${label} must be an array`,
    );
  }
  return Object.freeze(
    value.map((entry, index) => {
      if (
        typeof entry !== "string" ||
        entry.length === 0 ||
        basename(entry) !== entry ||
        entry === "." ||
        entry === ".."
      ) {
        throw new Error(
          `${label}[${index}] must be one relative path segment`,
        );
      }
      return entry;
    }),
  );
}

function readShardWidths(
  value: unknown,
  label: string,
): readonly number[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${label} must be an array`,
    );
  }
  return Object.freeze(
    value.map((entry, index) => {
      if (
        typeof entry !== "number" ||
        !Number.isSafeInteger(entry) ||
        entry <= 0
      ) {
        throw new Error(
          `${label}[${index}] must be a positive safe integer`,
        );
      }
      return entry;
    }),
  );
}

function assertFileNameFragment(
  value: string,
  label: string,
): void {
  if (
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new Error(
      `${label} must not contain a path separator`,
    );
  }
}

export function parseNodeImmutableBlobStoreProfile(
  value: unknown,
): NodeImmutableBlobStoreProfile {
  const label =
    "Node immutable blob store profile";
  const input = readRecord(
    value,
    label,
  );
  assertExactFields(
    input,
    [
      "rootDirectoryPath",
      "checksum",
      "publishedLayout",
      "temporaryLayout",
    ],
    label,
  );
  const rootDirectoryPath =
    readString(
      input,
      "rootDirectoryPath",
      label,
      false,
    );
  if (
    !isAbsolute(
      rootDirectoryPath,
    )
  ) {
    throw new Error(
      `${label}.rootDirectoryPath must be absolute`,
    );
  }

  const checksumLabel =
    `${label}.checksum`;
  const checksum = readRecord(
    input.checksum,
    checksumLabel,
  );
  assertExactFields(
    checksum,
    [
      "identity",
      "algorithm",
    ],
    checksumLabel,
  );

  const publishedLabel =
    `${label}.publishedLayout`;
  const published = readRecord(
    input.publishedLayout,
    publishedLabel,
  );
  assertExactFields(
    published,
    [
      "directorySegments",
      "shardWidths",
      "fileNamePrefix",
      "fileNameSuffix",
    ],
    publishedLabel,
  );
  const fileNamePrefix =
    readString(
      published,
      "fileNamePrefix",
      publishedLabel,
      true,
    );
  const fileNameSuffix =
    readString(
      published,
      "fileNameSuffix",
      publishedLabel,
      true,
    );
  assertFileNameFragment(
    fileNamePrefix,
    `${publishedLabel}.fileNamePrefix`,
  );
  assertFileNameFragment(
    fileNameSuffix,
    `${publishedLabel}.fileNameSuffix`,
  );

  const temporaryLabel =
    `${label}.temporaryLayout`;
  const temporary = readRecord(
    input.temporaryLayout,
    temporaryLabel,
  );
  assertExactFields(
    temporary,
    [
      "directorySegments",
    ],
    temporaryLabel,
  );

  return Object.freeze({
    rootDirectoryPath:
      resolve(rootDirectoryPath),
    checksum: Object.freeze({
      identity:
        readString(
          checksum,
          "identity",
          checksumLabel,
          false,
        ),
      algorithm:
        readString(
          checksum,
          "algorithm",
          checksumLabel,
          false,
        ),
    }),
    publishedLayout:
      Object.freeze({
        directorySegments:
          readPathSegments(
            published
              .directorySegments,
            `${publishedLabel}.directorySegments`,
          ),
        shardWidths:
          readShardWidths(
            published.shardWidths,
            `${publishedLabel}.shardWidths`,
          ),
        fileNamePrefix,
        fileNameSuffix,
      }),
    temporaryLayout:
      Object.freeze({
        directorySegments:
          readPathSegments(
            temporary
              .directorySegments,
            `${temporaryLabel}.directorySegments`,
          ),
      }),
  });
}
