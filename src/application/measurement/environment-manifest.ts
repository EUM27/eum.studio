export type EnvironmentPackage = {
  name: string;
  version: string;
};

export type EnvironmentManifestInput = {
  capturedAt: string;
  platform: string;
  architecture: string;
  osRelease: string;
  nodeVersion: string;
  packages: readonly EnvironmentPackage[];
};

export type EnvironmentManifest = EnvironmentManifestInput & {
  schemaVersion: 1;
  packages: EnvironmentPackage[];
};

export function createEnvironmentManifest(
  input: EnvironmentManifestInput,
): EnvironmentManifest {
  const identities = new Set<string>();
  for (const item of input.packages) {
    if (identities.has(item.name)) {
      throw new Error(`Duplicate package identity: ${item.name}`);
    }
    identities.add(item.name);
  }

  return {
    schemaVersion: 1,
    capturedAt: input.capturedAt,
    platform: input.platform,
    architecture: input.architecture,
    osRelease: input.osRelease,
    nodeVersion: input.nodeVersion,
    packages: input.packages
      .map((item) => ({ name: item.name, version: item.version }))
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      ),
  };
}
