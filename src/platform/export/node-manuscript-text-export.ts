import { open, readFile } from "node:fs/promises";
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
  const handle = await open(input.finalPath, "w");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  const published = await readFile(input.finalPath);
  if (!published.equals(bytes)) {
    throw new Error("Published manuscript text does not match approved bytes");
  }
  return Object.freeze({
    finalPath: input.finalPath,
    byteLength: published.byteLength,
  });
}
