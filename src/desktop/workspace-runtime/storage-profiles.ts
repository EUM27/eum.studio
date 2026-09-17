import { createHash } from "node:crypto";
import path from "node:path";
import { encodeDurableText } from "../../application/persistence/change-batch";
import type { RevisionBlobProfile } from "../../application/revisions/revision-store";
import { parseNodeImmutableBlobStoreProfile } from "../../platform/storage/node-immutable-blob-store-profile";
import { parsePoc3StorageOpenProfile } from "../../platform/storage/node-sqlite-ledger-profile";
import type { NodeSqliteModule } from "./storage-contracts";

export const LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION = 26;

export const LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY =
  "eum-studio-ledger-sha256-v1";

export const LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY =
  "eum-studio-manuscript-utf16le-v1";

export const LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM = "sha256";

export function loadNodeSqlite(): NodeSqliteModule {
  const loaded = process.getBuiltinModule(
    "node:sqlite",
  ) as NodeSqliteModule | undefined;
  if (loaded === undefined) {
    throw new Error("node:sqlite is unavailable");
  }
  return loaded;
}

export function decodeDurableText(bytes: Uint8Array): string {
  if (bytes.byteLength % 2 !== 0) {
    throw new Error("Durable manuscript bytes must contain complete UTF-16 code units");
  }
  const codeUnits = new Uint16Array(bytes.byteLength / 2);
  for (let index = 0; index < codeUnits.length; index += 1) {
    codeUnits[index] =
      (bytes[index * 2] ?? 0) |
      ((bytes[index * 2 + 1] ?? 0) << 8);
  }
  const chunks: string[] = [];
  const chunkSize = 16_384;
  for (let index = 0; index < codeUnits.length; index += chunkSize) {
    chunks.push(
      String.fromCharCode(
        ...codeUnits.subarray(index, index + chunkSize),
      ),
    );
  }
  return chunks.join("");
}

export function createLocalWorkspaceRevisionBlobProfile(
  findStoredManifestCreatedAt: (blobRef: string) => string | null = () => null,
): RevisionBlobProfile {
  const manifestCreatedAtByBlobRef = new Map<string, string>();
  const blobRefForAddress = (address: {
    readonly checksumIdentity: string;
    readonly checksumValue: string;
  }) =>
    JSON.stringify([
      LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY,
      address.checksumIdentity,
      address.checksumValue,
    ]);
  return Object.freeze({
    codec: Object.freeze({
      identity: LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY,
      encode: encodeDurableText,
      decode: decodeDurableText,
      describe: (content: string) => {
        const bytes = encodeDurableText(content);
        return Object.freeze({
          contentHash: createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
            .update(bytes)
            .digest("hex"),
          length: content.length,
        });
      },
    }),
    blobRefForAddress,
    addressForBlobRef: (blobRef) => {
      const decoded = JSON.parse(blobRef) as readonly unknown[];
      if (
        decoded.length !== 3 ||
        decoded[0] !== LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY ||
        typeof decoded[1] !== "string" ||
        typeof decoded[2] !== "string"
      ) {
        throw new Error("Stored manuscript blob reference is invalid");
      }
      return Object.freeze({
        checksumIdentity: decoded[1],
        checksumValue: decoded[2],
      });
    },
    metadataForAppend: (input) =>
      Object.freeze({
        kind: "manuscript-revision",
        workId: input.workId,
        documentId: input.documentId,
        revisionId: input.revisionId,
      }),
    temporaryEntryIdentityForAppend: (input) =>
      input.revisionId,
    manifestMetadataForAppend: (input) => {
      const bytes = encodeDurableText(input.content);
      const blobRef = blobRefForAddress({
        checksumIdentity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
        checksumValue: createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
          .update(bytes)
          .digest("hex"),
      });
      let createdAt = manifestCreatedAtByBlobRef.get(blobRef);
      if (createdAt === undefined) {
        createdAt = findStoredManifestCreatedAt(blobRef) ?? input.createdAt;
        manifestCreatedAtByBlobRef.set(blobRef, createdAt);
      }
      return Object.freeze({
        createdAt,
        mediaType: "text/plain; charset=utf-16le",
      });
    },
  });
}

export function createLocalWorkspaceStorageProfiles(
  rootDirectoryPath: string,
) {
  const databasePath = path.join(
    rootDirectoryPath,
    "workspace.sqlite3",
  );
  const ledgerProfile = parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
    requestedSettings: {
      journalMode: {
        applySql: "PRAGMA journal_mode = WAL",
        verifySql: "PRAGMA journal_mode",
        expectedRows: [{ journal_mode: "wal" }],
      },
      synchronous: {
        applySql: "PRAGMA synchronous = FULL",
        verifySql: "PRAGMA synchronous",
        expectedRows: [{ synchronous: 2 }],
      },
      foreignKeys: {
        applySql: "PRAGMA foreign_keys = ON",
        verifySql: "PRAGMA foreign_keys",
        expectedRows: [{ foreign_keys: 1 }],
      },
    },
    targetSchemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
  });
  const blobStoreProfile = parseNodeImmutableBlobStoreProfile({
    rootDirectoryPath,
    checksum: {
      identity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
      algorithm: LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    },
    publishedLayout: {
      directorySegments: ["blobs", "published"],
      shardWidths: [2, 2],
      fileNamePrefix: "",
      fileNameSuffix: ".blob",
    },
    temporaryLayout: {
      directorySegments: ["blobs", "temporary"],
    },
  });
  return Object.freeze({
    databasePath,
    ledgerProfile,
    blobStoreProfile,
  });
}

