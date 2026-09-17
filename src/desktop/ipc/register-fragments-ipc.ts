import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  FRAGMENT_CAPTURE_CHANNEL,
  FRAGMENT_LIST_CHANNEL,
  FRAGMENT_PROFILE_CHANNEL,
  FRAGMENT_RECORD_USE_CHANNEL,
  FRAGMENT_RETIRE_CHANNEL,
  FRAGMENT_UPDATE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseCaptureFragmentCommand,
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
} from "../../application/fragments/fragment-contract";

export type FragmentsIpcRuntime = Readonly<{
  captureFragment: (command: CaptureFragmentCommand) => Promise<FragmentProjection>;
  listFragments: (command: ListFragmentsCommand) => Promise<FragmentListProjection>;
  updateFragment: (command: UpdateFragmentCommand) => Promise<FragmentProjection>;
  recordFragmentUse: (
    command: RecordFragmentUseCommand,
  ) => Promise<FragmentProjection>;
  retireFragment: (command: RetireFragmentCommand) => Promise<FragmentProjection>;
}>;

export function registerFragmentsIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: FragmentsIpcRuntime;
  profile: FragmentShelfProfile;
}>): void {
  input.ipcMain.handle(FRAGMENT_PROFILE_CHANNEL, () => input.profile);
  input.ipcMain.handle(FRAGMENT_CAPTURE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.captureFragment(parseCaptureFragmentCommand(value));
  });
  input.ipcMain.handle(FRAGMENT_LIST_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.listFragments(parseListFragmentsCommand(value));
  });
  input.ipcMain.handle(FRAGMENT_UPDATE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.updateFragment(parseUpdateFragmentCommand(value));
  });
  input.ipcMain.handle(
    FRAGMENT_RECORD_USE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.recordFragmentUse(
        parseRecordFragmentUseCommand(value),
      );
    },
  );
  input.ipcMain.handle(FRAGMENT_RETIRE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.retireFragment(parseRetireFragmentCommand(value));
  });
}
