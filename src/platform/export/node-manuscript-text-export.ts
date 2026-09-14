import { randomUUID } from "node:crypto";
import { open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

export type NodeManuscriptTextExportReceipt = Readonly<{
  finalPath: string;
  byteLength: number;
}>;

export async function exportNodeManuscriptText(input: {
  readonly finalPath: string;
  readonly text: string;
}): Promise<NodeManuscriptTextExportReceipt> {
  if (!path.isAbsolute(input.finalPath)) {
    throw new Error("Manuscript text export path must be absolute");
  }
  const bytes = Buffer.from(input.text, "utf8");
  const temporaryPath = path.join(path.dirname(input.finalPath), `.${randomUUID()}.txt.tmp`);
  const handle = await open(temporaryPath, "wx", 0o600);
  try {
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    const staged = await readFile(temporaryPath);
    if (!staged.equals(bytes)) {
      throw new Error("Staged manuscript text does not match approved bytes");
    }
    // Same-directory rename is the commit point. Never unlink/truncate the
    // destination first: a Windows sharing violation must preserve the old TXT.
    await rename(temporaryPath, input.finalPath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Manuscript export failed and its temporary file could not be removed", { cause: cleanupError });
    }
    throw error;
  }
  return Object.freeze({
    finalPath: input.finalPath,
    byteLength: bytes.byteLength,
  });
}
