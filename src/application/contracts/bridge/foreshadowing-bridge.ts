import {
  parseCreateForeshadowLineCommand,
  parseForeshadowLineListProjection,
  parseForeshadowLineProjection,
  parseListForeshadowLinesCommand,
  parseRetireForeshadowLineCommand,
  parseUpdateForeshadowLineCommand,
  type CreateForeshadowLineCommand,
  type ForeshadowLineListProjection,
  type ForeshadowLineProjection,
  type ListForeshadowLinesCommand,
  type RetireForeshadowLineCommand,
  type UpdateForeshadowLineCommand,
} from "../../foreshadowing/foreshadow-line-contract";
import {
  parseCreateForeshadowPointCommand,
  parseForeshadowPointListProjection,
  parseForeshadowPointProfile,
  parseForeshadowPointProjection,
  parseListForeshadowPointsCommand,
  type CreateForeshadowPointCommand,
  type ForeshadowPointListProjection,
  type ForeshadowPointProfile,
  type ForeshadowPointProjection,
  type ListForeshadowPointsCommand,
} from "../../foreshadowing/foreshadow-point-contract";

export const FORESHADOW_CREATE_LINE_CHANNEL = "studio:foreshadowing:create-line";
export const FORESHADOW_LIST_LINES_CHANNEL = "studio:foreshadowing:list-lines";
export const FORESHADOW_UPDATE_LINE_CHANNEL = "studio:foreshadowing:update-line";
export const FORESHADOW_RETIRE_LINE_CHANNEL = "studio:foreshadowing:retire-line";
export const FORESHADOW_POINT_PROFILE_CHANNEL = "studio:foreshadowing:get-point-profile";
export const FORESHADOW_CREATE_POINT_CHANNEL = "studio:foreshadowing:create-point";
export const FORESHADOW_LIST_POINTS_CHANNEL = "studio:foreshadowing:list-points";

export type ForeshadowingBridgeChannel =
  | typeof FORESHADOW_CREATE_LINE_CHANNEL
  | typeof FORESHADOW_LIST_LINES_CHANNEL
  | typeof FORESHADOW_UPDATE_LINE_CHANNEL
  | typeof FORESHADOW_RETIRE_LINE_CHANNEL
  | typeof FORESHADOW_POINT_PROFILE_CHANNEL
  | typeof FORESHADOW_CREATE_POINT_CHANNEL
  | typeof FORESHADOW_LIST_POINTS_CHANNEL;

export type ForeshadowingBridgePayload =
  | CreateForeshadowLineCommand
  | ListForeshadowLinesCommand
  | UpdateForeshadowLineCommand
  | RetireForeshadowLineCommand
  | CreateForeshadowPointCommand
  | ListForeshadowPointsCommand;

export type ForeshadowingBridge = Readonly<{
  getPointProfile: () => Promise<ForeshadowPointProfile>;
  createLine: (command: CreateForeshadowLineCommand) => Promise<ForeshadowLineProjection>;
  listLines: (command: ListForeshadowLinesCommand) => Promise<ForeshadowLineListProjection>;
  updateLine: (command: UpdateForeshadowLineCommand) => Promise<ForeshadowLineProjection>;
  retireLine: (command: RetireForeshadowLineCommand) => Promise<ForeshadowLineProjection>;
  createPoint: (command: CreateForeshadowPointCommand) => Promise<ForeshadowPointProjection>;
  listPoints: (command: ListForeshadowPointsCommand) => Promise<ForeshadowPointListProjection>;
}>;

export type ForeshadowingBridgeInvoke = (
  channel: ForeshadowingBridgeChannel,
  payload?: ForeshadowingBridgePayload,
) => Promise<unknown>;

export function createForeshadowingBridge(
  invoke: ForeshadowingBridgeInvoke,
): ForeshadowingBridge {
  return Object.freeze({
    getPointProfile: async () => {
      const value = await invoke(FORESHADOW_POINT_PROFILE_CHANNEL);
      try { return parseForeshadowPointProfile(value); } catch {
        throw new Error("Invalid foreshadow point profile");
      }
    },
    createLine: async (input) => {
      const command = parseCreateForeshadowLineCommand(input);
      const value = await invoke(FORESHADOW_CREATE_LINE_CHANNEL, command);
      try { return parseForeshadowLineProjection(value); } catch {
        throw new Error("Invalid foreshadow line creation result");
      }
    },
    listLines: async (input) => {
      const command = parseListForeshadowLinesCommand(input);
      const value = await invoke(FORESHADOW_LIST_LINES_CHANNEL, command);
      try { return parseForeshadowLineListProjection(value); } catch {
        throw new Error("Invalid foreshadow line list");
      }
    },
    updateLine: async (input) => {
      const command = parseUpdateForeshadowLineCommand(input);
      const value = await invoke(FORESHADOW_UPDATE_LINE_CHANNEL, command);
      try { return parseForeshadowLineProjection(value); } catch {
        throw new Error("Invalid foreshadow line update result");
      }
    },
    retireLine: async (input) => {
      const command = parseRetireForeshadowLineCommand(input);
      const value = await invoke(FORESHADOW_RETIRE_LINE_CHANNEL, command);
      try { return parseForeshadowLineProjection(value); } catch {
        throw new Error("Invalid foreshadow line retirement result");
      }
    },
    createPoint: async (input) => {
      const command = parseCreateForeshadowPointCommand(input);
      const value = await invoke(FORESHADOW_CREATE_POINT_CHANNEL, command);
      try { return parseForeshadowPointProjection(value); } catch {
        throw new Error("Invalid foreshadow point creation result");
      }
    },
    listPoints: async (input) => {
      const command = parseListForeshadowPointsCommand(input);
      const value = await invoke(FORESHADOW_LIST_POINTS_CHANNEL, command);
      try { return parseForeshadowPointListProjection(value); } catch {
        throw new Error("Invalid foreshadow point list");
      }
    },
  });
}
