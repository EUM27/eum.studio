export type DocumentTabSession = Readonly<
  Record<string, readonly string[]>
>;

type DocumentTabContext = {
  readonly session: DocumentTabSession;
  readonly workId: string | null;
  readonly orderedDocumentIds: readonly string[];
  readonly activeDocumentId: string | null;
};

type OpenDocumentTabInput = DocumentTabContext & {
  readonly workId: string;
  readonly activeDocumentId: string;
  readonly documentId: string;
};

type CloseDocumentTabInput = OpenDocumentTabInput;

export type CloseDocumentTabResult = Readonly<{
  session: DocumentTabSession;
  nextActiveDocumentId: string;
  closed: boolean;
}>;

function freezeDocumentIds(
  documentIds: readonly string[],
): readonly string[] {
  return Object.freeze([...documentIds]);
}

function replaceWorkTabs(
  session: DocumentTabSession,
  workId: string,
  documentIds: readonly string[],
): DocumentTabSession {
  return Object.freeze({
    ...session,
    [workId]: freezeDocumentIds(documentIds),
  });
}

function requireOwnedDocument(
  orderedDocumentIds: readonly string[],
  documentId: string,
): void {
  if (!orderedDocumentIds.includes(documentId)) {
    throw new Error(
      `The current Work does not own Document ${documentId}`,
    );
  }
}

export function createDocumentTabSession(): DocumentTabSession {
  return Object.freeze({});
}

export function projectDocumentTabs({
  session,
  workId,
  orderedDocumentIds,
  activeDocumentId,
}: DocumentTabContext): readonly string[] {
  if (workId === null || activeDocumentId === null) {
    return Object.freeze([]);
  }

  requireOwnedDocument(orderedDocumentIds, activeDocumentId);
  const openDocumentIds = new Set(session[workId] ?? []);
  openDocumentIds.add(activeDocumentId);

  return freezeDocumentIds(
    orderedDocumentIds.filter((documentId) =>
      openDocumentIds.has(documentId),
    ),
  );
}

export function openDocumentTab({
  session,
  workId,
  orderedDocumentIds,
  activeDocumentId,
  documentId,
}: OpenDocumentTabInput): DocumentTabSession {
  requireOwnedDocument(orderedDocumentIds, documentId);
  const openDocumentIds = new Set(
    projectDocumentTabs({
      session,
      workId,
      orderedDocumentIds,
      activeDocumentId,
    }),
  );
  openDocumentIds.add(documentId);

  return replaceWorkTabs(
    session,
    workId,
    orderedDocumentIds.filter((candidateId) =>
      openDocumentIds.has(candidateId),
    ),
  );
}

export function closeDocumentTab({
  session,
  workId,
  orderedDocumentIds,
  activeDocumentId,
  documentId,
}: CloseDocumentTabInput): CloseDocumentTabResult {
  requireOwnedDocument(orderedDocumentIds, documentId);
  const openDocumentIds = projectDocumentTabs({
    session,
    workId,
    orderedDocumentIds,
    activeDocumentId,
  });
  const closingIndex = openDocumentIds.indexOf(documentId);
  if (closingIndex < 0) {
    throw new Error(`Document tab is not open: ${documentId}`);
  }
  if (openDocumentIds.length === 1) {
    return Object.freeze({
      session,
      nextActiveDocumentId: activeDocumentId,
      closed: false,
    });
  }

  const remainingDocumentIds = openDocumentIds.filter(
    (candidateId) => candidateId !== documentId,
  );
  const nextActiveDocumentId =
    documentId === activeDocumentId
      ? (remainingDocumentIds[closingIndex] ??
        remainingDocumentIds[closingIndex - 1])
      : activeDocumentId;
  if (nextActiveDocumentId === undefined) {
    throw new Error("Closing the tab left no active Document");
  }

  return Object.freeze({
    session: replaceWorkTabs(
      session,
      workId,
      remainingDocumentIds,
    ),
    nextActiveDocumentId,
    closed: true,
  });
}
