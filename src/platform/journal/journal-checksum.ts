export type JournalChecksumAdapter = {
  readonly id: string;
  readonly byteLength: number;
  digest(input: Uint8Array): Promise<Uint8Array>;
};

export type ResolveJournalChecksumAdapter = (
  adapterId: string,
) => JournalChecksumAdapter | null;

export function assertJournalChecksumAdapter(
  adapter: JournalChecksumAdapter,
): void {
  if (adapter.id.length === 0) {
    throw new Error("Journal checksum adapter identity must be non-empty");
  }
  if (
    !Number.isSafeInteger(adapter.byteLength) ||
    adapter.byteLength <= 0
  ) {
    throw new Error(
      "Journal checksum byteLength must be a positive safe integer",
    );
  }
}

export async function computeJournalChecksum(
  adapter: JournalChecksumAdapter,
  input: Uint8Array,
): Promise<Uint8Array> {
  assertJournalChecksumAdapter(adapter);
  const checksum = await adapter.digest(input);
  if (checksum.byteLength !== adapter.byteLength) {
    throw new Error(
      `Journal checksum adapter ${adapter.id} returned ${checksum.byteLength} bytes; expected ${adapter.byteLength}`,
    );
  }
  return new Uint8Array(checksum);
}
