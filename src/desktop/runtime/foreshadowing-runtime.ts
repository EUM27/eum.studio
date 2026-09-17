import type { ForeshadowingIpcRuntime } from "../ipc/register-foreshadowing-ipc";

export function pickForeshadowingRuntime(
  runtime: ForeshadowingIpcRuntime,
): ForeshadowingIpcRuntime {
  return Object.freeze({
    createForeshadowLine: (command) => runtime.createForeshadowLine(command),
    listForeshadowLines: (command) => runtime.listForeshadowLines(command),
    updateForeshadowLine: (command) => runtime.updateForeshadowLine(command),
    retireForeshadowLine: (command) => runtime.retireForeshadowLine(command),
    createForeshadowPoint: (command) => runtime.createForeshadowPoint(command),
    listForeshadowPoints: (command) => runtime.listForeshadowPoints(command),
  });
}
