import { useState } from "react";

import { createDocumentTabSession } from "../../document-tab-state";
import type {
  WorkspaceRecoveryApplyState,
  WorkspaceRuntimeState,
} from "./workspace-session-state";

export function useWorkspaceSession() {
  const [runtime, setRuntime] = useState<WorkspaceRuntimeState>({
    status: "loading",
  });
  const [recoveryApplyState, setRecoveryApplyState] =
    useState<WorkspaceRecoveryApplyState>("idle");
  const [documentTabSession, setDocumentTabSession] = useState(
    createDocumentTabSession,
  );

  return {
    runtime,
    setRuntime,
    recoveryApplyState,
    setRecoveryApplyState,
    documentTabSession,
    setDocumentTabSession,
  };
}
