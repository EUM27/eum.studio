import {
  createPlotsBridge,
  type BridgeInvoke,
  type PlotsBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadPlotsBridge(invoke: BridgeInvoke): PlotsBridge {
  return createPlotsBridge((channel, payload) => invoke(channel, payload));
}
