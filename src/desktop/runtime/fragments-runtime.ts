import type { FragmentsIpcRuntime } from "../ipc/register-fragments-ipc";

export function pickFragmentsRuntime(
  runtime: FragmentsIpcRuntime,
): FragmentsIpcRuntime {
  return Object.freeze({
    captureFragment: (command) => runtime.captureFragment(command),
    listFragments: (command) => runtime.listFragments(command),
    updateFragment: (command) => runtime.updateFragment(command),
    recordFragmentUse: (command) => runtime.recordFragmentUse(command),
    retireFragment: (command) => runtime.retireFragment(command),
  });
}
