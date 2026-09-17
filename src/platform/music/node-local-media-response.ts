import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

type ByteRange = Readonly<{ start: number; end: number }>;

function parseByteRange(value: string, size: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim());
  if (match === null || size <= 0) return null;
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (startText.length === 0) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return Object.freeze({
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    });
  }
  const start = Number(startText);
  const requestedEnd = endText.length === 0 ? size - 1 : Number(endText);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= size
  ) {
    return null;
  }
  return Object.freeze({ start, end: Math.min(requestedEnd, size - 1) });
}

function streamBody(
  filePath: string,
  range: ByteRange | null,
): BodyInit {
  const stream = range === null
    ? createReadStream(filePath)
    : createReadStream(filePath, { start: range.start, end: range.end });
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export async function createNodeLocalMediaResponse(input: {
  readonly filePath: string;
  readonly mediaType: string;
  readonly method: "GET" | "HEAD";
  readonly rangeHeader: string | null;
}): Promise<Response> {
  const fileStat = await stat(input.filePath);
  if (!fileStat.isFile()) {
    return new Response(null, { status: 404 });
  }
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": input.mediaType,
  });
  if (input.rangeHeader !== null) {
    const range = parseByteRange(input.rangeHeader, fileStat.size);
    if (range === null) {
      headers.set("Content-Range", `bytes */${fileStat.size}`);
      return new Response(null, { status: 416, headers });
    }
    const contentLength = range.end - range.start + 1;
    headers.set("Content-Length", String(contentLength));
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${fileStat.size}`,
    );
    return new Response(
      input.method === "HEAD" ? null : streamBody(input.filePath, range),
      { status: 206, headers },
    );
  }
  headers.set("Content-Length", String(fileStat.size));
  return new Response(
    input.method === "HEAD" ? null : streamBody(input.filePath, null),
    { status: 200, headers },
  );
}
