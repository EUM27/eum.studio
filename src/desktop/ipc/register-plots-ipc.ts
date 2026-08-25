import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  PLOT_CREATE_CHANNEL,
  PLOT_CREATE_EVENT_CHANNEL,
  PLOT_CREATE_FROM_EVENT_CHANNEL,
  PLOT_DEFAULT_BOARD_CHANNEL,
  PLOT_EVENT_LINK_LIST_CHANNEL,
  PLOT_LINK_EVENT_CHANNEL,
  PLOT_LINK_SOURCE_CHANNEL,
  PLOT_LIST_CHANNEL,
  PLOT_MOVE_PLACEMENT_CHANNEL,
  PLOT_RETIRE_CHANNEL,
  PLOT_SET_STORY_TIME_CHANNEL,
  PLOT_SOURCE_LIST_CHANNEL,
  PLOT_UNLINK_EVENT_CHANNEL,
  PLOT_UPDATE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseCreatePlotThreadCommand,
  parseListPlotThreadsCommand,
  parseRetirePlotThreadCommand,
  parseUpdatePlotThreadCommand,
  type CreatePlotThreadCommand,
  type ListPlotThreadsCommand,
  type PlotThreadListProjection,
  type PlotThreadProjection,
  type RetirePlotThreadCommand,
  type UpdatePlotThreadCommand,
} from "../../application/plots/plot-contract";
import {
  parseGetDefaultPlotBoardCommand,
  parseMovePlotPlacementCommand,
  parseSetPlotPlacementStoryTimeCommand,
  type GetDefaultPlotBoardCommand,
  type MovePlotPlacementCommand,
  type PlotBoardProjection,
  type SetPlotPlacementStoryTimeCommand,
} from "../../application/plots/plot-board-contract";
import {
  parseCreateEventFromPlotCommand,
  parseCreatePlotFromEventCommand,
  parseLinkPlotEventCommand,
  parseListPlotEventLinksCommand,
  parseUnlinkPlotEventCommand,
  type CreateEventFromPlotCommand,
  type CreatePlotFromEventCommand,
  type LinkPlotEventCommand,
  type ListPlotEventLinksCommand,
  type PlotEventLinkListProjection,
  type PlotEventLinkMutationProjection,
  type UnlinkPlotEventCommand,
} from "../../application/plots/plot-event-link-contract";
import {
  parseLinkPlotThreadSourceCommand,
  parseListPlotThreadSourcesCommand,
  type LinkPlotThreadSourceCommand,
  type ListPlotThreadSourcesCommand,
  type PlotThreadSourceListProjection,
  type PlotThreadSourceProjection,
} from "../../application/plots/plot-source-contract";

export type PlotsIpcRuntime = Readonly<{
  createPlotThread: (command: CreatePlotThreadCommand) => Promise<PlotThreadProjection>;
  listPlotThreads: (
    command: ListPlotThreadsCommand,
  ) => Promise<PlotThreadListProjection>;
  getDefaultPlotBoard: (
    command: GetDefaultPlotBoardCommand,
  ) => Promise<PlotBoardProjection>;
  movePlotPlacement: (
    command: MovePlotPlacementCommand,
  ) => Promise<PlotBoardProjection>;
  setPlotPlacementStoryTime: (
    command: SetPlotPlacementStoryTimeCommand,
  ) => Promise<PlotBoardProjection>;
  updatePlotThread: (command: UpdatePlotThreadCommand) => Promise<PlotThreadProjection>;
  retirePlotThread: (command: RetirePlotThreadCommand) => Promise<PlotThreadProjection>;
  createPlotFromEvent: (
    command: CreatePlotFromEventCommand,
  ) => Promise<PlotEventLinkMutationProjection>;
  createEventFromPlot: (
    command: CreateEventFromPlotCommand,
  ) => Promise<PlotEventLinkMutationProjection>;
  linkPlotEvent: (
    command: LinkPlotEventCommand,
  ) => Promise<PlotEventLinkMutationProjection>;
  unlinkPlotEvent: (
    command: UnlinkPlotEventCommand,
  ) => Promise<PlotEventLinkMutationProjection>;
  listPlotEventLinks: (
    command: ListPlotEventLinksCommand,
  ) => Promise<PlotEventLinkListProjection>;
  linkPlotThreadSource: (
    command: LinkPlotThreadSourceCommand,
  ) => Promise<PlotThreadSourceProjection>;
  listPlotThreadSources: (
    command: ListPlotThreadSourcesCommand,
  ) => Promise<PlotThreadSourceListProjection>;
}>;

export function registerPlotsIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: PlotsIpcRuntime;
}>): void {
  const handle = <T>(
    channel: string,
    parse: (value: unknown) => T,
    run: (command: T) => Promise<unknown>,
  ): void => {
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return run(parse(value));
    });
  };

  handle(PLOT_CREATE_CHANNEL, parseCreatePlotThreadCommand, (command) =>
    input.runtime.createPlotThread(command));
  handle(PLOT_LIST_CHANNEL, parseListPlotThreadsCommand, (command) =>
    input.runtime.listPlotThreads(command));
  handle(PLOT_DEFAULT_BOARD_CHANNEL, parseGetDefaultPlotBoardCommand, (command) =>
    input.runtime.getDefaultPlotBoard(command));
  handle(PLOT_MOVE_PLACEMENT_CHANNEL, parseMovePlotPlacementCommand, (command) =>
    input.runtime.movePlotPlacement(command));
  handle(
    PLOT_SET_STORY_TIME_CHANNEL,
    parseSetPlotPlacementStoryTimeCommand,
    (command) => input.runtime.setPlotPlacementStoryTime(command),
  );
  handle(PLOT_UPDATE_CHANNEL, parseUpdatePlotThreadCommand, (command) =>
    input.runtime.updatePlotThread(command));
  handle(PLOT_RETIRE_CHANNEL, parseRetirePlotThreadCommand, (command) =>
    input.runtime.retirePlotThread(command));
  handle(PLOT_CREATE_FROM_EVENT_CHANNEL, parseCreatePlotFromEventCommand, (command) =>
    input.runtime.createPlotFromEvent(command));
  handle(PLOT_CREATE_EVENT_CHANNEL, parseCreateEventFromPlotCommand, (command) =>
    input.runtime.createEventFromPlot(command));
  handle(PLOT_LINK_EVENT_CHANNEL, parseLinkPlotEventCommand, (command) =>
    input.runtime.linkPlotEvent(command));
  handle(PLOT_UNLINK_EVENT_CHANNEL, parseUnlinkPlotEventCommand, (command) =>
    input.runtime.unlinkPlotEvent(command));
  handle(PLOT_EVENT_LINK_LIST_CHANNEL, parseListPlotEventLinksCommand, (command) =>
    input.runtime.listPlotEventLinks(command));
  handle(PLOT_LINK_SOURCE_CHANNEL, parseLinkPlotThreadSourceCommand, (command) =>
    input.runtime.linkPlotThreadSource(command));
  handle(PLOT_SOURCE_LIST_CHANNEL, parseListPlotThreadSourcesCommand, (command) =>
    input.runtime.listPlotThreadSources(command));
}
