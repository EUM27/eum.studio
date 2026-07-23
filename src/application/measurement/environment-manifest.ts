export type EnvironmentPackage = {
  readonly name: string;
  readonly version: string;
};

export type EnvironmentManifestInput = {
  readonly capturedAt: string;
  readonly platform: string;
  readonly architecture: string;
  readonly osRelease: string;
  readonly nodeVersion: string;
  readonly cpuModel: string;
  readonly logicalProcessorCount: number;
  readonly totalMemoryBytes: number;
  readonly packages: readonly EnvironmentPackage[];
};

export type EnvironmentManifest = EnvironmentManifestInput & {
  readonly schemaVersion: 1;
  readonly packages: readonly EnvironmentPackage[];
};

export function createEnvironmentManifest(
  input: EnvironmentManifestInput,
): EnvironmentManifest {
  if (input.cpuModel.length === 0) {
    throw new Error("CPU model must not be empty");
  }
  if (
    !Number.isSafeInteger(input.logicalProcessorCount) ||
    input.logicalProcessorCount <= 0
  ) {
    throw new Error("Logical processor count must be a positive integer");
  }
  if (
    !Number.isSafeInteger(input.totalMemoryBytes) ||
    input.totalMemoryBytes <= 0
  ) {
    throw new Error("Total memory bytes must be a positive integer");
  }
  const identities = new Set<string>();
  for (const item of input.packages) {
    if (identities.has(item.name)) {
      throw new Error(`Duplicate package identity: ${item.name}`);
    }
    identities.add(item.name);
  }

  return Object.freeze({
    schemaVersion: 1,
    capturedAt: input.capturedAt,
    platform: input.platform,
    architecture: input.architecture,
    osRelease: input.osRelease,
    nodeVersion: input.nodeVersion,
    cpuModel: input.cpuModel,
    logicalProcessorCount: input.logicalProcessorCount,
    totalMemoryBytes: input.totalMemoryBytes,
    packages: Object.freeze(
      input.packages
        .map((item) =>
          Object.freeze({ name: item.name, version: item.version }),
        )
        .sort((left, right) =>
          left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
        ),
      ),
  });
}
