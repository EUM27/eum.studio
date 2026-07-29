import {
  assertJournalChecksumAdapter,
  computeJournalChecksum,
  type JournalChecksumAdapter,
  type ResolveJournalChecksumAdapter,
} from "./journal-checksum";

const HEADER_LENGTH_PREFIX_BYTE_LENGTH = 4;
const JOURNAL_ENTRY_SCHEMA_VERSION = 1;
const JOURNAL_ENTRY_TYPE = "journal-entry";

type JournalFrameHeader = readonly [
  typeof JOURNAL_ENTRY_TYPE,
  typeof JOURNAL_ENTRY_SCHEMA_VERSION,
  string,
  number,
  number,
];

export type VerifiedJournalFrame = {
  readonly checksumAdapterId: string;
  readonly payload: Uint8Array;
  readonly frameStartByteOffset: number;
  readonly frameEndByteOffset: number;
};

export type JournalFrameTailReason =
  | "truncated-length-prefix"
  | "truncated-header"
  | "invalid-header"
  | "truncated-record"
  | "unsupported-checksum"
  | "checksum-mismatch";

export type JournalFrameTail = {
  readonly byteOffset: number;
  readonly reason: JournalFrameTailReason;
  readonly bytes: Uint8Array;
};

export type JournalFrameScanResult = {
  readonly records: readonly VerifiedJournalFrame[];
  readonly verifiedPrefixByteLength: number;
  readonly tail: JournalFrameTail | null;
};

function concatenateBytes(
  chunks: readonly Uint8Array[],
): Uint8Array {
  const byteLength = chunks.reduce(
    (total, chunk) => total + chunk.byteLength,
    0,
  );
  if (!Number.isSafeInteger(byteLength)) {
    throw new Error("Journal frame byte length is not representable");
  }

  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function encodeHeader(header: JournalFrameHeader): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(header));
}

function createHeader(input: {
  readonly checksumAdapterId: string;
  readonly payloadByteLength: number;
  readonly checksumByteLength: number;
}): JournalFrameHeader {
  return Object.freeze([
    JOURNAL_ENTRY_TYPE,
    JOURNAL_ENTRY_SCHEMA_VERSION,
    input.checksumAdapterId,
    input.payloadByteLength,
    input.checksumByteLength,
  ]);
}

function encodeHeaderLength(byteLength: number): Uint8Array {
  const prefix = new Uint8Array(HEADER_LENGTH_PREFIX_BYTE_LENGTH);
  const view = new DataView(prefix.buffer);
  view.setUint32(0, byteLength, false);
  if (view.getUint32(0, false) !== byteLength) {
    throw new Error(
      "Journal canonical header exceeds its framing prefix",
    );
  }
  return prefix;
}

function equalBytes(
  first: Uint8Array,
  second: Uint8Array,
): boolean {
  if (first.byteLength !== second.byteLength) {
    return false;
  }
  for (let index = 0; index < first.byteLength; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }
  return true;
}

function readHeader(headerBytes: Uint8Array): JournalFrameHeader | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(headerBytes),
    );
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== 5) {
    return null;
  }

  const [entryType, schemaVersion, adapterId, payloadLength, checksumLength] =
    parsed;
  if (
    entryType !== JOURNAL_ENTRY_TYPE ||
    schemaVersion !== JOURNAL_ENTRY_SCHEMA_VERSION ||
    typeof adapterId !== "string" ||
    adapterId.length === 0 ||
    typeof payloadLength !== "number" ||
    !Number.isSafeInteger(payloadLength) ||
    payloadLength < 0 ||
    typeof checksumLength !== "number" ||
    !Number.isSafeInteger(checksumLength) ||
    checksumLength <= 0
  ) {
    return null;
  }

  const header = createHeader({
    checksumAdapterId: adapterId,
    payloadByteLength: payloadLength,
    checksumByteLength: checksumLength,
  });
  return equalBytes(encodeHeader(header), headerBytes) ? header : null;
}

function tailResult(
  source: Uint8Array,
  records: readonly VerifiedJournalFrame[],
  byteOffset: number,
  reason: JournalFrameTailReason,
): JournalFrameScanResult {
  return Object.freeze({
    records: Object.freeze([...records]),
    verifiedPrefixByteLength: byteOffset,
    tail: Object.freeze({
      byteOffset,
      reason,
      bytes: source.slice(byteOffset),
    }),
  });
}

export async function encodeJournalFrame(
  sourcePayload: Uint8Array,
  checksumAdapter: JournalChecksumAdapter,
): Promise<Uint8Array> {
  assertJournalChecksumAdapter(checksumAdapter);
  const payload = new Uint8Array(sourcePayload);
  const header = createHeader({
    checksumAdapterId: checksumAdapter.id,
    payloadByteLength: payload.byteLength,
    checksumByteLength: checksumAdapter.byteLength,
  });
  const headerBytes = encodeHeader(header);
  const checksumInput = concatenateBytes([headerBytes, payload]);
  const checksum = await computeJournalChecksum(
    checksumAdapter,
    checksumInput,
  );

  return concatenateBytes([
    encodeHeaderLength(headerBytes.byteLength),
    headerBytes,
    payload,
    checksum,
  ]);
}

export async function scanJournalFrames(
  sourceBytes: Uint8Array,
  resolveChecksumAdapter: ResolveJournalChecksumAdapter,
): Promise<JournalFrameScanResult> {
  const source = new Uint8Array(sourceBytes);
  const records: VerifiedJournalFrame[] = [];
  let byteOffset = 0;

  while (byteOffset < source.byteLength) {
    const frameStartByteOffset = byteOffset;
    if (
      source.byteLength - byteOffset <
      HEADER_LENGTH_PREFIX_BYTE_LENGTH
    ) {
      return tailResult(
        source,
        records,
        frameStartByteOffset,
        "truncated-length-prefix",
      );
    }

    const prefixView = new DataView(
      source.buffer,
      source.byteOffset + byteOffset,
      HEADER_LENGTH_PREFIX_BYTE_LENGTH,
    );
    const headerByteLength = prefixView.getUint32(0, false);
    byteOffset += HEADER_LENGTH_PREFIX_BYTE_LENGTH;
    if (headerByteLength > source.byteLength - byteOffset) {
      return tailResult(
        source,
        records,
        frameStartByteOffset,
        "truncated-header",
      );
    }

    const headerBytes = source.slice(
      byteOffset,
      byteOffset + headerByteLength,
    );
    const header = readHeader(headerBytes);
    if (header === null) {
      return tailResult(
        source,
        records,
        frameStartByteOffset,
        "invalid-header",
      );
    }
    byteOffset += headerByteLength;

    const [, , adapterId, payloadByteLength, checksumByteLength] =
      header;
    const recordRemainderByteLength =
      payloadByteLength + checksumByteLength;
    if (
      !Number.isSafeInteger(recordRemainderByteLength) ||
      recordRemainderByteLength > source.byteLength - byteOffset
    ) {
      return tailResult(
        source,
        records,
        frameStartByteOffset,
        "truncated-record",
      );
    }

    const payload = source.slice(
      byteOffset,
      byteOffset + payloadByteLength,
    );
    byteOffset += payloadByteLength;
    const actualChecksum = source.slice(
      byteOffset,
      byteOffset + checksumByteLength,
    );
    byteOffset += checksumByteLength;

    const checksumAdapter = resolveChecksumAdapter(adapterId);
    if (
      checksumAdapter === null ||
      checksumAdapter.id !== adapterId ||
      checksumAdapter.byteLength !== checksumByteLength
    ) {
      return tailResult(
        source,
        records,
        frameStartByteOffset,
        "unsupported-checksum",
      );
    }

    const expectedChecksum = await computeJournalChecksum(
      checksumAdapter,
      concatenateBytes([headerBytes, payload]),
    );
    if (!equalBytes(actualChecksum, expectedChecksum)) {
      return tailResult(
        source,
        records,
        frameStartByteOffset,
        "checksum-mismatch",
      );
    }

    records.push(
      Object.freeze({
        checksumAdapterId: adapterId,
        payload,
        frameStartByteOffset,
        frameEndByteOffset: byteOffset,
      }),
    );
  }

  return Object.freeze({
    records: Object.freeze(records),
    verifiedPrefixByteLength: source.byteLength,
    tail: null,
  });
}
