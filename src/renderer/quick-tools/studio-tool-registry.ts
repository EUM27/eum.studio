export type StudioToolDescriptor = Readonly<{
  id: string;
  label: string;
  detail: string;
  group: string;
  keywords?: readonly string[];
  disabledReason?: string | null;
}>;

export type StudioTool = StudioToolDescriptor & Readonly<{ run: () => void }>;

const EMPTY_TOOLS: readonly StudioToolDescriptor[] = Object.freeze([]);

/** Keeps visible commands current without rerendering the shell for callback changes. */
export class StudioToolRegistry {
  readonly #owners = new Map<string, readonly StudioTool[]>();
  readonly #listeners = new Set<() => void>();
  #snapshot = EMPTY_TOOLS;
  #signature = "[]";

  readonly getSnapshot = (): readonly StudioToolDescriptor[] => this.#snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  publish(owner: string, tools: readonly StudioTool[]): void {
    this.#owners.set(owner, tools);
    this.#refresh();
  }

  remove(owner: string): void {
    if (this.#owners.delete(owner)) this.#refresh();
  }

  run(id: string): boolean {
    for (const tools of this.#owners.values()) {
      const tool = tools.find((candidate) => candidate.id === id);
      if (tool === undefined) continue;
      if (tool.disabledReason) return false;
      tool.run();
      return true;
    }
    return false;
  }

  #refresh(): void {
    const descriptors = Array.from(this.#owners.values()).flat().map(
      ({ id, label, detail, group, keywords, disabledReason }) => Object.freeze({
        id, label, detail, group,
        ...(keywords === undefined ? {} : { keywords }),
        ...(disabledReason === undefined ? {} : { disabledReason }),
      }),
    );
    const signature = JSON.stringify(descriptors);
    if (signature === this.#signature) return;
    this.#signature = signature;
    this.#snapshot = Object.freeze(descriptors);
    for (const listener of this.#listeners) listener();
  }
}
