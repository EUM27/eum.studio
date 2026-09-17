import type { PlotsIpcRuntime } from "../ipc/register-plots-ipc";

export function pickPlotsRuntime(runtime: PlotsIpcRuntime): PlotsIpcRuntime {
  return Object.freeze({
    createPlotThread: (command) => runtime.createPlotThread(command),
    listPlotThreads: (command) => runtime.listPlotThreads(command),
    getDefaultPlotBoard: (command) => runtime.getDefaultPlotBoard(command),
    movePlotPlacement: (command) => runtime.movePlotPlacement(command),
    setPlotPlacementStoryTime: (command) =>
      runtime.setPlotPlacementStoryTime(command),
    updatePlotThread: (command) => runtime.updatePlotThread(command),
    retirePlotThread: (command) => runtime.retirePlotThread(command),
    createPlotFromEvent: (command) => runtime.createPlotFromEvent(command),
    createEventFromPlot: (command) => runtime.createEventFromPlot(command),
    linkPlotEvent: (command) => runtime.linkPlotEvent(command),
    unlinkPlotEvent: (command) => runtime.unlinkPlotEvent(command),
    listPlotEventLinks: (command) => runtime.listPlotEventLinks(command),
    linkPlotThreadSource: (command) => runtime.linkPlotThreadSource(command),
    listPlotThreadSources: (command) =>
      runtime.listPlotThreadSources(command),
  });
}
