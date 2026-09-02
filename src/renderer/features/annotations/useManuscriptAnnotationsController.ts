import { useCallback, useEffect, useMemo, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  ManuscriptAnnotationProjection,
  UpdateManuscriptAnnotationCommand,
} from "../../../application/review/manuscript-annotation-contract";
import type { EntityId } from "../../../domain/writing";

export type ManuscriptAnnotationSelection = Readonly<{
  anchor: number;
  head: number;
  from: number;
  to: number;
  empty: boolean;
}>;

export type ManuscriptAnnotationsEditorPort = Readonly<{
  readSelection: (
    document: ManuscriptDocumentSource,
  ) => ManuscriptAnnotationSelection | undefined;
  materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string | undefined;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
}>;

export type ManuscriptAnnotationActionState =
  | "idle"
  | "creating"
  | "updating"
  | "retiring";

function replaceAnnotation(
  annotations: readonly ManuscriptAnnotationProjection[],
  next: ManuscriptAnnotationProjection,
): readonly ManuscriptAnnotationProjection[] {
  return Object.freeze(
    annotations.map((annotation) =>
      annotation.annotationId === next.annotationId ? next : annotation
    ),
  );
}

export function useManuscriptAnnotationsController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  client: StudioBridge["manuscriptAnnotations"];
  editor: ManuscriptAnnotationsEditorPort;
}>) {
  const [annotations, setAnnotations] = useState<
    readonly ManuscriptAnnotationProjection[]
  >([]);
  const [annotationActionState, setAnnotationActionState] =
    useState<ManuscriptAnnotationActionState>("idle");
  const [annotationActionError, setAnnotationActionError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (input.activeWorkId === null) {
      let disposed = false;
      queueMicrotask(() => {
        if (!disposed) {
          setAnnotations([]);
          setAnnotationActionError(null);
        }
      });
      return () => {
        disposed = true;
      };
    }
    let disposed = false;
    void input.client.list({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setAnnotations(projection.annotations);
          setAnnotationActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setAnnotations([]);
          setAnnotationActionError("주석을 불러오지 못했습니다.");
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [input.activeWorkId, input.client]);

  const createAnnotation = useCallback(async (source: Readonly<{
    workId: EntityId<"Work">;
    documentId: EntityId<"Document">;
    selection: Readonly<{ anchor: number; head: number }>;
    exactText: string;
    body: string;
    tags: readonly string[];
  }>): Promise<ManuscriptAnnotationProjection | null> => {
    if (annotationActionState !== "idle") return null;
    setAnnotationActionState("creating");
    setAnnotationActionError(null);
    try {
      const created = await input.client.create({
        schemaVersion: 1,
        ...source,
      });
      setAnnotations((current) => Object.freeze([created, ...current]));
      return created;
    } catch {
      setAnnotationActionError("주석을 저장하지 못했습니다.");
      return null;
    } finally {
      setAnnotationActionState("idle");
    }
  }, [annotationActionState, input.client]);

  const createAnnotationFromCurrentSelection = useCallback(async (
    body: string,
    tags: readonly string[],
  ): Promise<ManuscriptAnnotationProjection | null> => {
    const document = input.activeDocument;
    if (document === null || annotationActionState !== "idle") return null;
    const selection = input.editor.readSelection(document);
    const manuscript = input.editor.materializeDocumentText(document);
    if (selection === undefined || selection.empty || manuscript === undefined) {
      setAnnotationActionError("먼저 원고 구간을 선택해 주세요.");
      return null;
    }
    const exactText = manuscript.slice(selection.from, selection.to);
    if (exactText.length === 0) {
      setAnnotationActionError("먼저 원고 구간을 선택해 주세요.");
      return null;
    }
    try {
      await input.editor.persistDocument(document);
    } catch {
      setAnnotationActionError("원고를 저장한 뒤 주석을 추가하지 못했습니다.");
      return null;
    }
    return createAnnotation({
      workId: document.workId,
      documentId: document.documentId,
      selection: {
        anchor: selection.anchor,
        head: selection.head,
      },
      exactText,
      body,
      tags,
    });
  }, [
    annotationActionState,
    createAnnotation,
    input.activeDocument,
    input.editor,
  ]);

  const updateAnnotation = useCallback(async (
    annotation: ManuscriptAnnotationProjection,
    changes: UpdateManuscriptAnnotationCommand["changes"],
  ): Promise<ManuscriptAnnotationProjection | null> => {
    if (
      annotationActionState !== "idle" ||
      input.activeWorkId === null ||
      annotation.workId !== input.activeWorkId
    ) {
      return null;
    }
    setAnnotationActionState("updating");
    setAnnotationActionError(null);
    try {
      const updated = await input.client.update({
        schemaVersion: 1,
        workId: input.activeWorkId,
        annotationId: annotation.annotationId,
        expectedRevision: annotation.revision,
        changes,
      });
      setAnnotations((current) => replaceAnnotation(current, updated));
      return updated;
    } catch {
      setAnnotationActionError("주석을 수정하지 못했습니다.");
      return null;
    } finally {
      setAnnotationActionState("idle");
    }
  }, [annotationActionState, input.activeWorkId, input.client]);

  const retireAnnotation = useCallback(async (
    annotation: ManuscriptAnnotationProjection,
  ): Promise<boolean> => {
    if (
      annotationActionState !== "idle" ||
      input.activeWorkId === null ||
      annotation.workId !== input.activeWorkId
    ) {
      return false;
    }
    setAnnotationActionState("retiring");
    setAnnotationActionError(null);
    try {
      const retired = await input.client.retire({
        schemaVersion: 1,
        workId: input.activeWorkId,
        annotationId: annotation.annotationId,
        expectedRevision: annotation.revision,
      });
      setAnnotations((current) => Object.freeze(
        current.filter(
          (candidate) => candidate.annotationId !== retired.annotationId,
        ),
      ));
      return true;
    } catch {
      setAnnotationActionError("주석을 삭제하지 못했습니다.");
      return false;
    } finally {
      setAnnotationActionState("idle");
    }
  }, [annotationActionState, input.activeWorkId, input.client]);

  const activeDocumentAnnotations = useMemo(
    () => annotations.filter(
      (annotation) =>
        annotation.sourceDocumentId === input.activeDocument?.documentId,
    ),
    [annotations, input.activeDocument?.documentId],
  );

  return {
    annotations,
    activeDocumentAnnotations,
    annotationActionState,
    annotationActionError,
    clearAnnotationActionError: () => setAnnotationActionError(null),
    createAnnotation,
    createAnnotationFromCurrentSelection,
    updateAnnotation,
    retireAnnotation,
  };
}
