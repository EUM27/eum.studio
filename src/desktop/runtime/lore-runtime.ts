import type { LoreIpcRuntime } from "../ipc/register-lore-ipc";

export function pickLoreRuntime(runtime: LoreIpcRuntime): LoreIpcRuntime {
  return Object.freeze({
    createLoreEntry: (command) => runtime.createLoreEntry(command),
    listLoreEntries: (command) => runtime.listLoreEntries(command),
    updateLoreEntry: (command) => runtime.updateLoreEntry(command),
    addLoreEntryEvidence: (command) => runtime.addLoreEntryEvidence(command),
    retireLoreEntry: (command) => runtime.retireLoreEntry(command),
    createLoreCandidate: (command) => runtime.createLoreCandidate(command),
    listLoreCandidates: (command) => runtime.listLoreCandidates(command),
    approveLoreCandidate: (command) => runtime.approveLoreCandidate(command),
    rejectLoreCandidate: (command) => runtime.rejectLoreCandidate(command),
    linkLoreForeshadow: (command) => runtime.linkLoreForeshadow(command),
    listLoreForeshadowLinks: (command) =>
      runtime.listLoreForeshadowLinks(command),
    unlinkLoreForeshadow: (command) => runtime.unlinkLoreForeshadow(command),
  });
}
