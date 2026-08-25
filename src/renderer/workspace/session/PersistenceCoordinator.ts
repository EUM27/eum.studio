import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";

export type SerialPersistenceTask = () => Promise<void>;

export type RegularPersistenceQueuePort = Readonly<{
  flush: (
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
  captureResume: (document: ManuscriptDocumentSource) => Promise<unknown>;
}>): Promise<void> {
  await input.queue?.flush(input.document.documentId);
  await input.captureResume(input.document);
}
