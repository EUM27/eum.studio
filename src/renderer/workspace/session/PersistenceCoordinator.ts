import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";

export type SerialPersistenceTask = () => Promise<void>;

export type RegularPersistenceQueuePort = Readonly<{
  flushForNavigation: (
    documentId: ManuscriptDocumentSource["documentId"],
  ) => Promise<void>;
}>;

export class SerialPersistenceLane {
  private tail: Promise<void> = Promise.resolve();
  private pending: Promise<void> = Promise.resolve();

  enqueue(task: SerialPersistenceTask): Promise<void> {
    const execution = this.tail.then(task);
    this.pending = execution;
    this.tail = execution.catch(() => undefined);
    return execution;
  }

  waitForPending(): Promise<void> {
    return this.pending;
  }

  waitForSettled(): Promise<void> {
    return this.tail;
  }
}

export async function persistDocumentRegularly(input: Readonly<{
  queue: RegularPersistenceQueuePort | null;
  document: ManuscriptDocumentSource;
  waitForCompositionEnd: (
    document: ManuscriptDocumentSource,
  ) => Promise<void>;
  captureResume: (document: ManuscriptDocumentSource) => Promise<unknown>;
}>): Promise<void> {
  await input.waitForCompositionEnd(input.document);
  await input.queue?.flushForNavigation(input.document.documentId);
  await input.captureResume(input.document);
}
