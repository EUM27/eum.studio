export type RepeatMode = "off" | "all" | "one";

export type PlaybackOrder = Readonly<{
  order: readonly number[];
  position: number;
  queueLength: number;
  shuffled: boolean;
}>;

export type PlaybackStep = Readonly<{
  index: number;
  state: PlaybackOrder;
}>;

function boundedIndex(queueLength: number, currentIndex: number): number {
  if (queueLength <= 0) return 0;
  return Math.min(Math.max(Math.trunc(currentIndex), 0), queueLength - 1);
}

function shuffled(values: readonly number[], random: () => number): number[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const candidate = Math.min(
      index,
      Math.max(0, Math.floor(random() * (index + 1))),
    );
    [result[index], result[candidate]] = [result[candidate]!, result[index]!];
  }
  return result;
}

function frozenOrder(input: {
  readonly order: readonly number[];
  readonly position: number;
  readonly queueLength: number;
  readonly shuffled: boolean;
}): PlaybackOrder {
  return Object.freeze({
    ...input,
    order: Object.freeze([...input.order]),
  });
}

export function createPlaybackOrder(
  queueLength: number,
  currentIndex: number,
  shuffle: boolean,
  random: () => number = Math.random,
): PlaybackOrder {
  const normalizedLength = Math.max(0, Math.trunc(queueLength));
  if (normalizedLength === 0) {
    return frozenOrder({
      order: [],
      position: 0,
      queueLength: 0,
      shuffled: shuffle,
    });
  }
  const normalizedIndex = boundedIndex(normalizedLength, currentIndex);
  if (!shuffle) {
    return frozenOrder({
      order: Array.from({ length: normalizedLength }, (_, index) => index),
      position: normalizedIndex,
      queueLength: normalizedLength,
      shuffled: false,
    });
  }
  const remaining = Array.from(
    { length: normalizedLength },
    (_, index) => index,
  ).filter((index) => index !== normalizedIndex);
  return frozenOrder({
    order: [normalizedIndex, ...shuffled(remaining, random)],
    position: 0,
    queueLength: normalizedLength,
    shuffled: true,
  });
}

export function withPlaybackShuffle(
  state: PlaybackOrder,
  shuffle: boolean,
  random: () => number = Math.random,
): PlaybackOrder {
  const currentIndex = state.order[state.position] ?? 0;
  return createPlaybackOrder(
    state.queueLength,
    currentIndex,
    shuffle,
    random,
  );
}

function nextShuffledCycle(
  state: PlaybackOrder,
  random: () => number,
): PlaybackStep | null {
  if (state.queueLength === 0) return null;
  const currentIndex = state.order[state.position] ?? 0;
  const order = shuffled(
    Array.from({ length: state.queueLength }, (_, index) => index),
    random,
  );
  if (order.length > 1 && order[0] === currentIndex) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  const nextState = frozenOrder({
    order,
    position: 0,
    queueLength: state.queueLength,
    shuffled: true,
  });
  return Object.freeze({ index: order[0]!, state: nextState });
}

export function nextPlaybackStep(
  state: PlaybackOrder,
  repeatMode: RepeatMode,
  random: () => number = Math.random,
): PlaybackStep | null {
  if (state.queueLength === 0) return null;
  if (state.position < state.order.length - 1) {
    const position = state.position + 1;
    return Object.freeze({
      index: state.order[position]!,
      state: frozenOrder({ ...state, position }),
    });
  }
  if (repeatMode === "off") return null;
  if (state.shuffled) return nextShuffledCycle(state, random);
  const nextState = frozenOrder({ ...state, position: 0 });
  return Object.freeze({ index: nextState.order[0]!, state: nextState });
}

export function previousPlaybackStep(
  state: PlaybackOrder,
  repeatMode: RepeatMode,
): PlaybackStep | null {
  if (state.queueLength === 0) return null;
  if (state.position > 0) {
    const position = state.position - 1;
    return Object.freeze({
      index: state.order[position]!,
      state: frozenOrder({ ...state, position }),
    });
  }
  if (repeatMode === "off" || state.shuffled) return null;
  const position = state.order.length - 1;
  const nextState = frozenOrder({ ...state, position });
  return Object.freeze({ index: nextState.order[position]!, state: nextState });
}

export function endedPlaybackStep(
  state: PlaybackOrder,
  repeatMode: RepeatMode,
  random: () => number = Math.random,
): PlaybackStep | null {
  if (state.queueLength === 0) return null;
  if (repeatMode === "one") {
    return Object.freeze({
      index: state.order[state.position]!,
      state,
    });
  }
  return nextPlaybackStep(state, repeatMode, random);
}
