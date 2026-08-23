export type ManuscriptBlankLineCount = 0 | 1 | 2;

export function formatManuscriptBlankLines(
  source: string,
  blankLineCount: ManuscriptBlankLineCount,
): string {
  const separator = "\n".repeat(blankLineCount + 1);
  return source
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join(separator);
}
