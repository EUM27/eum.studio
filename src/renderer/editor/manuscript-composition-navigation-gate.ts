export type ManuscriptCompositionIdentity = Readonly<{
  workId: string;
  documentId: string;
}>;

export type ManuscriptCompositionNavigationControl = Readonly<{
  isComposing: () => boolean;
  blur: () => void;
  afterPaint: (callback: () => void) => void;
  onFallbackEnd: () => void;
}>;

type CompositionWaiter = Readonly<{
  identity: ManuscriptCompositionIdentity;
  resolve: () => void;
  reject: (reason: unknown) => void;
}>;

function matchesIdentity(
  waiter: CompositionWaiter,
  identity: ManuscriptCompositionIdentity,
): boolean {
  return waiter.identity.workId === identity.workId &&
    waiter.identity.documentId === identity.documentId;
}

export class ManuscriptCompositionNavigationGate {
  readonly #waiters = new Set<CompositionWaiter>();

  waitForEnd(
    identity: ManuscriptCompositionIdentity,
    control: ManuscriptCompositionNavigationControl,
  ): Promise<void> {
    if (!control.isComposing()) {
      return Promise.resolve();
    }

    let waiter!: CompositionWaiter;
    const wait = new Promise<void>((resolve, reject) => {
      waiter = Object.freeze({ identity, resolve, reject });
    });
    this.#waiters.add(waiter);

    try {
      control.blur();
      control.afterPaint(() => {
        if (!this.#waiters.delete(waiter)) {
          return;
        }
        if (control.isComposing()) {
          waiter.reject(new Error(
            `IME composition did not end for ${identity.documentId}`,
          ));
          return;
        }
        control.onFallbackEnd();
        waiter.resolve();
      });
    } catch (reason) {
      this.#waiters.delete(waiter);
      waiter.reject(reason);
    }

    return wait;
  }

  resolve(identity: ManuscriptCompositionIdentity): boolean {
    let resolved = false;
    for (const waiter of [...this.#waiters]) {
      if (!matchesIdentity(waiter, identity)) {
        continue;
      }
      this.#waiters.delete(waiter);
      waiter.resolve();
      resolved = true;
    }
    return resolved;
  }

  rejectAll(
    createReason: (identity: ManuscriptCompositionIdentity) => unknown,
  ): void {
    const waiters = [...this.#waiters];
    this.#waiters.clear();
    for (const waiter of waiters) {
      waiter.reject(createReason(waiter.identity));
    }
  }
}
