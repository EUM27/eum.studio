export type ReadTextFile = (filePath: string) => string;

export function readRuntimeProfileValue(input: {
  readonly inlineJson: string | undefined;
  readonly filePath: string | undefined;
  readonly readTextFile: ReadTextFile;
}): unknown | null {
  if (input.inlineJson !== undefined && input.filePath !== undefined) {
    throw new Error(
      "Runtime profile cannot use both inline JSON and a file path",
    );
  }
  if (input.inlineJson !== undefined) {
    return JSON.parse(input.inlineJson) as unknown;
  }
  if (input.filePath !== undefined) {
    return JSON.parse(input.readTextFile(input.filePath)) as unknown;
  }
  return null;
}
