import {
  parseManuscriptInputProfile,
  type ManuscriptInputProfile,
} from "../editor/manuscript-input-profile";
import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentProfile,
} from "../editor/manuscript-document-profile";
import {
  parseChangeBatch,
  type ChangeBatch,
} from "../persistence/change-batch";
import {
  parseManuscriptPersistenceProfile,
  type ManuscriptPersistenceProfile,
} from "../persistence/manuscript-persistence-profile";
import {
  parseSaveReceipt,
  type SaveReceipt,
} from "../persistence/save-change-batch";
import {
  parseApplyStartupRecoveryAcknowledgement,
  parseApplyStartupRecoveryCommand,
  parseStartupRecoveryProjection,
  type ApplyStartupRecoveryAcknowledgement,
  type ApplyStartupRecoveryCommand,
  type StartupRecoveryProjection,
} from "../persistence/startup-recovery-contract";
import {
  parseManuscriptResumeCheckpointProjection,
  type ManuscriptResumeCheckpointProjection,
} from "../checkpoints/manuscript-resume-checkpoint-projection";

export const RUNTIME_INFO_CHANNEL = "studio:system:get-runtime-info";
export const MANUSCRIPT_INPUT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-input-profile";
export const MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-document-profile";
export const MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL =
  "studio:editor:save-change-batch";
export const MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-persistence-profile";
export const MANUSCRIPT_STARTUP_RECOVERY_CHANNEL =
  "studio:editor:get-manuscript-startup-recovery";
export const MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL =
  "studio:editor:get-manuscript-resume-checkpoint";
export const MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL =
  "studio:editor:apply-manuscript-startup-recovery";
export const MANUSCRIPT_CLOSE_REQUEST_CHANNEL =
  "studio:editor:manuscript-close-request";
export const MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL =
  "studio:editor:complete-manuscript-close-request";

export type RuntimeInfo = {
  appName: string;
  appVersion: string;
  platform: string;
  architecture: string;
};

export type ManuscriptCloseRequest = {
  readonly schemaVersion: 1;
  readonly requestId: string;
};

export type ManuscriptCloseResult = {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly status: "saved" | "failed";
};

export type StudioBridge = {
  system: {
    getRuntimeInfo: () => Promise<RuntimeInfo>;
  };
  editor: {
    getManuscriptInputProfile: () => Promise<ManuscriptInputProfile>;
    getManuscriptDocumentProfile: () => Promise<ManuscriptDocumentProfile>;
    getManuscriptPersistenceProfile: () => Promise<ManuscriptPersistenceProfile | null>;
    getManuscriptStartupRecovery: () => Promise<StartupRecoveryProjection>;
    getManuscriptResumeCheckpoint: () => Promise<ManuscriptResumeCheckpointProjection>;
    saveChangeBatch: (batch: ChangeBatch) => Promise<SaveReceipt>;
    applyManuscriptStartupRecovery: (
      command: ApplyStartupRecoveryCommand,
    ) => Promise<ApplyStartupRecoveryAcknowledgement>;
    onManuscriptCloseRequest: (
      listener: (
        request: ManuscriptCloseRequest,
      ) => void,
    ) => () => void;
    completeManuscriptCloseRequest: (
      result: ManuscriptCloseResult,
    ) => Promise<ManuscriptCloseResult>;
  };
};

export type BridgeInvoke = (
  channel:
    | typeof RUNTIME_INFO_CHANNEL
    | typeof MANUSCRIPT_INPUT_PROFILE_CHANNEL
    | typeof MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL
    | typeof MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL
    | typeof MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL
    | typeof MANUSCRIPT_STARTUP_RECOVERY_CHANNEL
    | typeof MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL
    | typeof MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL
    | typeof MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
  payload?:
    | ChangeBatch
    | ApplyStartupRecoveryCommand
    | ManuscriptCloseResult,
) => Promise<unknown>;

export type BridgeListen = (
  channel: typeof MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  listener: (payload: unknown) => void,
) => () => void;

function parseCloseContractRecord(
  value: unknown,
  recordName: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${recordName} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertCloseContractFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  recordName: string,
): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      throw new Error(
        `Unsupported ${recordName} field: ${field}`,
      );
    }
  }
}

function parseCloseRequestId(
  value: unknown,
  recordName: string,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${recordName}.requestId must be a non-empty string`,
    );
  }
  return value;
}

export function parseManuscriptCloseRequest(
  value: unknown,
): ManuscriptCloseRequest {
  const input = parseCloseContractRecord(
    value,
    "ManuscriptCloseRequest",
  );
  assertCloseContractFields(
    input,
    ["schemaVersion", "requestId"],
    "ManuscriptCloseRequest",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ManuscriptCloseRequest schemaVersion: ${String(
        input.schemaVersion,
      )}`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: parseCloseRequestId(
      input.requestId,
      "ManuscriptCloseRequest",
    ),
  });
}

export function parseManuscriptCloseResult(
  value: unknown,
): ManuscriptCloseResult {
  const input = parseCloseContractRecord(
    value,
    "ManuscriptCloseResult",
  );
  assertCloseContractFields(
    input,
    ["schemaVersion", "requestId", "status"],
    "ManuscriptCloseResult",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ManuscriptCloseResult schemaVersion: ${String(
        input.schemaVersion,
      )}`,
    );
  }
  if (
    input.status !== "saved" &&
    input.status !== "failed"
  ) {
    throw new Error(
      `Unsupported ManuscriptCloseResult status: ${String(
        input.status,
      )}`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: parseCloseRequestId(
      input.requestId,
      "ManuscriptCloseResult",
    ),
    status: input.status,
  });
}

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

export function createStudioBridge(
  invoke: BridgeInvoke,
  listen: BridgeListen,
): StudioBridge {
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
      getManuscriptPersistenceProfile: async () => {
        const value = await invoke(
          MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
        );
        try {
          return parseManuscriptPersistenceProfile(value);
        } catch {
          throw new Error(
            "Invalid manuscript persistence profile",
          );
        }
      },
      getManuscriptStartupRecovery: async () => {
        const value = await invoke(
          MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
        );
        try {
          return parseStartupRecoveryProjection(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript startup recovery",
          );
        }
      },
      getManuscriptResumeCheckpoint: async () => {
        const value = await invoke(
          MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
        );
        try {
          return parseManuscriptResumeCheckpointProjection(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript resume checkpoint",
          );
        }
      },
      saveChangeBatch: async (input) => {
        const batch = parseChangeBatch(input);
        const value = await invoke(
          MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
          batch,
        );
        try {
          return parseSaveReceipt(value);
        } catch {
          throw new Error("Invalid save receipt");
        }
      },
      applyManuscriptStartupRecovery: async (
        input,
      ) => {
        const command =
          parseApplyStartupRecoveryCommand(input);
        const value = await invoke(
          MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
          command,
        );
        try {
          return parseApplyStartupRecoveryAcknowledgement(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript recovery acknowledgement",
          );
        }
      },
      onManuscriptCloseRequest: (
        listener,
      ) =>
        listen(
          MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
          (value) => {
            listener(
              parseManuscriptCloseRequest(
                value,
              ),
            );
          },
        ),
      completeManuscriptCloseRequest: async (
        input,
      ) => {
        const result =
          parseManuscriptCloseResult(input);
        const value = await invoke(
          MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
          result,
        );
        try {
          return parseManuscriptCloseResult(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript close result",
          );
        }
      },
    },
  };
}
