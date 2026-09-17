import {
  execFileSync,
  spawn,
} from "node:child_process";
import {
  createHash,
} from "node:crypto";
import {
  readFile,
} from "node:fs/promises";
import {
  isAbsolute,
  relative,
  resolve,
} from "node:path";

export type GitSourceProvenance = {
  readonly commit: string;
  readonly branch: string;
  readonly dirty: boolean;
  readonly dirtyStatusChecksum: string;
  readonly trackedDiffChecksum: string;
  readonly untrackedFileCount: number;
  readonly untrackedContentChecksum: string;
  readonly sourceFingerprint: string;
};

function gitBytes(
  cwd: string,
  args: readonly string[],
): Buffer {
  return execFileSync(
    "git",
    [...args],
    {
      cwd,
      encoding: "buffer",
    },
  );
}

function gitText(
  cwd: string,
  args: readonly string[],
): string {
  return gitBytes(cwd, args)
    .toString("utf8")
    .trim();
}

async function gitChecksum(cwd: string, args: readonly string[], algorithm: string): Promise<string> {
  const hash = createHash(algorithm);
  const child = spawn("git", [...args], { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let errorText = "";
  child.stdout.on("data", (chunk: Buffer) => hash.update(chunk));
  child.stderr.on("data", (chunk: Buffer) => { errorText += chunk.toString("utf8"); });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Git provenance command exited ${code}: ${errorText.trim()}`));
    });
  });
  return hash.digest("hex");
}

function digest(
  algorithm: string,
  bytes: Uint8Array,
): string {
  return createHash(algorithm)
    .update(bytes)
    .digest("hex");
}

function splitNullTerminatedPaths(
  bytes: Uint8Array,
): readonly string[] {
  const paths: string[] = [];
  let start = 0;
  for (
    let index = 0;
    index < bytes.byteLength;
    index += 1
  ) {
    if (bytes[index] !== 0) {
      continue;
    }
    if (index > start) {
      paths.push(
        Buffer.from(
          bytes.subarray(start, index),
        ).toString("utf8"),
      );
    }
    start = index + 1;
  }
  if (start !== bytes.byteLength) {
    throw new Error(
      "Git path output was not null terminated",
    );
  }
  return Object.freeze(paths);
}

function resolveRepositoryPath(
  cwd: string,
  repositoryPath: string,
): string {
  const root = resolve(cwd);
  const target = resolve(root, repositoryPath);
  const fromRoot = relative(root, target);
  if (
    fromRoot.length === 0 ||
    fromRoot === ".." ||
    fromRoot.startsWith("../") ||
    fromRoot.startsWith("..\\") ||
    isAbsolute(fromRoot)
  ) {
    throw new Error(
      "Git reported a path outside the repository",
    );
  }
  return target;
}

export async function captureGitSourceProvenance(
  input: {
    readonly cwd: string;
    readonly checksumAlgorithm: string;
  },
): Promise<GitSourceProvenance> {
  createHash(
    input.checksumAlgorithm,
  ).digest();
  const status = gitBytes(
    input.cwd,
    [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ],
  );
  const trackedDiffChecksum = await gitChecksum(
    input.cwd,
    [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--binary",
      "HEAD",
      "--",
    ],
    input.checksumAlgorithm,
  );
  const untrackedPaths = [
    ...splitNullTerminatedPaths(
      gitBytes(
        input.cwd,
        [
          "ls-files",
          "--others",
          "--exclude-standard",
          "-z",
        ],
      ),
    ),
  ].sort((left, right) =>
    left < right
      ? -1
      : left > right
        ? 1
        : 0,
  );
  const untrackedEntries: (
    readonly [
      string,
      number,
      string,
    ]
  )[] = [];
  for (const repositoryPath of untrackedPaths) {
    const content = await readFile(
      resolveRepositoryPath(
        input.cwd,
        repositoryPath,
      ),
    );
    untrackedEntries.push(
      Object.freeze([
        repositoryPath.replaceAll(
          "\\",
          "/",
        ),
        content.byteLength,
        digest(
          input.checksumAlgorithm,
          content,
        ),
      ]),
    );
  }
  const dirtyStatusChecksum = digest(
    input.checksumAlgorithm,
    status,
  );
  const untrackedContentChecksum =
    digest(
      input.checksumAlgorithm,
      new TextEncoder().encode(
        JSON.stringify(
          untrackedEntries,
        ),
      ),
    );
  const commit = gitText(
    input.cwd,
    ["rev-parse", "HEAD"],
  );
  const branch = gitText(
    input.cwd,
    [
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ],
  );
  return Object.freeze({
    commit,
    branch,
    dirty: status.byteLength > 0,
    dirtyStatusChecksum,
    trackedDiffChecksum,
    untrackedFileCount:
      untrackedEntries.length,
    untrackedContentChecksum,
    sourceFingerprint: digest(
      input.checksumAlgorithm,
      new TextEncoder().encode(
        JSON.stringify([
          commit,
          dirtyStatusChecksum,
          trackedDiffChecksum,
          untrackedContentChecksum,
        ]),
      ),
    ),
  });
}
