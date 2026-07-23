import {
  parseManuscriptInputProfile,
  type ManuscriptInputProfile,
} from "../editor/manuscript-input-profile";
import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentProfile,
} from "../editor/manuscript-document-profile";

export const RUNTIME_INFO_CHANNEL = "studio:system:get-runtime-info";
export const MANUSCRIPT_INPUT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-input-profile";
export const MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-document-profile";

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
  editor: {
    getManuscriptInputProfile: () => Promise<ManuscriptInputProfile>;
    getManuscriptDocumentProfile: () => Promise<ManuscriptDocumentProfile>;
  };
};

export type BridgeInvoke = (
  channel:
    | typeof RUNTIME_INFO_CHANNEL
    | typeof MANUSCRIPT_INPUT_PROFILE_CHANNEL
    | typeof MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL,
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
    editor: {
      getManuscriptInputProfile: async () => {
        const value = await invoke(MANUSCRIPT_INPUT_PROFILE_CHANNEL);
        try {
          return parseManuscriptInputProfile(value);
        } catch {
          throw new Error("Invalid manuscript input profile");
        }
      },
      getManuscriptDocumentProfile: async () => {
        const value = await invoke(MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL);
        try {
          return parseManuscriptDocumentProfile(value);
        } catch {
          throw new Error("Invalid manuscript document profile");
        }
      },
    },
  };
}
