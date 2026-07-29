export class InstalledPackageResourceSlot<
  TResource,
> {
  #active: TResource | null = null;

  track(resource: TResource): void {
    if (this.#active !== null) {
      throw new Error(
        "Installed-package resource slot is already occupied",
      );
    }
    this.#active = resource;
  }

  release(resource: TResource): void {
    if (this.#active !== resource) {
      throw new Error(
        "Installed-package resource slot release does not match the active resource",
      );
    }
    this.#active = null;
  }

  async cleanup(
    dispose: (
      resource: TResource,
    ) => Promise<void>,
  ): Promise<void> {
    const resource = this.#active;
    this.#active = null;
    if (resource !== null) {
      await dispose(resource);
    }
  }
}
