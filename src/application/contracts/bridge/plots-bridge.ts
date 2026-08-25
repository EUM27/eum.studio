import {
  parseCreatePlotThreadCommand,
  parseListPlotThreadsCommand,
  parsePlotThreadListProjection,
  parsePlotThreadProjection,
  parseRetirePlotThreadCommand,
  parseUpdatePlotThreadCommand,
  type CreatePlotThreadCommand,
  type ListPlotThreadsCommand,
  type PlotThreadListProjection,
  type PlotThreadProjection,
  type RetirePlotThreadCommand,
  type UpdatePlotThreadCommand,
} from "../../plots/plot-contract";
import {
  parseGetDefaultPlotBoardCommand,
  parseMovePlotPlacementCommand,
  parsePlotBoardProjection,
  parseSetPlotPlacementStoryTimeCommand,
  type GetDefaultPlotBoardCommand,
  type MovePlotPlacementCommand,
  type PlotBoardProjection,
  type SetPlotPlacementStoryTimeCommand,
} from "../../plots/plot-board-contract";
import {
  parseCreateEventFromPlotCommand,
  parseCreatePlotFromEventCommand,
  parseLinkPlotEventCommand,
  parseListPlotEventLinksCommand,
  parsePlotEventLinkListProjection,
  parsePlotEventLinkMutationProjection,
  parseUnlinkPlotEventCommand,
  type CreateEventFromPlotCommand,
  type CreatePlotFromEventCommand,
  type LinkPlotEventCommand,
  type ListPlotEventLinksCommand,
  type PlotEventLinkListProjection,
  type PlotEventLinkMutationProjection,
  type UnlinkPlotEventCommand,
} from "../../plots/plot-event-link-contract";
import {
  parseLinkPlotThreadSourceCommand,
  parseListPlotThreadSourcesCommand,
  parsePlotThreadSourceListProjection,
  parsePlotThreadSourceProjection,
  type LinkPlotThreadSourceCommand,
  type ListPlotThreadSourcesCommand,
  type PlotThreadSourceListProjection,
  type PlotThreadSourceProjection,
} from "../../plots/plot-source-contract";

export const PLOT_CREATE_CHANNEL = "studio:plots:create";
export const PLOT_LIST_CHANNEL = "studio:plots:list";
export const PLOT_DEFAULT_BOARD_CHANNEL = "studio:plots:get-default-board";
export const PLOT_MOVE_PLACEMENT_CHANNEL = "studio:plots:move-placement";
export const PLOT_SET_STORY_TIME_CHANNEL = "studio:plots:set-story-time";
export const PLOT_UPDATE_CHANNEL = "studio:plots:update";
export const PLOT_RETIRE_CHANNEL = "studio:plots:retire";
export const PLOT_CREATE_FROM_EVENT_CHANNEL = "studio:plots:create-from-event";
export const PLOT_CREATE_EVENT_CHANNEL = "studio:plots:create-event";
export const PLOT_LINK_EVENT_CHANNEL = "studio:plots:link-event";
export const PLOT_UNLINK_EVENT_CHANNEL = "studio:plots:unlink-event";
export const PLOT_EVENT_LINK_LIST_CHANNEL = "studio:plots:list-event-links";
export const PLOT_LINK_SOURCE_CHANNEL = "studio:plots:link-source";
export const PLOT_SOURCE_LIST_CHANNEL = "studio:plots:list-sources";

export type PlotsBridgeChannel =
  | typeof PLOT_CREATE_CHANNEL
  | typeof PLOT_LIST_CHANNEL
  | typeof PLOT_DEFAULT_BOARD_CHANNEL
  | typeof PLOT_MOVE_PLACEMENT_CHANNEL
  | typeof PLOT_SET_STORY_TIME_CHANNEL
  | typeof PLOT_UPDATE_CHANNEL
  | typeof PLOT_RETIRE_CHANNEL
  | typeof PLOT_CREATE_FROM_EVENT_CHANNEL
  | typeof PLOT_CREATE_EVENT_CHANNEL
  | typeof PLOT_LINK_EVENT_CHANNEL
  | typeof PLOT_UNLINK_EVENT_CHANNEL
  | typeof PLOT_EVENT_LINK_LIST_CHANNEL
  | typeof PLOT_LINK_SOURCE_CHANNEL
  | typeof PLOT_SOURCE_LIST_CHANNEL;

export type PlotsBridgePayload =
  | CreatePlotThreadCommand
  | ListPlotThreadsCommand
  | UpdatePlotThreadCommand
  | RetirePlotThreadCommand
  | CreatePlotFromEventCommand
  | CreateEventFromPlotCommand
  | LinkPlotEventCommand
  | UnlinkPlotEventCommand
  | ListPlotEventLinksCommand;

export type PlotsBridge = Readonly<{
  create: (command: CreatePlotThreadCommand) => Promise<PlotThreadProjection>;
  list: (command: ListPlotThreadsCommand) => Promise<PlotThreadListProjection>;
  getDefaultBoard: (
    command: GetDefaultPlotBoardCommand,
  ) => Promise<PlotBoardProjection>;
  movePlacement: (
    command: MovePlotPlacementCommand,
  ) => Promise<PlotBoardProjection>;
  setStoryTime: (
    command: SetPlotPlacementStoryTimeCommand,
  ) => Promise<PlotBoardProjection>;
  update: (command: UpdatePlotThreadCommand) => Promise<PlotThreadProjection>;
  retire: (command: RetirePlotThreadCommand) => Promise<PlotThreadProjection>;
  createFromEvent: (
    command: CreatePlotFromEventCommand,
  ) => Promise<PlotEventLinkMutationProjection>;
  createEvent: (
    command: CreateEventFromPlotCommand,
  ) => Promise<PlotEventLinkMutationProjection>;
  linkEvent: (
    command: LinkPlotEventCommand,
  ) => Promise<PlotEventLinkMutationProjection>;
  unlinkEvent: (
    command: UnlinkPlotEventCommand,
  ) => Promise<PlotEventLinkMutationProjection>;
  listEventLinks: (
    command: ListPlotEventLinksCommand,
  ) => Promise<PlotEventLinkListProjection>;
  linkSource: (
    command: LinkPlotThreadSourceCommand,
  ) => Promise<PlotThreadSourceProjection>;
  listSources: (
    command: ListPlotThreadSourcesCommand,
  ) => Promise<PlotThreadSourceListProjection>;
}>;

export type PlotsBridgeInvoke = (
  channel: PlotsBridgeChannel,
  payload?: PlotsBridgePayload,
) => Promise<unknown>;

export function createPlotsBridge(invoke: PlotsBridgeInvoke): PlotsBridge {
  return Object.freeze({
    create: async (input) => {
      const command = parseCreatePlotThreadCommand(input);
      const value = await invoke(PLOT_CREATE_CHANNEL, command);
      try {
        return parsePlotThreadProjection(value);
      } catch {
        throw new Error("Invalid plot creation result");
      }
    },
    list: async (input) => {
      const command = parseListPlotThreadsCommand(input);
      const value = await invoke(PLOT_LIST_CHANNEL, command);
      try {
        return parsePlotThreadListProjection(value);
      } catch {
        throw new Error("Invalid plot list");
      }
    },
    getDefaultBoard: async (input) => {
      const command = parseGetDefaultPlotBoardCommand(input);
      const value = await invoke(PLOT_DEFAULT_BOARD_CHANNEL, command);
      try {
        return parsePlotBoardProjection(value);
      } catch {
        throw new Error("Invalid default plot board");
      }
    },
    movePlacement: async (input) => {
      const command = parseMovePlotPlacementCommand(input);
      const value = await invoke(PLOT_MOVE_PLACEMENT_CHANNEL, command);
      try {
        return parsePlotBoardProjection(value);
      } catch {
        throw new Error("Invalid plot placement move result");
      }
    },
    setStoryTime: async (input) => {
      const command = parseSetPlotPlacementStoryTimeCommand(input);
      const value = await invoke(PLOT_SET_STORY_TIME_CHANNEL, command);
      try {
        return parsePlotBoardProjection(value);
      } catch {
        throw new Error("Invalid plot placement story-time result");
      }
    },
    update: async (input) => {
      const command = parseUpdatePlotThreadCommand(input);
      const value = await invoke(PLOT_UPDATE_CHANNEL, command);
      try {
        return parsePlotThreadProjection(value);
      } catch {
        throw new Error("Invalid plot update result");
      }
    },
    retire: async (input) => {
      const command = parseRetirePlotThreadCommand(input);
      const value = await invoke(PLOT_RETIRE_CHANNEL, command);
      try {
        return parsePlotThreadProjection(value);
      } catch {
        throw new Error("Invalid plot retirement result");
      }
    },
    createFromEvent: async (input) => {
      const command = parseCreatePlotFromEventCommand(input);
      const value = await invoke(PLOT_CREATE_FROM_EVENT_CHANNEL, command);
      try {
        return parsePlotEventLinkMutationProjection(value);
      } catch {
        throw new Error("Invalid plot creation from event result");
      }
    },
    createEvent: async (input) => {
      const command = parseCreateEventFromPlotCommand(input);
      const value = await invoke(PLOT_CREATE_EVENT_CHANNEL, command);
      try {
        return parsePlotEventLinkMutationProjection(value);
      } catch {
        throw new Error("Invalid event creation from plot result");
      }
    },
    linkEvent: async (input) => {
      const command = parseLinkPlotEventCommand(input);
      const value = await invoke(PLOT_LINK_EVENT_CHANNEL, command);
      try {
        return parsePlotEventLinkMutationProjection(value);
      } catch {
        throw new Error("Invalid plot/event link result");
      }
    },
    unlinkEvent: async (input) => {
      const command = parseUnlinkPlotEventCommand(input);
      const value = await invoke(PLOT_UNLINK_EVENT_CHANNEL, command);
      try {
        return parsePlotEventLinkMutationProjection(value);
      } catch {
        throw new Error("Invalid plot/event unlink result");
      }
    },
    listEventLinks: async (input) => {
      const command = parseListPlotEventLinksCommand(input);
      const value = await invoke(PLOT_EVENT_LINK_LIST_CHANNEL, command);
      try {
        return parsePlotEventLinkListProjection(value);
      } catch {
        throw new Error("Invalid plot/event link list");
      }
    },
    linkSource: async (input) => {
      const command = parseLinkPlotThreadSourceCommand(input);
      const value = await invoke(PLOT_LINK_SOURCE_CHANNEL, command);
      try {
        return parsePlotThreadSourceProjection(value);
      } catch {
        throw new Error("Invalid plot source link result");
      }
    },
    listSources: async (input) => {
      const command = parseListPlotThreadSourcesCommand(input);
      const value = await invoke(PLOT_SOURCE_LIST_CHANNEL, command);
      try {
        return parsePlotThreadSourceListProjection(value);
      } catch {
        throw new Error("Invalid plot source list");
      }
    },
  });
}
