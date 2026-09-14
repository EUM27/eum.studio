import { parseMusicTrackProjection, type MusicTrackProjection } from "./media-track";

export const SHARED_MUSIC_MESSAGE_CHANNEL = "studio:music:shared-message";
export const SHARED_MUSIC_ATTACH_CHANNEL = "studio:music:shared-attach";
export const SHARED_MUSIC_DETACH_CHANNEL = "studio:music:shared-detach";
export const SHARED_MUSIC_COMMAND_CHANNEL = "studio:music:shared-command";
export const SHARED_MUSIC_PUBLISH_CHANNEL = "studio:music:shared-publish";
export const WORK_MUSIC_SETTINGS_CHANGED_CHANNEL = "studio:music:settings-changed";

export type SharedMusicState = Readonly<{
  queue: readonly MusicTrackProjection[];
  currentIndex: number;
  paused: boolean;
  loading: boolean;
  error: string | null;
  volume: number;
  previousAudibleVolume: number;
  currentTime: number;
  duration: number;
  repeatMode: "off" | "all" | "one";
  shuffle: boolean;
  showVideo: boolean;
  order: Readonly<{ order: readonly number[]; position: number; queueLength: number; shuffled: boolean }>;
}>;
export type SharedMusicCommand =
  | Readonly<{ type: "play-queue"; tracks: readonly MusicTrackProjection[]; startIndex: number }>
  | Readonly<{ type: "seek" | "volume"; value: number }>
  | Readonly<{ type: "video"; visible: boolean }>
  | Readonly<{ type: "toggle" | "previous" | "next" | "stop" | "repeat" | "shuffle" | "mute" }>;
export type SharedMusicSnapshot = Readonly<{ epoch: number; revision: number; ownerId: number | null; state: SharedMusicState | null }>;
export type SharedMusicMessage =
  | Readonly<{ type: "snapshot"; snapshot: SharedMusicSnapshot }>
  | Readonly<{ type: "command"; epoch: number; command: SharedMusicCommand }>;
export type SharedMusicBridge = Readonly<{
  attach: () => Promise<Readonly<{ clientId: number; snapshot: SharedMusicSnapshot }>>;
  detach: () => Promise<void>;
  command: (command: SharedMusicCommand) => Promise<void>;
  publish: (epoch: number, state: SharedMusicState) => Promise<void>;
  onMessage: (listener: (message: SharedMusicMessage) => void) => () => void;
  onSettingsChanged: (listener: (workId: string) => void) => () => void;
}>;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid shared music value");
  return value as Record<string, unknown>;
}
function number(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) throw new Error("Invalid shared music number");
  return value;
}
export function parseSharedMusicCommand(value: unknown): SharedMusicCommand {
  const input = record(value);
  if (input.type === "play-queue") {
    if (!Array.isArray(input.tracks) || input.tracks.length === 0) throw new Error("A playback queue is required");
    const tracks = input.tracks.map((track) => parseMusicTrackProjection(track));
    const startIndex = number(input.startIndex, tracks.length - 1);
    if (!Number.isInteger(startIndex)) throw new Error("Invalid playback index");
    return { type: input.type, tracks, startIndex };
  }
  if (input.type === "seek" || input.type === "volume") return { type: input.type, value: number(input.value, input.type === "volume" ? 100 : undefined) };
  if (input.type === "video" && typeof input.visible === "boolean") return { type: "video", visible: input.visible };
  if (["toggle", "previous", "next", "stop", "repeat", "shuffle", "mute"].includes(String(input.type))) {
    return { type: input.type as "toggle" | "previous" | "next" | "stop" | "repeat" | "shuffle" | "mute" };
  }
  throw new Error("Unknown shared music command");
}
export function parseSharedMusicState(value: unknown): SharedMusicState {
  const input = record(value);
  if (!Array.isArray(input.queue)) throw new Error("Invalid shared playback queue");
  const queue = input.queue.map((track) => parseMusicTrackProjection(track));
  const currentIndex = number(input.currentIndex, Math.max(0, queue.length - 1));
  if (!Number.isInteger(currentIndex)) throw new Error("Invalid shared playback index");
  for (const key of ["paused", "loading", "shuffle", "showVideo"] as const) {
    if (typeof input[key] !== "boolean") throw new Error(`Invalid music ${key}`);
  }
  if (input.error !== null && typeof input.error !== "string") throw new Error("Invalid music error");
  if (!["off", "all", "one"].includes(String(input.repeatMode))) throw new Error("Invalid repeat mode");
  const order = record(input.order);
  if (!Array.isArray(order.order) || order.queueLength !== queue.length || typeof order.shuffled !== "boolean") throw new Error("Invalid playback order");
  const indices = order.order.map((index) => number(index, Math.max(0, queue.length - 1)));
  if (indices.length !== queue.length || new Set(indices).size !== indices.length || indices.some((index) => !Number.isInteger(index))) throw new Error("Invalid playback order indices");
  const position = number(order.position, Math.max(0, queue.length - 1));
  if (!Number.isInteger(position)) throw new Error("Invalid playback order position");
  return {
    queue, currentIndex, paused: input.paused as boolean, loading: input.loading as boolean,
    error: input.error as string | null, volume: number(input.volume, 100), previousAudibleVolume: number(input.previousAudibleVolume, 100),
    currentTime: number(input.currentTime), duration: number(input.duration),
    repeatMode: input.repeatMode as SharedMusicState["repeatMode"], shuffle: input.shuffle as boolean,
    showVideo: input.showVideo as boolean,
    order: { order: indices, position, queueLength: queue.length, shuffled: order.shuffled },
  };
}

export function parseSharedMusicSnapshot(value: unknown): SharedMusicSnapshot {
  const input = record(value);
  const epoch = number(input.epoch);
  const revision = number(input.revision);
  const ownerId = input.ownerId === null ? null : number(input.ownerId);
  if (![epoch, revision, ownerId ?? 0].every(Number.isSafeInteger)) throw new Error("Invalid music session identity");
  return { epoch, revision, ownerId, state: input.state === null ? null : parseSharedMusicState(input.state) };
}
export function parseSharedMusicMessage(value: unknown): SharedMusicMessage {
  const input = record(value);
  if (input.type === "snapshot") return { type: "snapshot", snapshot: parseSharedMusicSnapshot(input.snapshot) };
  if (input.type === "command" && Number.isSafeInteger(input.epoch)) return { type: "command", epoch: number(input.epoch), command: parseSharedMusicCommand(input.command) };
  throw new Error("Invalid shared music message");
}
