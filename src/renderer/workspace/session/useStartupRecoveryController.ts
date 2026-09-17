import { useCallback } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import { createApplyStartupRecoveryCommand } from "../../../application/persistence/startup-recovery-contract";
import type { RuntimeProjection } from "./RuntimeBootstrapController";

export function useStartupRecoveryController(input: Readonly<{
  applyClient: Pick<
    StudioBridge["editor"],
    "applyManuscriptStartupRecovery"
  >;
  applyState: string;
  installRuntime: (
    projection: RuntimeProjection,
    preferredDocumentId: RuntimeProjection["documentProfile"]["initialDocumentId"] | null,
  ) => void;
  loadRuntime: () => Promise<RuntimeProjection>;
  runtime: Readonly<{
    activeDocumentId: RuntimeProjection["documentProfile"]["initialDocumentId"] | null;
    startupRecovery: RuntimeProjection["startupRecovery"];
  }> | null;
  setApplyState: (state: "idle" | "applying" | "failed") => void;
}>) {
  return useCallback(async () => {
    if (
      input.runtime === null ||
      input.runtime.startupRecovery.status !== "recovery-pending" ||
      !input.runtime.startupRecovery.applyAvailable ||
      input.applyState === "applying"
    ) return;
    const activeDocumentId = input.runtime.activeDocumentId;
    input.setApplyState("applying");
    try {
      const command = createApplyStartupRecoveryCommand(
        input.runtime.startupRecovery.candidate,
      );
      await input.applyClient.applyManuscriptStartupRecovery(command);
      const projection = await input.loadRuntime();
      input.installRuntime(projection, activeDocumentId);
      input.setApplyState("idle");
    } catch {
      input.setApplyState("failed");
    }
  }, [input]);
}
