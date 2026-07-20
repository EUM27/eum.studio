export const RUNTIME_INFO_CHANNEL = "studio:system:get-runtime-info";

export type RuntimeInfo = {
  appName: string;
  appVersion: string;
  platform: string;
  architecture: string;
};

export type StudioBridge = {
  system: {
    getRuntimeInfo: () => Promise<RuntimeInfo>;
  };
};

export type BridgeInvoke = (
  channel: typeof RUNTIME_INFO_CHANNEL,
) => Promise<unknown>;

export function isRuntimeInfo(value: unknown): value is RuntimeInfo {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.appName === "string" &&
    typeof candidate.appVersion === "string" &&
    typeof candidate.platform === "string" &&
    typeof candidate.architecture === "string"
  );
}

export function createStudioBridge(invoke: BridgeInvoke): StudioBridge {
  return {
    system: {
      getRuntimeInfo: async () => {
        const value = await invoke(RUNTIME_INFO_CHANNEL);
        if (!isRuntimeInfo(value)) {
          throw new Error("Invalid runtime information");
        }
        return value;
      },
    },
  };
}
