import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  DocumentRevisionContentProjection,
  DocumentRevisionProjection,
  WorkSnapshotProjection,
} from "../../../application/revisions/work-version-contract";
import type { WorkSnapshotComparisonProjection } from "../../../application/revisions/work-snapshot-comparison";
import type { EntityId } from "../../../domain/writing";

type VersionProjectionLoadResult = {
  readonly sequence: number;
  readonly revisions: readonly DocumentRevisionProjection[];
  readonly snapshots: readonly WorkSnapshotProjection[];
  readonly error: string | null;
};

export function useVersionController(input: Readonly<{
  client: StudioBridge["version"];
  document: ManuscriptDocumentSource | null;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  reloadAfterRestore: (
    documentId: EntityId<"Document">,
  ) => Promise<void>;
}>) {
  const versionLoadSequenceRef = useRef(0);
  const [documentRevisions, setDocumentRevisions] = useState<
    readonly DocumentRevisionProjection[]
  >([]);
  const [highlightedDocumentRevisionId, setHighlightedDocumentRevisionId] =
    useState<EntityId<"DocumentRevision"> | null>(null);
  const [documentRevisionPreview, setDocumentRevisionPreview] = useState<
    Readonly<{
      documentTitle: string;
      projection: DocumentRevisionContentProjection;
    }> | null
  >(null);
  const [workSnapshots, setWorkSnapshots] = useState<
    readonly WorkSnapshotProjection[]
  >([]);
  const [workSnapshotComparison, setWorkSnapshotComparison] =
    useState<WorkSnapshotComparisonProjection | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [versionActionState, setVersionActionState] = useState<
    | "idle"
    | "refreshing"
    | "restoring"
    | "creating-snapshot"
    | "comparing-snapshot"
  >("idle");
  const [versionActionError, setVersionActionError] = useState<string | null>(
    null,
  );

  const loadVersionProjections = useCallback(async () => {
    const sequence = versionLoadSequenceRef.current + 1;
    versionLoadSequenceRef.current = sequence;
    if (input.document === null) return null;
    try {
      const [revisionProjection, snapshotProjection] = await Promise.all([
        input.client.listDocumentRevisions({
          schemaVersion: 1,
          workId: input.document.workId,
          documentId: input.document.documentId,
        }),
        input.client.listWorkSnapshots({
          schemaVersion: 1,
          workId: input.document.workId,
        }),
      ]);
      return {
        sequence,
        revisions: revisionProjection.revisions,
        snapshots: snapshotProjection.snapshots,
        error: null,
      } satisfies VersionProjectionLoadResult;
    } catch {
      return {
        sequence,
        revisions: [],
        snapshots: [],
        error: "버전 기록을 불러오지 못했습니다.",
      } satisfies VersionProjectionLoadResult;
    }
  }, [input.client, input.document]);

  const applyVersionProjections = useCallback(
    (result: VersionProjectionLoadResult | null) => {
      if (
        result === null ||
        versionLoadSequenceRef.current !== result.sequence
      ) return;
      setDocumentRevisions(result.revisions);
      setWorkSnapshots(result.snapshots);
      setVersionActionError(result.error);
    },
    [],
  );

  const refreshVersionProjections = useCallback(async () => {
    applyVersionProjections(await loadVersionProjections());
  }, [applyVersionProjections, loadVersionProjections]);

  useEffect(() => {
    let disposed = false;
    void loadVersionProjections().then((result) => {
      if (!disposed) applyVersionProjections(result);
    });
    return () => {
      disposed = true;
    };
  }, [applyVersionProjections, loadVersionProjections]);

  const loadDocumentRevisionPreview = useCallback(async (
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
    documentTitle: string,
  ) => {
    setVersionActionError(null);
    try {
      const projection = await input.client.readDocumentRevision({
        schemaVersion: 1,
        workId,
        documentId,
        revisionId,
      });
      setHighlightedDocumentRevisionId(revisionId);
      setDocumentRevisionPreview({ documentTitle, projection });
    } catch {
      setVersionActionError("완료 당시 원고 버전을 불러오지 못했습니다.");
    }
  }, [input.client]);

  const highlightDocumentRevision = useCallback(
    (revisionId: EntityId<"DocumentRevision">) => {
      setHighlightedDocumentRevisionId(revisionId);
    },
    [],
  );

  const closeDocumentRevisionPreview = useCallback(() => {
    setDocumentRevisionPreview(null);
  }, []);

  const refreshStoredVersions = useCallback(async () => {
    if (input.document === null || versionActionState !== "idle") return;
    setVersionActionState("refreshing");
    setVersionActionError(null);
    try {
      await input.persistDocument(input.document);
      await refreshVersionProjections();
    } catch {
      setVersionActionError("현재 저장 상태의 버전 기록을 불러오지 못했습니다.");
    } finally {
      setVersionActionState("idle");
    }
  }, [input, refreshVersionProjections, versionActionState]);

  const restoreDocumentRevision = useCallback(async (
    targetRevisionId: DocumentRevisionProjection["revisionId"],
  ) => {
    if (input.document === null || versionActionState !== "idle") return;
    setVersionActionState("restoring");
    setVersionActionError(null);
    try {
      await input.persistDocument(input.document);
      await input.client.restoreDocumentRevision({
        schemaVersion: 1,
        workId: input.document.workId,
        documentId: input.document.documentId,
        targetRevisionId,
      });
      await input.reloadAfterRestore(input.document.documentId);
    } catch {
      setVersionActionError("선택한 문서 버전으로 복원하지 못했습니다.");
    } finally {
      setVersionActionState("idle");
    }
  }, [input, versionActionState]);

  const createWorkSnapshot = useCallback(async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const label = snapshotLabel.trim();
    if (
      input.document === null ||
      label.length === 0 ||
      versionActionState !== "idle"
    ) return;
    setVersionActionState("creating-snapshot");
    setVersionActionError(null);
    try {
      await input.persistDocument(input.document);
      await input.client.createWorkSnapshot({
        schemaVersion: 1,
        workId: input.document.workId,
        label,
      });
      setSnapshotLabel("");
      await refreshVersionProjections();
    } catch {
      setVersionActionError("작품 스냅샷을 만들지 못했습니다.");
    } finally {
      setVersionActionState("idle");
    }
  }, [input, refreshVersionProjections, snapshotLabel, versionActionState]);

  const compareWorkSnapshot = useCallback(async (
    workSnapshotId: WorkSnapshotProjection["workSnapshotId"],
  ) => {
    if (input.document === null || versionActionState !== "idle") return;
    const sequence = versionLoadSequenceRef.current + 1;
    versionLoadSequenceRef.current = sequence;
    setVersionActionState("comparing-snapshot");
    setVersionActionError(null);
    setWorkSnapshotComparison(null);
    try {
      await input.persistDocument(input.document);
      const projection = await input.client.compareWorkSnapshot({
        schemaVersion: 1,
        workId: input.document.workId,
        workSnapshotId,
      });
      if (versionLoadSequenceRef.current !== sequence) return;
      setWorkSnapshotComparison(projection);
    } catch {
      if (versionLoadSequenceRef.current === sequence) {
        setVersionActionError("작품 스냅샷을 비교하지 못했습니다.");
      }
    } finally {
      setVersionActionState((current) =>
        current === "comparing-snapshot" ? "idle" : current,
      );
    }
  }, [input, versionActionState]);

  const closeWorkSnapshotComparison = useCallback(() => {
    versionLoadSequenceRef.current += 1;
    setWorkSnapshotComparison(null);
  }, []);

  const changeSnapshotLabel = useCallback((value: string) => {
    setSnapshotLabel(value);
  }, []);

  return {
    documentRevisions,
    highlightedDocumentRevisionId,
    documentRevisionPreview,
    workSnapshots,
    workSnapshotComparison,
    snapshotLabel,
    versionActionState,
    versionActionError,
    loadDocumentRevisionPreview,
    highlightDocumentRevision,
    closeDocumentRevisionPreview,
    refreshStoredVersions,
    restoreDocumentRevision,
    createWorkSnapshot,
    compareWorkSnapshot,
    closeWorkSnapshotComparison,
    changeSnapshotLabel,
  };
}
