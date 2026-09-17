import {
  parseCaptureFragmentCommand,
  parseFragmentListProjection,
  parseFragmentProjection,
  parseFragmentShelfProfile,
  parseListFragmentsCommand,
  parseRecordFragmentUseCommand,
  parseRetireFragmentCommand,
  parseUpdateFragmentCommand,
  type CaptureFragmentCommand,
  type FragmentListProjection,
  type FragmentProjection,
  type FragmentShelfProfile,
  type ListFragmentsCommand,
  type RecordFragmentUseCommand,
  type RetireFragmentCommand,
  type UpdateFragmentCommand,
} from "../../fragments/fragment-contract";

export const FRAGMENT_PROFILE_CHANNEL = "studio:fragments:get-profile";
export const FRAGMENT_CAPTURE_CHANNEL = "studio:fragments:capture";
export const FRAGMENT_LIST_CHANNEL = "studio:fragments:list";
export const FRAGMENT_UPDATE_CHANNEL = "studio:fragments:update";
export const FRAGMENT_RECORD_USE_CHANNEL = "studio:fragments:record-use";
export const FRAGMENT_RETIRE_CHANNEL = "studio:fragments:retire";

export type FragmentBridgeChannel =
  | typeof FRAGMENT_PROFILE_CHANNEL
  | typeof FRAGMENT_CAPTURE_CHANNEL
  | typeof FRAGMENT_LIST_CHANNEL
  | typeof FRAGMENT_UPDATE_CHANNEL
  | typeof FRAGMENT_RECORD_USE_CHANNEL
  | typeof FRAGMENT_RETIRE_CHANNEL;

export type FragmentBridgePayload =
  | CaptureFragmentCommand
  | ListFragmentsCommand
  | UpdateFragmentCommand
  | RecordFragmentUseCommand
  | RetireFragmentCommand;

export type FragmentsBridge = Readonly<{
  getProfile: () => Promise<FragmentShelfProfile>;
  capture: (command: CaptureFragmentCommand) => Promise<FragmentProjection>;
  list: (command: ListFragmentsCommand) => Promise<FragmentListProjection>;
  update: (command: UpdateFragmentCommand) => Promise<FragmentProjection>;
  recordUse: (command: RecordFragmentUseCommand) => Promise<FragmentProjection>;
  retire: (command: RetireFragmentCommand) => Promise<FragmentProjection>;
}>;

export type FragmentBridgeInvoke = (
  channel: FragmentBridgeChannel,
  payload?: FragmentBridgePayload,
) => Promise<unknown>;

export function createFragmentsBridge(
  invoke: FragmentBridgeInvoke,
): FragmentsBridge {
  return Object.freeze({
    getProfile: async () => {
      const value = await invoke(FRAGMENT_PROFILE_CHANNEL);
      try {
        return parseFragmentShelfProfile(value);
      } catch {
        throw new Error("Invalid fragment shelf profile");
      }
    },
    capture: async (input) => {
      const command = parseCaptureFragmentCommand(input);
      const value = await invoke(FRAGMENT_CAPTURE_CHANNEL, command);
      try {
        return parseFragmentProjection(value);
      } catch {
        throw new Error("Invalid fragment capture result");
      }
    },
    list: async (input) => {
      const command = parseListFragmentsCommand(input);
      const value = await invoke(FRAGMENT_LIST_CHANNEL, command);
      try {
        return parseFragmentListProjection(value);
      } catch {
        throw new Error("Invalid fragment list");
      }
    },
    update: async (input) => {
      const command = parseUpdateFragmentCommand(input);
      const value = await invoke(FRAGMENT_UPDATE_CHANNEL, command);
      try {
        return parseFragmentProjection(value);
      } catch {
        throw new Error("Invalid fragment update result");
      }
    },
    recordUse: async (input) => {
      const command = parseRecordFragmentUseCommand(input);
      const value = await invoke(FRAGMENT_RECORD_USE_CHANNEL, command);
      try {
        return parseFragmentProjection(value);
      } catch {
        throw new Error("Invalid fragment use result");
      }
    },
    retire: async (input) => {
      const command = parseRetireFragmentCommand(input);
      const value = await invoke(FRAGMENT_RETIRE_CHANNEL, command);
      try {
        return parseFragmentProjection(value);
      } catch {
        throw new Error("Invalid fragment retirement result");
      }
    },
  });
}
