import {
  parseChangeBatch,
  type ChangeBatch,
} from "./change-batch";

export class ChangeBatchApplicationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChangeBatchApplicationConflictError";
  }
}

export function applyChangeBatch(
  baseText: string,
  inputBatch: ChangeBatch,
): string {
  const batch = parseChangeBatch(inputBatch);
  if (baseText.length !== batch.beforeTextLengthUtf16) {
    throw new ChangeBatchApplicationConflictError(
      `ChangeBatch ${batch.batchId} expected ${batch.beforeTextLengthUtf16} UTF-16 code units before apply; received ${baseText.length}`,
    );
  }

  const chunks: string[] = [];
  let baseOffset = 0;
  for (const change of batch.changes) {
    chunks.push(
      baseText.slice(baseOffset, change.fromUtf16),
      change.insertedText,
    );
    baseOffset = change.toUtf16;
  }
  chunks.push(baseText.slice(baseOffset));

  const result = chunks.join("");
  if (result.length !== batch.afterTextLengthUtf16) {
    throw new ChangeBatchApplicationConflictError(
      `ChangeBatch ${batch.batchId} produced ${result.length} UTF-16 code units; expected ${batch.afterTextLengthUtf16}`,
    );
  }
  return result;
}
