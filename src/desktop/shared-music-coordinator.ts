import type { SharedMusicCommand, SharedMusicMessage, SharedMusicSnapshot, SharedMusicState } from "../application/music/shared-music-playback";

/** One audible renderer; all other windows send commands and display its state. */
export class SharedMusicCoordinator {
  readonly #clients = new Map<number, (message: SharedMusicMessage) => void>();
  #ownerId: number | null = null;
  #epoch = 0;
  #revision = 0;
  #state: SharedMusicState | null = null;

  get snapshot(): SharedMusicSnapshot {
    return { epoch: this.#epoch, revision: this.#revision, ownerId: this.#ownerId, state: this.#state };
  }
  attach(clientId: number, send: (message: SharedMusicMessage) => void) {
    this.#clients.set(clientId, send);
    if (this.#ownerId === null) { this.#ownerId = clientId; this.#epoch += 1; }
    this.#broadcast();
    return { clientId, snapshot: this.snapshot };
  }
  detach(clientId: number): void {
    this.#clients.delete(clientId);
    if (this.#ownerId !== clientId) return;
    this.#ownerId = this.#clients.keys().next().value ?? null;
    this.#epoch += 1;
    this.#broadcast();
  }
  command(clientId: number, command: SharedMusicCommand): void {
    if (!this.#clients.has(clientId) || this.#ownerId === null) throw new Error("Music player is unavailable");
    this.#clients.get(this.#ownerId)?.({ type: "command", epoch: this.#epoch, command });
  }
  publish(clientId: number, epoch: number, state: SharedMusicState): void {
    if (clientId !== this.#ownerId || epoch !== this.#epoch) return;
    this.#state = state;
    this.#broadcast();
  }
  #broadcast(): void {
    this.#revision += 1;
    const message: SharedMusicMessage = { type: "snapshot", snapshot: this.snapshot };
    for (const send of this.#clients.values()) send(message);
  }
}
