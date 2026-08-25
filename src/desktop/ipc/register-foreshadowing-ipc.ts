import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  FORESHADOW_CREATE_LINE_CHANNEL,
  FORESHADOW_CREATE_POINT_CHANNEL,
  FORESHADOW_LIST_LINES_CHANNEL,
  FORESHADOW_LIST_POINTS_CHANNEL,
  FORESHADOW_POINT_PROFILE_CHANNEL,
  FORESHADOW_RETIRE_LINE_CHANNEL,
  FORESHADOW_UPDATE_LINE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseCreateForeshadowLineCommand,
  parseListForeshadowLinesCommand,
  parseRetireForeshadowLineCommand,
  parseUpdateForeshadowLineCommand,
  type CreateForeshadowLineCommand,
  type ForeshadowLineListProjection,
  type ForeshadowLineProjection,
  type ListForeshadowLinesCommand,
  type RetireForeshadowLineCommand,
  type UpdateForeshadowLineCommand,
} from "../../application/foreshadowing/foreshadow-line-contract";
import {
  parseCreateForeshadowPointCommand,
  parseListForeshadowPointsCommand,
  type CreateForeshadowPointCommand,
  type ForeshadowPointListProjection,
  type ForeshadowPointProfile,
  type ForeshadowPointProjection,
  type ListForeshadowPointsCommand,
} from "../../application/foreshadowing/foreshadow-point-contract";

export type ForeshadowingIpcRuntime = Readonly<{
  createForeshadowLine: (
    command: CreateForeshadowLineCommand,
  ) => Promise<ForeshadowLineProjection>;
  listForeshadowLines: (
    command: ListForeshadowLinesCommand,
  ) => Promise<ForeshadowLineListProjection>;
  updateForeshadowLine: (
    command: UpdateForeshadowLineCommand,
  ) => Promise<ForeshadowLineProjection>;
  retireForeshadowLine: (
    command: RetireForeshadowLineCommand,
  ) => Promise<ForeshadowLineProjection>;
  createForeshadowPoint: (
    command: CreateForeshadowPointCommand,
  ) => Promise<ForeshadowPointProjection>;
  listForeshadowPoints: (
    command: ListForeshadowPointsCommand,
  ) => Promise<ForeshadowPointListProjection>;
}>;

export function registerForeshadowingIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: ForeshadowingIpcRuntime;
  pointProfile: ForeshadowPointProfile;
}>): void {
  input.ipcMain.handle(
    FORESHADOW_POINT_PROFILE_CHANNEL,
    () => input.pointProfile,
  );
  input.ipcMain.handle(FORESHADOW_CREATE_LINE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.createForeshadowLine(
      parseCreateForeshadowLineCommand(value),
    );
  });
  input.ipcMain.handle(FORESHADOW_LIST_LINES_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.listForeshadowLines(parseListForeshadowLinesCommand(value));
  });
  input.ipcMain.handle(FORESHADOW_UPDATE_LINE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.updateForeshadowLine(
      parseUpdateForeshadowLineCommand(value),
    );
  });
  input.ipcMain.handle(FORESHADOW_RETIRE_LINE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.retireForeshadowLine(
      parseRetireForeshadowLineCommand(value),
    );
  });
  input.ipcMain.handle(FORESHADOW_CREATE_POINT_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.createForeshadowPoint(
      parseCreateForeshadowPointCommand(value),
    );
  });
  input.ipcMain.handle(FORESHADOW_LIST_POINTS_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.listForeshadowPoints(
      parseListForeshadowPointsCommand(value),
    );
  });
}
