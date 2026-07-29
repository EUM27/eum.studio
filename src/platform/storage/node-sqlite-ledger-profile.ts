export type Poc3SqliteReadbackValue =
  string | number | boolean | null;

export type Poc3SqliteSettingRequest = {
  readonly applySql: string;
  readonly verifySql: string;
  readonly expectedRows:
    readonly Readonly<
      Record<
        string,
        Poc3SqliteReadbackValue
      >
    >[];
};

export type Poc3RequestedSqliteSettings = {
  readonly journalMode:
    Poc3SqliteSettingRequest;
  readonly synchronous:
    Poc3SqliteSettingRequest;
  readonly foreignKeys:
    Poc3SqliteSettingRequest;
};

export type Poc3StorageOpenProfile = {
  readonly databasePath: string;
  readonly checksumIdentity: string;
  readonly requestedSettings:
    Poc3RequestedSqliteSettings;
  readonly targetSchemaVersion: number;
};

export type Poc3StorageOpenReceipt = {
  readonly databasePath: string;
  readonly checksumIdentity: string;
  readonly targetSchemaVersion: number;
  readonly settingReadbacks:
    Readonly<{
      [TSetting in keyof Poc3RequestedSqliteSettings]:
        Poc3SqliteSettingRequest[
          "expectedRows"
        ];
    }>;
  readonly schemaTableNames:
    readonly string[];
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

function readNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${label}.${field} must be a non-empty string`,
    );
  }
  return value;
}

function readSafeInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new Error(
      `${label}.${field} must be a safe integer`,
    );
  }
  return value;
}

function readExpectedRows(
  value: unknown,
  label: string,
): Poc3SqliteSettingRequest[
  "expectedRows"
] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${label} must be an array`,
    );
  }
  return Object.freeze(
    value.map((entry, index) => {
      const row = readRecord(
        entry,
        `${label}[${index}]`,
      );
      const parsed:
        Record<
          string,
          Poc3SqliteReadbackValue
        > = {};
      for (
        const [column, cell]
        of Object.entries(row)
      ) {
        if (
          column.length === 0 ||
          !(
            cell === null ||
            typeof cell === "string" ||
            typeof cell ===
              "boolean" ||
            (
              typeof cell === "number" &&
              Number.isSafeInteger(cell)
            )
          )
        ) {
          throw new Error(
            `${label}[${index}] has an invalid SQLite readback value`,
          );
        }
        parsed[column] = cell;
      }
      return Object.freeze(parsed);
    }),
  );
}

function readSettingRequest(
  value: unknown,
  label: string,
): Poc3SqliteSettingRequest {
  const input = readRecord(
    value,
    label,
  );
  const fields = [
    "applySql",
    "verifySql",
    "expectedRows",
  ] as const;
  assertExactFields(
    input,
    fields,
    label,
  );
  return Object.freeze({
    applySql:
      readNonEmptyString(
        input,
        "applySql",
        label,
      ),
    verifySql:
      readNonEmptyString(
        input,
        "verifySql",
        label,
      ),
    expectedRows:
      readExpectedRows(
        input.expectedRows,
        `${label}.expectedRows`,
      ),
  });
}

export function parsePoc3StorageOpenProfile(
  value: unknown,
): Poc3StorageOpenProfile {
  const label =
    "POC-3 storage open profile";
  const input = readRecord(
    value,
    label,
  );
  const rootFields = [
    "databasePath",
    "checksumIdentity",
    "requestedSettings",
    "targetSchemaVersion",
  ] as const;
  assertExactFields(
    input,
    rootFields,
    label,
  );

  const settingsLabel =
    `${label}.requestedSettings`;
  const settings = readRecord(
    input.requestedSettings,
    settingsLabel,
  );
  const settingFields = [
    "journalMode",
    "synchronous",
    "foreignKeys",
  ] as const;
  assertExactFields(
    settings,
    settingFields,
    settingsLabel,
  );
  const targetSchemaVersion =
    readSafeInteger(
      input,
      "targetSchemaVersion",
      label,
    );
  if (targetSchemaVersion <= 0) {
    throw new Error(
      `${label}.targetSchemaVersion must be positive`,
    );
  }

  return Object.freeze({
    databasePath:
      readNonEmptyString(
        input,
        "databasePath",
        label,
      ),
    checksumIdentity:
      readNonEmptyString(
        input,
        "checksumIdentity",
        label,
      ),
    requestedSettings:
      Object.freeze({
        journalMode:
          readSettingRequest(
            settings.journalMode,
            `${settingsLabel}.journalMode`,
          ),
        synchronous:
          readSettingRequest(
            settings.synchronous,
            `${settingsLabel}.synchronous`,
          ),
        foreignKeys:
          readSettingRequest(
            settings.foreignKeys,
            `${settingsLabel}.foreignKeys`,
          ),
      }),
    targetSchemaVersion,
  });
}
