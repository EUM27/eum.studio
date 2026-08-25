import { useCallback, useEffect, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { LegacyLoreImportRehearsalSummary } from "../../../application/migration/legacy-lore-import-contract";
import type { LocalWorkspaceBackupStatusProjection } from "../../../application/storage/local-workspace-backup-contract";
import type { WorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";

export function useBackupMigrationController(input: Readonly<{
  acceptCatalog: (catalog: WorkspaceCatalogProjection) => void;
  backupClient: StudioBridge["backup"];
  migrationClient: StudioBridge["migration"];
  shellActionState: string;
  workspace: Readonly<{
    isAvailable: () => boolean;
    prepareForMain: () => Promise<WorkspaceCatalogProjection>;
  }>;
}>) {
  const [showBackup, setShowBackup] = useState(false);
  const [showImportRehearsal, setShowImportRehearsal] = useState(false);
  const [backupStatus, setBackupStatus] = useState<
    LocalWorkspaceBackupStatusProjection | null
  >(null);
  const [backupActionState, setBackupActionState] = useState<
    "loading" | "idle" | "creating" | "restoring"
  >("loading");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [importRehearsalRunning, setImportRehearsalRunning] = useState(false);
  const [importRehearsalSummary, setImportRehearsalSummary] = useState<
    LegacyLoreImportRehearsalSummary | null
  >(null);
  const [importRehearsalError, setImportRehearsalError] = useState<
    string | null
  >(null);

  const loadBackupStatus = useCallback(async () => {
    setBackupActionState("loading");
    setBackupError(null);
    try {
      setBackupStatus(await input.backupClient.getStatus());
    } catch {
      setBackupStatus(null);
      setBackupError("백업 기록을 불러오지 못했습니다.");
    } finally {
      setBackupActionState("idle");
    }
  }, [input.backupClient]);

  useEffect(() => {
    let disposed = false;
    void input.backupClient.getStatus().then(
      (status) => {
        if (!disposed) {
          setBackupStatus(status);
          setBackupActionState("idle");
        }
      },
      () => {
        if (!disposed) {
          setBackupStatus(null);
          setBackupError("백업 기록을 불러오지 못했습니다.");
          setBackupActionState("idle");
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [input.backupClient]);

  const openBackup = useCallback(() => {
    setShowBackup(true);
    void loadBackupStatus();
  }, [loadBackupStatus]);
  const closeBackup = useCallback(() => {
    if (backupActionState !== "idle") return;
    setShowBackup(false);
    setBackupError(null);
  }, [backupActionState]);
  const openImportRehearsal = useCallback(() => {
    setImportRehearsalError(null);
    setShowImportRehearsal(true);
  }, []);
  const closeImportRehearsal = useCallback(() => {
    if (importRehearsalRunning) return;
    setShowImportRehearsal(false);
    setImportRehearsalError(null);
  }, [importRehearsalRunning]);

  const runBackupAction = useCallback((action: "create" | "restore") => {
    if (
      backupActionState !== "idle" ||
      input.shellActionState !== "idle"
    ) return;
    setBackupActionState(action === "create" ? "creating" : "restoring");
    setBackupError(null);
    void (async () => {
      try {
        if (action === "create" && input.workspace.isAvailable()) {
          input.acceptCatalog(await input.workspace.prepareForMain());
        }
        const result = action === "create"
          ? await input.backupClient.create()
          : await input.backupClient.restore();
        if (result.status === "completed") {
          setBackupStatus({ schemaVersion: 1, lastVerified: result.summary });
        }
      } catch {
        setBackupError(
          action === "create"
            ? "백업을 만들지 못했습니다."
            : "백업을 새 위치에 복원하지 못했습니다.",
        );
      } finally {
        setBackupActionState("idle");
      }
    })();
  }, [backupActionState, input]);

  const runImportRehearsal = useCallback(() => {
    if (
      importRehearsalRunning ||
      input.shellActionState !== "idle" ||
      backupActionState !== "idle"
    ) return;
    setImportRehearsalRunning(true);
    setImportRehearsalError(null);
    void (async () => {
      try {
        if (input.workspace.isAvailable()) {
          input.acceptCatalog(await input.workspace.prepareForMain());
        }
        const result = await input.migrationClient.runLegacyLoreRehearsal();
        if (result.status === "completed") {
          setImportRehearsalSummary(result.summary);
        }
      } catch {
        setImportRehearsalError(
          "기존 작업 가져오기 리허설을 완료하지 못했습니다.",
        );
      } finally {
        setImportRehearsalRunning(false);
      }
    })();
  }, [backupActionState, importRehearsalRunning, input]);

  return {
    showBackup,
    showImportRehearsal,
    backupStatus,
    backupActionState,
    backupError,
    importRehearsalRunning,
    importRehearsalSummary,
    importRehearsalError,
    openBackup,
    closeBackup,
    openImportRehearsal,
    closeImportRehearsal,
    runBackupAction,
    runImportRehearsal,
  };
}
