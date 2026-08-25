import { useState } from "react";

export type WorkspaceActionState =
  | "idle"
  | "switching"
  | "creating-document"
  | "creating-work"
  | "renaming-work"
  | "renaming-document"
  | "retiring-work"
  | "retiring-document"
  | "retiring-all-documents"
  | "moving-document"
  | "managing-document-folders"
  | "setting-document-completion";

export function useWorkspaceLifecycle() {
  const [workspaceActionState, setWorkspaceActionState] =
    useState<WorkspaceActionState>("idle");
  const [workspaceActionError, setWorkspaceActionError] =
    useState<string | null>(null);

  return {
    workspaceActionState,
    setWorkspaceActionState,
    workspaceActionError,
    setWorkspaceActionError,
  };
}
