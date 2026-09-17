import { useCallback, useMemo, useState } from "react";

export function useWorkStructureState() {
  const [workStructureDialogOpen, setWorkStructureDialogOpen] =
    useState(false);
  const [workStructureActionState, setWorkStructureActionState] =
    useState<"idle" | "opening">("idle");
  const [workStructureActionError, setWorkStructureActionError] = useState<
    string | null
  >(null);

  const openWorkStructureDialog = useCallback(() => {
    setWorkStructureActionError(null);
    setWorkStructureDialogOpen(true);
  }, []);
  const closeWorkStructureDialog = useCallback(() => {
    if (workStructureActionState !== "idle") return;
    setWorkStructureDialogOpen(false);
    setWorkStructureActionError(null);
  }, [workStructureActionState]);
  const hideWorkStructureDialog = useCallback(() => {
    setWorkStructureDialogOpen(false);
  }, []);
  const reopenWorkStructureDialog = useCallback(() => {
    setWorkStructureDialogOpen(true);
  }, []);
  const startWorkStructureNavigation = useCallback((hideDialog: boolean) => {
    setWorkStructureActionState("opening");
    setWorkStructureActionError(null);
    if (hideDialog) setWorkStructureDialogOpen(false);
  }, []);
  const finishWorkStructureNavigation = useCallback(() => {
    setWorkStructureActionState("idle");
  }, []);
  const clearWorkStructureActionError = useCallback(() => {
    setWorkStructureActionError(null);
  }, []);
  const reportWorkStructureActionError = useCallback((message: string) => {
    setWorkStructureActionError(message);
  }, []);

  return useMemo(() => ({
    workStructureDialogOpen,
    workStructureActionState,
    workStructureActionError,
    openWorkStructureDialog,
    closeWorkStructureDialog,
    hideWorkStructureDialog,
    reopenWorkStructureDialog,
    startWorkStructureNavigation,
    finishWorkStructureNavigation,
    clearWorkStructureActionError,
    reportWorkStructureActionError,
  }), [
    clearWorkStructureActionError,
    closeWorkStructureDialog,
    finishWorkStructureNavigation,
    hideWorkStructureDialog,
    openWorkStructureDialog,
    reopenWorkStructureDialog,
    reportWorkStructureActionError,
    startWorkStructureNavigation,
    workStructureActionError,
    workStructureActionState,
    workStructureDialogOpen,
  ]);
}
