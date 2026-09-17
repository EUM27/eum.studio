import { workspaceWindowContext } from "../workspace-window-context";

/**
 * Owns the runtime's three operation tails. Each mutation receives the saves
 * preceding its enqueue point, so a later transfer cannot become its dependency.
 * A read observes both tails without adding work to either.
 * Analysis has its own lane so external analysis does not hold up later saves.
 */
export class WorkspaceOperationCoordinator {
  #saveTail: Promise<void> = Promise.resolve();
  #mutationTail: Promise<void> = Promise.resolve();
  #analysisTail: Promise<void> = Promise.resolve();

  get saveTail(): Promise<void> { return this.#saveTail; }
  get mutationTail(): Promise<void> { return this.#mutationTail; }
  get analysisTail(): Promise<void> { return this.#analysisTail; }

  readBarrier(): Promise<[void, void]> {
    return Promise.all([this.#mutationTail, this.#saveTail]);
  }

  enqueueSave<T>(run: () => T | PromiseLike<T>): Promise<T> {
    const preceding = workspaceWindowContext.getStore()?.multipleWindows === true
      ? Promise.all([this.#saveTail, this.#mutationTail])
      : this.#saveTail;
    const execution = preceding.then(run);
    this.#saveTail = this.#settled(execution);
    return execution;
  }

  enqueueMutation<T>(run: (priorSaves: Promise<void>) => T | PromiseLike<T>): Promise<T> {
    const priorSaves = this.#saveTail;
    if (workspaceWindowContext.getStore()?.multipleWindows === true) {
      return this.enqueueTransfer(() => run(priorSaves));
    }
    const execution = this.#mutationTail.then(() => run(priorSaves));
    this.#mutationTail = this.#settled(execution);
    return execution;
  }

  enqueueAnalysis<T>(run: () => T | PromiseLike<T>): Promise<T> {
    const execution = this.#analysisTail.then(run);
    this.#analysisTail = this.#settled(execution);
    return execution;
  }

  enqueueTransfer<T>(run: () => T | PromiseLike<T>): Promise<T> {
    const execution = Promise.all([this.#mutationTail, this.#saveTail]).then(run);
    const settled = this.#settled(execution);
    this.#mutationTail = settled;
    this.#saveTail = settled;
    return execution;
  }

  #settled(execution: Promise<unknown>): Promise<void> {
    return execution.then(() => undefined, () => undefined);
  }
}
