import {
  createHash,
} from "node:crypto";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
  type NodeSqliteMigrationChecksumAdapter,
} from "../platform/storage/node-sqlite-migration";
import {
  checksumPoc3MigrationCrashGateProfile,
  createPoc3MigrationCrashGate,
  parsePoc3MigrationCrashCallerChecksum,
  parsePoc3MigrationCrashGateProfile,
  type Poc3MigrationCrashCallerChecksum,
  type Poc3MigrationCrashGateProfile,
} from "./poc-3-migration-crash-gate-profile";

type Poc3MigrationCrashWorkerCommand = {
  readonly type:
    "poc-3-migration-crash-worker-run";
  readonly callerChecksum:
    Poc3MigrationCrashCallerChecksum;
  readonly profile:
    Poc3MigrationCrashGateProfile;
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

function parseWorkerCommand(
  value: unknown,
): Poc3MigrationCrashWorkerCommand {
  const label =
    "POC-3 migration crash worker command";
  const input = readRecord(
    value,
    label,
  );
  const fields = [
    "type",
    "callerChecksum",
    "profile",
  ] as const;
  const expected =
    new Set<string>(
      fields,
    );
  for (
    const field
    of Object.keys(input)
  ) {
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
  if (
    input.type !==
    "poc-3-migration-crash-worker-run"
  ) {
    throw new Error(
      `Unsupported ${label} type: ${String(input.type)}`,
    );
  }
  const profile =
    parsePoc3MigrationCrashGateProfile(
      input.profile,
    );
  const callerChecksum =
    parsePoc3MigrationCrashCallerChecksum(
      input.callerChecksum,
    );
  const actualChecksum =
    checksumPoc3MigrationCrashGateProfile(
      profile,
      callerChecksum.algorithm,
    );
  if (
    actualChecksum !==
    callerChecksum.value
  ) {
    throw new Error(
      "POC-3 migration crash caller checksum mismatch",
    );
  }
  return Object.freeze({
    type:
      "poc-3-migration-crash-worker-run",
    callerChecksum,
    profile,
  });
}

function createChecksumAdapter(
  profile:
    Poc3MigrationCrashGateProfile,
): NodeSqliteMigrationChecksumAdapter {
  const checksumProfile =
    profile.migration.checksum;
  const encoder =
    new TextEncoder();
  return Object.freeze({
    identity:
      checksumProfile.identity,
    canonicalTextBytes: (
      value: string,
    ) =>
      encoder.encode(value),
    checksum: (
      bytes: Uint8Array,
    ) =>
      createHash(
        checksumProfile.algorithm,
      )
        .update(bytes)
        .digest("hex"),
  });
}

function createCatalog(
  profile:
    Poc3MigrationCrashGateProfile,
): readonly NodeSqliteMigrationCatalogStep[] {
  return Object.freeze(
    profile.migration.catalog
      .map((step) =>
        Object.freeze({
          migrationId:
            step.migrationId,
          fromSchemaVersion:
            step.fromSchemaVersion,
          toSchemaVersion:
            step.toSchemaVersion,
          definitionBytes:
            Uint8Array.from(
              step.definitionBytes,
            ),
          expectedDefinitionChecksumValue:
            step
              .expectedDefinitionChecksumValue,
          statements:
            Object.freeze([
              ...step.statements,
            ]),
          verification:
            step.verification,
          logicalSnapshot:
            step.logicalSnapshot,
        }),
      ),
  );
}

function createClock(
  profile:
    Poc3MigrationCrashGateProfile,
): {
  now(): string;
} {
  const values =
    profile.migration.catalog
      .flatMap((step) => [
        step.startedAt,
        step.completedAt,
      ]);
  let offset = 0;
  return Object.freeze({
    now: () => {
      const value =
        values[offset];
      if (value === undefined) {
        throw new Error(
          "Caller migration clock values are exhausted",
        );
      }
      offset += 1;
      return value;
    },
  });
}

function createReceiptIdFactory(
  profile:
    Poc3MigrationCrashGateProfile,
): {
  create(
    migrationId: string,
  ): string;
} {
  const receiptIds =
    new Map(
      profile.migration.catalog
        .map((step) => [
          step.migrationId,
          step.receiptId,
        ] as const),
    );
  return Object.freeze({
    create: (
      migrationId: string,
    ): string => {
      const receiptId =
        receiptIds.get(
          migrationId,
        );
      if (receiptId === undefined) {
        throw new Error(
          "Caller migration receipt identity is missing",
        );
      }
      return receiptId;
    },
  });
}

async function runWorkerCommand(
  value: unknown,
): Promise<void> {
  const command =
    parseWorkerCommand(value);
  const gate =
    createPoc3MigrationCrashGate({
      profile:
        command.profile,
      callerChecksum:
        command.callerChecksum,
      enterPending: () =>
        new Promise<void>(
          () => {
            // The parent harness terminates this process.
          },
        ),
    });
  await runNodeSqliteStorageMigration({
    databasePath:
      command.profile
        .storageOpenProfile
        .databasePath,
    requestedSettings:
      command.profile
        .storageOpenProfile
        .requestedSettings,
    targetSchemaVersion:
      command.profile
        .migration
        .targetSchemaVersion,
    catalog:
      createCatalog(
        command.profile,
      ),
    checksum:
      createChecksumAdapter(
        command.profile,
      ),
    clock:
      createClock(
        command.profile,
      ),
    receiptIdFactory:
      createReceiptIdFactory(
        command.profile,
      ),
    beforeCommit:
      gate.beforeCommit,
  });
  process.send?.({
    type:
      "poc-3-migration-crash-worker-completed",
  });
}

if (
  process.env
    .EUM_STUDIO_POC_3_MIGRATION_CRASH_WORKER ===
    "1"
) {
  if (
    process.send === undefined
  ) {
    throw new Error(
      "POC-3 migration crash worker requires an IPC parent",
    );
  }
  process.on(
    "message",
    (value: unknown) => {
      void runWorkerCommand(
        value,
      ).catch(
        (error: unknown) => {
          process.send?.({
            type:
              "poc-3-migration-crash-worker-failed",
            errorName:
              error instanceof Error
                ? error.name
                : typeof error,
          });
        },
      );
    },
  );
  process.send({
    type:
      "poc-3-migration-crash-worker-ready",
  });
}
