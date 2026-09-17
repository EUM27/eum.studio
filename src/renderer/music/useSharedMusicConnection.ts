import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { SharedMusicBridge, SharedMusicCommand, SharedMusicSnapshot, SharedMusicState } from "../../application/music/shared-music-playback";

export type SharedMusicHandlers = {
  command: (command: SharedMusicCommand) => void;
  restore: (state: SharedMusicState) => void;
  silence: () => void;
  error: (message: string) => void;
};

export function useSharedMusicConnection(bridge: SharedMusicBridge | undefined, handlers: RefObject<SharedMusicHandlers>) {
  const [snapshot, setSnapshot] = useState<SharedMusicSnapshot | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const identityRef = useRef<number | null>(null);
  const snapshotRef = useRef<SharedMusicSnapshot | null>(null);
  const ownerRef = useRef(bridge === undefined);
  const registrationRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    if (bridge === undefined) return;
    const callbacks = handlers.current;
    let disposed = false;
    let pending: SharedMusicSnapshot | null = null;
    const apply = (next: SharedMusicSnapshot) => {
      if (disposed) return;
      if (identityRef.current === null) { pending = next; return; }
      if (snapshotRef.current !== null && next.revision < snapshotRef.current.revision) return;
      const wasOwner = ownerRef.current;
      const owns = next.ownerId === identityRef.current;
      ownerRef.current = owns;
      snapshotRef.current = next;
      flushSync(() => {
        if (wasOwner && !owns) callbacks.silence();
        if (!wasOwner && owns && next.state !== null) callbacks.restore(next.state);
        setSnapshot(next);
      });
    };
    const unsubscribe = bridge.onMessage((message) => {
      if (message.type === "snapshot") { apply(message.snapshot); return; }
      if (ownerRef.current && message.epoch === snapshotRef.current?.epoch) {
        flushSync(() => callbacks.command(message.command));
      }
    });
    const registration = bridge.attach().then((result) => {
      if (disposed) { void bridge.detach(); return; }
      identityRef.current = result.clientId;
      setClientId(result.clientId);
      apply(result.snapshot);
      if (pending !== null) apply(pending);
    }).catch((reason: unknown) => {
      if (!disposed) callbacks.error(reason instanceof Error ? reason.message : "공유 음악 재생기를 연결하지 못했습니다.");
    });
    registrationRef.current = registration;
    return () => {
      disposed = true;
      ownerRef.current = false;
      callbacks.silence();
      unsubscribe();
      void registration.then(() => bridge.detach()).catch(() => undefined);
    };
  }, [bridge, handlers]);

  const command = useCallback(async (value: SharedMusicCommand) => {
    if (bridge === undefined) { handlers.current.command(value); return; }
    await registrationRef.current;
    await bridge.command(value);
  }, [bridge, handlers]);
  const publish = useCallback((state: SharedMusicState) => {
    const current = snapshotRef.current;
    if (bridge === undefined || current === null || !ownerRef.current) return;
    void bridge.publish(current.epoch, state).catch((reason: unknown) => {
      handlers.current.error(reason instanceof Error ? reason.message : "음악 재생 상태를 공유하지 못했습니다.");
    });
  }, [bridge, handlers]);
  return { snapshot, isOwner: bridge === undefined || (clientId !== null && snapshot?.ownerId === clientId), ownerRef, command, publish };
}
