import {
  createContextPlannerBridge,
  type BridgeInvoke,
  type ContextPlannerBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadContextPlannerBridge(invoke: BridgeInvoke): ContextPlannerBridge {
  return createContextPlannerBridge(invoke);
}
