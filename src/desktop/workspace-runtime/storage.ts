import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createNodeImmutableBlobStore } from "../../platform/storage/node-immutable-blob-store";
import { openNodeSqliteLedger } from "../../platform/storage/node-sqlite-ledger";
import { createLocalWorkspaceBackupService } from "../local-workspace-backup-service";
import { migrateLocalWorkspaceCanonReviewIfNeeded } from "../local-workspace-canon-migration";
import { migrateLocalWorkspaceCharacterExtractionIfNeeded } from "../local-workspace-character-extraction-migration";
import { migrateLocalWorkspaceCharacterGenerationIfNeeded } from "../local-workspace-character-generation-migration";
import { migrateLocalWorkspaceCharacterKnowledgeIfNeeded } from "../local-workspace-character-knowledge-migration";
import { migrateLocalWorkspaceCharacterRelationsIfNeeded } from "../local-workspace-character-relation-migration";
import { migrateLocalWorkspaceContextPlannerIfNeeded } from "../local-workspace-context-planner-migration";
import { migrateLocalWorkspaceContinuityIfNeeded } from "../local-workspace-continuity-migration";
import { migrateLocalWorkspaceDocumentCompletionIfNeeded } from "../local-workspace-document-completion-migration";
import { migrateLocalWorkspaceEpisodeRangeMovesIfNeeded } from "../local-workspace-episode-range-move-migration";
import { migrateLocalWorkspaceEventSourcesIfNeeded } from "../local-workspace-event-source-migration";
import { migrateLocalWorkspaceManuscriptLayoutIfNeeded } from "../local-workspace-manuscript-layout-migration";
import { migrateLocalWorkspaceNarrativeDigestIfNeeded } from "../local-workspace-narrative-digest-migration";
import { migrateLocalWorkspacePlotBoardsIfNeeded } from "../local-workspace-plot-board-migration";
import { migrateLocalWorkspacePlotEventLinksIfNeeded } from "../local-workspace-plot-event-link-migration";
import { migrateLocalWorkspacePublishingFormsIfNeeded } from "../local-workspace-publishing-form-migration";
import { migrateLocalWorkspaceSceneAnalysisIfNeeded } from "../local-workspace-scene-analysis-migration";
import { migrateLocalWorkspaceSceneAnalysisRunsIfNeeded } from "../local-workspace-scene-analysis-run-migration";
import { migrateLocalWorkspaceSceneAnnotationsIfNeeded } from "../local-workspace-scene-annotation-migration";
import { migrateLocalWorkspaceSceneDraftsIfNeeded } from "../local-workspace-scene-draft-migration";
import { migrateLocalWorkspaceSceneExtractionIfNeeded } from "../local-workspace-scene-extraction-migration";
import { migrateLocalWorkspaceSceneInformationUpdateIfNeeded } from "../local-workspace-scene-information-update-migration";
import { migrateLocalWorkspaceSceneMetadataIfNeeded } from "../local-workspace-scene-metadata-migration";
import { migrateLocalWorkspaceSceneMusicQueuesIfNeeded } from "../local-workspace-scene-music-queue-migration";
import { migrateLocalWorkspaceSceneProjectionIfNeeded } from "../local-workspace-scene-projection-migration";
import { migrateLocalWorkspaceSceneTrashIfNeeded } from "../local-workspace-scene-trash-migration";
import type { LocalWorkspaceRuntimeOptions } from "./contracts";
import { restoreRunningPomodoroCycles } from "./repositories/activity";
import { ensureDefaultPlotBoardState } from "./repositories/plots";
import { readRequiredString } from "./repositories/scalars";
import { ensureSceneRuleSetState } from "./repositories/scene-geometry";
import { createLocalWorkspaceRevisionBlobProfile,createLocalWorkspaceStorageProfiles,loadNodeSqlite } from "./storage-profiles";
import { loadWorkspaceState } from "./workspace-state-loader";

export async function openWorkspaceStorage(
  options: LocalWorkspaceRuntimeOptions,
) {
  if (!path.isAbsolute(options.rootDirectoryPath)) {
    throw new Error("Local workspace root path must be absolute");
  }
  await mkdir(options.rootDirectoryPath, { recursive: true });
  const profiles = createLocalWorkspaceStorageProfiles(
    options.rootDirectoryPath,
  );
  await migrateLocalWorkspaceEventSourcesIfNeeded({
    ...profiles.ledgerProfile,
    targetSchemaVersion: 2,
  });
  await migrateLocalWorkspacePlotEventLinksIfNeeded(profiles.ledgerProfile);
  await migrateLocalWorkspacePlotBoardsIfNeeded(profiles.ledgerProfile);
  await migrateLocalWorkspaceSceneProjectionIfNeeded(profiles.ledgerProfile);
  await migrateLocalWorkspaceCharacterExtractionIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceCharacterRelationsIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneExtractionIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceCharacterGenerationIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneAnnotationsIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneMusicQueuesIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneDraftsIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceManuscriptLayoutIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceDocumentCompletionIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceEpisodeRangeMovesIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneMetadataIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneTrashIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceCanonReviewIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceContinuityIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceCharacterKnowledgeIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceContextPlannerIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceNarrativeDigestIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneAnalysisIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneAnalysisRunsIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspacePublishingFormsIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneInformationUpdateIfNeeded(
    profiles.ledgerProfile,
  );
  const ledger = await openNodeSqliteLedger(profiles.ledgerProfile);
  const blobStore = await createNodeImmutableBlobStore(
    profiles.blobStoreProfile,
  );
  const { DatabaseSync } = loadNodeSqlite();
  const database = new DatabaseSync(profiles.databasePath);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    await ensureSceneRuleSetState({
      database,
      ledger,
      defaults: options.defaults,
    });
    await ensureDefaultPlotBoardState({
      database,
      ledger,
      defaults: options.defaults,
    });
    restoreRunningPomodoroCycles(database, Date.now());
    const blobProfile = createLocalWorkspaceRevisionBlobProfile((blobRef) => {
      const rows = database
        .prepare(`
          SELECT created_at AS "createdAt"
          FROM blob_manifests
          WHERE blob_ref = ?
        `)
        .all(blobRef);
      if (rows.length === 0) {
        return null;
      }
      if (rows.length !== 1) {
        throw new Error(`Blob manifest identity is ambiguous: ${blobRef}`);
      }
      return readRequiredString(
        rows[0] ?? {},
        "createdAt",
        "Blob manifest lookup",
      );
    });
    const revisionStore = ledger.createRevisionStore({
      blobStore,
      blobProfile,
    });
    const episodeRangeMoveStore = ledger.createEpisodeRangeMoveStore({
      blobStore,
      blobProfile,
    });
    const sceneTrashStore = ledger.createSceneTrashStore({
      blobStore,
      blobProfile,
    });
    const backupService = createLocalWorkspaceBackupService({
      rootDirectoryPath: options.rootDirectoryPath,
      sourceLocalMediaLibraryRootDirectoryPath:
        options.localMediaLibraryRootDirectoryPath,
      sourceBlobStore: blobStore,
      profile: options.backupProfile,
    });
    const loaded = await loadWorkspaceState(
      database,
      revisionStore,
      options.emptyDocumentProfile,
      ledger.createResumeCheckpointCaptureTransaction({}),
      options.defaults.anchorEvidenceChecksumAlgorithm,
    );
    return {

      database,
      ledger,
      revisionStore,
      episodeRangeMoveStore,
      sceneTrashStore,
      blobStore,
      blobProfile,
      backupService,
      ...loaded,
    };
  } catch (error) {
    database.close();
    ledger.close();
    throw error;
  }
}

export type WorkspaceStorage = Awaited<ReturnType<typeof openWorkspaceStorage>>;

