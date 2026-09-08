import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  execFileSync,
} from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  join,
  resolve,
} from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  captureGitSourceProvenance,
} from "./git-source-provenance";

const temporaryDirectories: string[] = [];

function selectHashAlgorithm(): string {
  const algorithms = getHashes().filter(
    (algorithm) => {
      try {
        createHash(algorithm).digest();
        return true;
      } catch {
        return false;
      }
    },
  );
  const selected =
    algorithms[randomInt(0, algorithms.length)];
  if (selected === undefined) {
    throw new Error(
      "Test runtime exposes no hash algorithm",
    );
  }
  return selected;
}

afterEach(async () => {
  const temporaryRoot = resolve(tmpdir());
  for (
    const directory of temporaryDirectories.splice(0)
  ) {
    const resolved = resolve(directory);
    if (
      resolved === temporaryRoot ||
      !resolved.startsWith(
        `${temporaryRoot}\\`,
      )
    ) {
      throw new Error(
        "Refusing to remove a test directory outside the OS temporary root",
      );
    }
    await rm(resolved, {
      recursive: true,
      force: true,
    });
  }
});

async function createRepository() {
  const directory = await mkdtemp(
    join(tmpdir(), randomUUID()),
  );
  temporaryDirectories.push(directory);
  execFileSync("git", ["init"], {
    cwd: directory,
    stdio: "ignore",
  });
  execFileSync(
    "git",
    [
      "config",
      "user.name",
      randomUUID(),
    ],
    {
      cwd: directory,
      stdio: "ignore",
    },
  );
  execFileSync(
    "git",
    [
      "config",
      "user.email",
      `${randomUUID()}@example.invalid`,
    ],
    {
      cwd: directory,
      stdio: "ignore",
    },
  );
  const trackedPath = join(
    directory,
    randomUUID(),
  );
  await writeFile(
    trackedPath,
    randomUUID(),
  );
  execFileSync("git", ["add", "."], {
    cwd: directory,
    stdio: "ignore",
  });
  execFileSync(
    "git",
    ["commit", "-m", randomUUID()],
    {
      cwd: directory,
      stdio: "ignore",
    },
  );
  return {
    directory,
    trackedPath,
  };
}

describe("git source provenance", () => {
  it("streams a diff larger than the child-process output buffer and hashes its final bytes", async () => {
    const { directory, trackedPath } = await createRepository();
    const checksumAlgorithm = selectHashAlgorithm();
    const content = randomUUID().repeat(2 ** 16);
    await writeFile(trackedPath, `${content}\n${randomUUID()}`);
    const first = await captureGitSourceProvenance({ cwd: directory, checksumAlgorithm });
    await writeFile(trackedPath, `${content}\n${randomUUID()}`);
    const second = await captureGitSourceProvenance({ cwd: directory, checksumAlgorithm });
    expect(first.dirty).toBe(true);
    expect(second.trackedDiffChecksum).not.toBe(first.trackedDiffChecksum);
    expect(second.sourceFingerprint).not.toBe(first.sourceFingerprint);
  });

  it("fingerprints untracked file contents even when porcelain status and tracked diff stay unchanged", async () => {
    const repository =
      await createRepository();
    const nestedDirectory = join(
      repository.directory,
      randomUUID(),
    );
    await mkdir(nestedDirectory);
    const untrackedPath = join(
      nestedDirectory,
      randomUUID(),
    );
    const firstContent = randomUUID();
    let secondContent = randomUUID();
    while (
      secondContent.length !==
      firstContent.length
    ) {
      secondContent = randomUUID();
    }
    await writeFile(
      untrackedPath,
      firstContent,
    );
    const algorithm =
      selectHashAlgorithm();

    const first =
      await captureGitSourceProvenance({
        cwd: repository.directory,
        checksumAlgorithm: algorithm,
      });
    const repeated =
      await captureGitSourceProvenance({
        cwd: repository.directory,
        checksumAlgorithm: algorithm,
      });
    await writeFile(
      untrackedPath,
      secondContent,
    );
    const second =
      await captureGitSourceProvenance({
        cwd: repository.directory,
        checksumAlgorithm: algorithm,
      });

    expect(repeated).toEqual(first);
    expect(
      second.dirtyStatusChecksum,
    ).toBe(first.dirtyStatusChecksum);
    expect(
      second.trackedDiffChecksum,
    ).toBe(first.trackedDiffChecksum);
    expect(
      second.untrackedFileCount,
    ).toBe(first.untrackedFileCount);
    expect(
      second.untrackedContentChecksum,
    ).not.toBe(
      first.untrackedContentChecksum,
    );
    expect(
      second.sourceFingerprint,
    ).not.toBe(first.sourceFingerprint);
    expect(
      JSON.stringify(first),
    ).not.toContain(firstContent);
    expect(
      JSON.stringify(second),
    ).not.toContain(secondContent);
  });

  it("includes staged and unstaged tracked deltas in the exact source fingerprint", async () => {
    const repository =
      await createRepository();
    const algorithm =
      selectHashAlgorithm();
    const clean =
      await captureGitSourceProvenance({
        cwd: repository.directory,
        checksumAlgorithm: algorithm,
      });
    const changedContent = randomUUID();
    await writeFile(
      repository.trackedPath,
      changedContent,
    );
    execFileSync(
      "git",
      ["add", repository.trackedPath],
      {
        cwd: repository.directory,
        stdio: "ignore",
      },
    );
    const staged =
      await captureGitSourceProvenance({
        cwd: repository.directory,
        checksumAlgorithm: algorithm,
      });

    expect(clean.dirty).toBe(false);
    expect(staged.dirty).toBe(true);
    expect(
      staged.trackedDiffChecksum,
    ).not.toBe(clean.trackedDiffChecksum);
    expect(
      staged.sourceFingerprint,
    ).not.toBe(clean.sourceFingerprint);
    expect(
      JSON.stringify(staged),
    ).not.toContain(changedContent);
  });
});
