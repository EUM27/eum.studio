import { randomUUID } from "node:crypto";
import type { ListSceneMusicQueueCandidatesCommand,SceneMusicQueueCandidate,SceneMusicQueueCandidateList,SceneMusicQueueSearchResult,SearchSceneMusicQueuesCommand,SelectSceneMusicQueueCommand } from "../../../application/music/scene-music-queue-contract";
import { parseListSceneMusicQueueCandidatesCommand,parseSceneMusicQueueCandidate,parseSceneMusicQueueCandidateList,parseSceneMusicQueueSearchResult,parseSearchSceneMusicQueuesCommand,parseSelectSceneMusicQueueCommand } from "../../../application/music/scene-music-queue-contract";
import type { SaveWorkMusicSettingsCommand,WorkMusicSettingsProjection } from "../../../application/music/work-music-settings";
import { createDefaultWorkMusicSettingsProjection,parseGetWorkMusicSettingsCommand,parseSaveWorkMusicSettingsCommand,parseWorkMusicSettings,parseWorkMusicSettingsProjection } from "../../../application/music/work-music-settings";
import type { YouTubeVideoProjection } from "../../../application/music/youtube-music";
import { parseYouTubeVideoProjection } from "../../../application/music/youtube-music";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { SceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import type { PreparedSceneMusicQueueSearch } from "../repositories/music";
import { readStoredSceneMusicQueueCandidateRowById,readStoredSceneMusicQueueCandidateRows } from "../repositories/music";
import { readRequiredInteger,readRequiredString } from "../repositories/scalars";
import { readStoredSceneAnnotationRowByKey,readStoredSceneAnnotationRows } from "../repositories/scene-annotations";
import type { NodeSqliteDatabase } from "../storage-contracts";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";
import type { SceneGeometryService } from "./scene-geometry";

/** Owns music commands and their existing transaction boundaries. */
export class MusicService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "musicSettingsProfile" | "sceneMusicSearch">;
  readonly #database: NodeSqliteDatabase;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen" | "assertAssistantWorkExists">;
  readonly #scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially" | "readActiveSceneMetadataBinding">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "musicSettingsProfile" | "sceneMusicSearch">;
    readonly database: NodeSqliteDatabase;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen" | "assertAssistantWorkExists">;
    readonly scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially" | "readActiveSceneMetadataBinding">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#options = input.options;
    this.#database = input.database;
    this.#ledger = input.ledger;
    this.#infrastructure = input.infrastructure;
    this.#scene_geometry = input.scene_geometry;
  }

  getWorkMusicSettings(value: unknown): Promise<WorkMusicSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetWorkMusicSettingsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#getWorkMusicSettingsSerially(command.workId),
    );
  }

  saveWorkMusicSettings(value: unknown): Promise<WorkMusicSettingsProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSaveWorkMusicSettingsCommand(
      value,
      this.#options.musicSettingsProfile,
    );
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#saveWorkMusicSettingsSerially(command);
    });

    return execution;
  }

  searchSceneMusicQueues(
    value: unknown,
  ): Promise<SceneMusicQueueSearchResult> {
    this.#infrastructure.assertOpen();
    const command = parseSearchSceneMusicQueuesCommand(value);
    const preparation = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#prepareSceneMusicQueueSearchSerially(command);
    });

    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const tracks = await prepared.execute();
      const recording = this.#operations.enqueueMutation(async (priorSaves) => {
        await priorSaves;
        return this.#recordSceneMusicQueueSearchSerially(prepared, tracks);
      });

      return recording;
    });
  }

  listSceneMusicQueueCandidates(
    value: unknown,
  ): Promise<SceneMusicQueueCandidateList> {
    this.#infrastructure.assertOpen();
    const command = parseListSceneMusicQueueCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listSceneMusicQueueCandidatesSerially(command)
    );
  }

  selectSceneMusicQueue(
    value: unknown,
  ): Promise<SceneMusicQueueCandidate> {
    this.#infrastructure.assertOpen();
    const command = parseSelectSceneMusicQueueCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#selectSceneMusicQueueSerially(command);
    });

    return execution;
  }

  #getWorkMusicSettingsSerially(
    workId: EntityId<"Work">,
  ): WorkMusicSettingsProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database.prepare(`
      SELECT
        schema_version AS "schemaVersion",
        revision,
        settings_json AS "settingsJson",
        updated_at AS "updatedAt"
      FROM work_music_settings
      WHERE work_id = ?
    `).all(workId);
    if (rows.length === 0) {
      return createDefaultWorkMusicSettingsProjection(
        workId,
        this.#options.musicSettingsProfile,
      );
    }
    if (rows.length !== 1) {
      throw new Error(`Work music settings identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const settingsJson = readRequiredString(
      row,
      "settingsJson",
      "Work music settings row",
    );
    return parseWorkMusicSettingsProjection({
      schemaVersion: readRequiredInteger(
        row,
        "schemaVersion",
        "Work music settings row",
      ),
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work music settings row",
      ),
      settings: parseWorkMusicSettings(
        JSON.parse(settingsJson),
        this.#options.musicSettingsProfile,
      ),
      updatedAt: readRequiredString(
        row,
        "updatedAt",
        "Work music settings row",
      ),
    }, this.#options.musicSettingsProfile);
  }

  #saveWorkMusicSettingsSerially(
    command: SaveWorkMusicSettingsCommand,
  ): WorkMusicSettingsProjection {
    const current = this.#getWorkMusicSettingsSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work music settings revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const updatedAt = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const updated = this.#database.prepare(`
      INSERT INTO work_music_settings (
        work_id,
        schema_version,
        revision,
        settings_json,
        updated_at
      ) VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(work_id) DO UPDATE SET
        revision = excluded.revision,
        settings_json = excluded.settings_json,
        updated_at = excluded.updated_at
      WHERE work_music_settings.revision = ?
    `).run(
      command.workId,
      nextRevision,
      JSON.stringify(command.settings),
      updatedAt,
      command.expectedRevision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Work music settings changed before save: ${command.workId}`);
    }
    return this.#getWorkMusicSettingsSerially(command.workId);
  }

  async #readCurrentSceneAnnotationForMusicSerially(
    workId: EntityId<"Work">,
    sceneKey: string,
  ): Promise<SceneAnnotationProjection | null> {
    const annotation = readStoredSceneAnnotationRowByKey(
      this.#database,
      workId,
      sceneKey,
    );
    if (annotation === null) return null;
    const projection = await this.#scene_geometry.listSceneProjectionSerially({
      schemaVersion: 1,
      workId,
    });
    const scene = projection.scenes.find((entry) =>
      entry.sceneKey === sceneKey &&
      entry.integrity === "resolved" &&
      entry.range !== null &&
      entry.documentId === annotation.documentId &&
      entry.documentRevisionId === annotation.documentRevisionId
    );
    return scene === undefined ? null : annotation;
  }

  async #prepareSceneMusicQueueSearchSerially(
    command: SearchSceneMusicQueuesCommand,
  ): Promise<PreparedSceneMusicQueueSearch> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const sceneAnnotation = await this.#readCurrentSceneAnnotationForMusicSerially(
      command.workId,
      command.sceneKey,
    );
    if (sceneAnnotation === null) {
      throw new Error(`Current scene annotation is unavailable: ${command.sceneKey}`);
    }
    if (sceneAnnotation.revision !== command.expectedAnnotationRevision) {
      throw new Error(`Scene annotation revision conflict: ${command.sceneKey}`);
    }
    const connector = this.#options.sceneMusicSearch;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseSceneMusicQueueSearchResult({
          schemaVersion: 1,
          status: "connection-required",
        }),
      });
    }
    if (
      !Number.isSafeInteger(connector.searchLimit) ||
      connector.searchLimit < 1 ||
      !Number.isSafeInteger(connector.tracksPerOption) ||
      connector.tracksPerOption < 1 ||
      connector.tracksPerOption > connector.searchLimit
    ) {
      throw new Error("Scene music queue profile is invalid");
    }
    return Object.freeze({
      command,
      sceneAnnotation,
      execute: () => connector.execute({
        query: command.query,
        limit: connector.searchLimit,
      }),
    });
  }

  async #recordSceneMusicQueueSearchSerially(
    prepared: Exclude<
      PreparedSceneMusicQueueSearch,
      { result: SceneMusicQueueSearchResult }
    >,
    tracks: readonly YouTubeVideoProjection[],
  ): Promise<SceneMusicQueueSearchResult> {
    const connector = this.#options.sceneMusicSearch;
    if (connector === undefined) {
      throw new Error("Scene music search connector is unavailable");
    }
    const parsedTracks = Object.freeze(tracks.map((track, index) => {
      const parsed = parseYouTubeVideoProjection(
        track,
        `Scene music search tracks[${index}]`,
      );
      if (parsed.providerId !== connector.providerId) {
        throw new Error("Scene music search returned a mismatched track");
      }
      return parsed;
    }));
    const options = Object.freeze(Array.from(
      { length: Math.ceil(parsedTracks.length / connector.tracksPerOption) },
      (_value, index) => Object.freeze({
        optionId: entityId<"SceneMusicQueueOption">(randomUUID()),
        tracks: Object.freeze(parsedTracks.slice(
          index * connector.tracksPerOption,
          (index + 1) * connector.tracksPerOption,
        )),
      }),
    ));
    const currentAnnotation =
      await this.#readCurrentSceneAnnotationForMusicSerially(
        prepared.command.workId,
        prepared.command.sceneKey,
      );
    const integrity =
      currentAnnotation?.sceneAnnotationId ===
          prepared.sceneAnnotation.sceneAnnotationId &&
        currentAnnotation.revision === prepared.sceneAnnotation.revision
        ? "current" as const
        : "stale" as const;
    const annotationBinding = this.#scene_geometry.readActiveSceneMetadataBinding(
      prepared.command.workId,
      "annotation",
      prepared.sceneAnnotation.sceneAnnotationId,
    );
    if (
      annotationBinding === null ||
      annotationBinding.status !== "current" ||
      annotationBinding.sceneId === null ||
      annotationBinding.sourceSceneKey !== prepared.command.sceneKey
    ) {
      throw new Error("Current Scene annotation identity is unavailable");
    }
    const annotationSceneId = annotationBinding.sceneId;
    const createdAt = new Date().toISOString();
    const candidateId = entityId<"SceneMusicQueueCandidate">(randomUUID());
    const bindingId = `scene-binding:music-queue:${prepared.command.workId}:${candidateId}`;
    const candidate = parseSceneMusicQueueCandidate({
      schemaVersion: 1,
      candidateId,
      revision: 1,
      workId: prepared.command.workId,
      sceneKey: prepared.command.sceneKey,
      binding: {
        schemaVersion: 1,
        sceneMetadataBindingId: bindingId,
        revision: 1,
        workId: prepared.command.workId,
        metadataKind: "music-queue",
        metadataId: candidateId,
        sourceSceneKey: prepared.command.sceneKey,
        sceneId: annotationSceneId,
        status: "current",
        proposedSceneId: null,
        lineageOperationId: null,
        createdAt,
        updatedAt: createdAt,
      },
      sceneAnnotationId: prepared.sceneAnnotation.sceneAnnotationId,
      sceneAnnotationRevision: prepared.sceneAnnotation.revision,
      providerId: connector.providerId,
      query: prepared.command.query,
      status: "ready",
      integrity,
      options,
      selectedOptionId: null,
      createdAt,
      updatedAt: createdAt,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "sceneMusicQueueCandidate",
        id: candidate.candidateId,
        schemaVersion: 1,
        requestId: prepared.command.requestId,
        revision: candidate.revision,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
        workId: candidate.workId,
        sceneKey: candidate.sceneKey,
        sceneAnnotationId: candidate.sceneAnnotationId,
        sceneAnnotationRevision: candidate.sceneAnnotationRevision,
        providerId: candidate.providerId,
        query: candidate.query,
        status: candidate.status,
        optionsJson: JSON.stringify(candidate.options),
      });
      transaction.write({
        kind: "sceneMetadataBinding",
        id: bindingId,
        schemaVersion: 1,
        revision: 1,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
        workId: candidate.workId,
        metadataKind: "music-queue",
        metadataId: candidate.candidateId,
        sourceSceneKey: candidate.sceneKey,
        sceneId: annotationSceneId,
        status: "current",
      });
    });
    return parseSceneMusicQueueSearchResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  async listSceneMusicQueueCandidatesSerially(
    command: ListSceneMusicQueueCandidatesCommand,
  ): Promise<SceneMusicQueueCandidateList> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const projection = await this.#scene_geometry.listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const annotations = new Map(
      readStoredSceneAnnotationRows(this.#database, command.workId).map(
        (annotation) => [annotation.sceneKey, annotation] as const,
      ),
    );
    const currentSceneKeys = new Set(projection.scenes.flatMap((scene) => {
      const annotation = annotations.get(scene.sceneKey);
      return scene.integrity === "resolved" &&
          scene.range !== null &&
          annotation !== undefined &&
          scene.documentId === annotation.documentId &&
          scene.documentRevisionId === annotation.documentRevisionId
        ? [scene.sceneKey]
        : [];
    }));
    const candidates = readStoredSceneMusicQueueCandidateRows(
      this.#database,
      command.workId,
    ).map((candidate) => {
      const annotation = annotations.get(candidate.sceneKey);
      return parseSceneMusicQueueCandidate({
        ...candidate,
        integrity:
          currentSceneKeys.has(candidate.sceneKey) &&
            annotation?.sceneAnnotationId === candidate.sceneAnnotationId &&
            annotation.revision === candidate.sceneAnnotationRevision
            ? "current"
            : "stale",
      });
    });
    return parseSceneMusicQueueCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates,
    });
  }

  async #selectSceneMusicQueueSerially(
    command: SelectSceneMusicQueueCommand,
  ): Promise<SceneMusicQueueCandidate> {
    this.#infrastructure.assertAssistantWorkExists(command.workId);
    const stored = readStoredSceneMusicQueueCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Unknown scene music queue Candidate: ${command.candidateId}`);
    }
    if (stored.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Scene music queue Candidate revision conflict: ${command.candidateId}`,
      );
    }
    if (stored.status === "superseded") {
      throw new Error("Superseded scene music queue Candidate cannot be selected");
    }
    if (!stored.options.some((option) => option.optionId === command.optionId)) {
      throw new Error(`Unknown scene music queue option: ${command.optionId}`);
    }
    const currentAnnotation =
      await this.#readCurrentSceneAnnotationForMusicSerially(
        command.workId,
        stored.sceneKey,
      );
    if (
      currentAnnotation === null ||
      currentAnnotation.sceneAnnotationId !== stored.sceneAnnotationId ||
      currentAnnotation.revision !== stored.sceneAnnotationRevision
    ) {
      throw new Error("Stale scene music queue Candidate cannot be selected");
    }
    const changedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare(`
        UPDATE scene_music_queue_candidates
        SET revision = revision + 1, status = 'superseded', updated_at = ?
        WHERE
          work_id = ? AND scene_key = ? AND status = 'selected' AND id <> ?
      `).run(
        changedAt,
        command.workId,
        stored.sceneKey,
        stored.candidateId,
      );
      const selected = this.#database.prepare(`
        UPDATE scene_music_queue_candidates
        SET
          revision = revision + 1,
          status = 'selected',
          selected_option_id = ?,
          updated_at = ?
        WHERE
          work_id = ? AND id = ? AND revision = ?
          AND status IN ('ready', 'selected')
      `).run(
        command.optionId,
        changedAt,
        command.workId,
        command.candidateId,
        command.expectedCandidateRevision,
      );
      if (Number(selected.changes) !== 1) {
        throw new Error(
          `Scene music queue Candidate revision conflict: ${command.candidateId}`,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const next = readStoredSceneMusicQueueCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (next === null) {
      throw new Error(`Scene music queue Candidate disappeared: ${command.candidateId}`);
    }
    return parseSceneMusicQueueCandidate({ ...next, integrity: "current" });
  }
}

