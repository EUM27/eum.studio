import { useCallback, useMemo, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ForeshadowLineProjection } from "../../../application/foreshadowing/foreshadow-line-contract";
import type { LoreEntryProjection } from "../../../application/lore/lore-entry-contract";
import type { LoreForeshadowLinkProjection } from "../../../application/lore/lore-foreshadow-link-contract";
import type { EntityId } from "../../../domain/writing";
import type { ForeshadowLoreLinkCompatibilityPort } from "../foreshadow/foreshadow-client";
import { canRunLoreForeshadowLink } from "../foreshadow/foreshadow-state";
import type { LoreLinksCompatibilityPort } from "./lore-client";

type LoreSharedLinkActionPort = Readonly<{
  started: (
    actionState: "linking-foreshadow" | "unlinking-foreshadow",
  ) => void;
  failed: (error: string) => void;
  finished: () => void;
}>;

type ForeshadowSharedLinkActionPort = Readonly<{
  started: (actionState: "linking-lore" | "unlinking-lore") => void;
  failed: (error: string) => void;
  finished: () => void;
}>;

export type LoreForeshadowLinkState = ReturnType<
  typeof useLoreForeshadowLinkState
>;

export function useLoreForeshadowLinkState(
  client: StudioBridge["loreForeshadowLinks"],
) {
  const [links, setLinks] = useState<
    readonly LoreForeshadowLinkProjection[]
  >([]);

  const list = useCallback(async (workId: EntityId<"Work">) => {
    const projection = await client.list({ schemaVersion: 1, workId });
    return projection.links;
  }, [client]);
  const replace = useCallback((
    nextLinks: readonly LoreForeshadowLinkProjection[],
  ) => {
    setLinks(nextLinks);
  }, []);
  const clear = useCallback(() => {
    setLinks([]);
  }, []);
  const pruneRetiredLoreEntry = useCallback((
    loreEntryId: EntityId<"LoreEntry">,
  ) => {
    setLinks((current) => Object.freeze(
      current.filter((link) => link.loreEntryId !== loreEntryId),
    ));
  }, []);
  const refresh = useCallback(async (workId: EntityId<"Work">) => {
    const projection = await client.list({ schemaVersion: 1, workId });
    setLinks(projection.links);
  }, [client]);
  const pruneRetiredLine = useCallback((
    lineId: EntityId<"ForeshadowLine">,
  ) => {
    setLinks((current) => Object.freeze(
      current.filter((link) => link.lineId !== lineId),
    ));
  }, []);
  const upsertLinked = useCallback((linked: LoreForeshadowLinkProjection) => {
    setLinks((current) => Object.freeze([
      linked,
      ...current.filter((link) => link.linkId !== linked.linkId),
    ]));
  }, []);
  const replaceUnlinked = useCallback((
    unlinked: LoreForeshadowLinkProjection,
  ) => {
    setLinks((current) => Object.freeze(
      current.map((candidate) =>
        candidate.linkId === unlinked.linkId ? unlinked : candidate
      ),
    ));
  }, []);

  const loreCompatibility = useMemo<LoreLinksCompatibilityPort>(() =>
    Object.freeze({ list, replace, clear, pruneRetiredLoreEntry }), [
    clear,
    list,
    pruneRetiredLoreEntry,
    replace,
  ]);
  const foreshadowCompatibility =
    useMemo<ForeshadowLoreLinkCompatibilityPort>(() => Object.freeze({
      refresh,
      pruneRetiredLine,
    }), [pruneRetiredLine, refresh]);

  return useMemo(() => ({
    links,
    loreCompatibility,
    foreshadowCompatibility,
    upsertLinked,
    replaceUnlinked,
  }), [
    foreshadowCompatibility,
    links,
    loreCompatibility,
    replaceUnlinked,
    upsertLinked,
  ]);
}

export function useLoreForeshadowLinkController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: StudioBridge["loreForeshadowLinks"];
  foreshadowActionState: Parameters<typeof canRunLoreForeshadowLink>[1];
  foreshadowSharedLinkAction: ForeshadowSharedLinkActionPort;
  loreActionState: Parameters<typeof canRunLoreForeshadowLink>[0];
  loreSharedLinkAction: LoreSharedLinkActionPort;
  state: LoreForeshadowLinkState;
}>) {
  const activeLinks = useMemo(() =>
    input.activeWorkId === null
      ? []
      : input.state.links.filter(
          (link) => link.workId === input.activeWorkId,
        ), [input.activeWorkId, input.state.links]);

  const linkLoreForeshadow = useCallback(async (
    entry: LoreEntryProjection,
    line: ForeshadowLineProjection,
    surface: "lore" | "foreshadow",
  ) => {
    if (
      input.activeWorkId === null ||
      entry.workId !== input.activeWorkId ||
      line.workId !== input.activeWorkId ||
      !canRunLoreForeshadowLink(
        input.loreActionState,
        input.foreshadowActionState,
      )
    ) return;
    if (surface === "lore") {
      input.loreSharedLinkAction.started("linking-foreshadow");
    } else {
      input.foreshadowSharedLinkAction.started("linking-lore");
    }
    try {
      const linked = await input.client.link({
        schemaVersion: 1,
        workId: input.activeWorkId,
        loreEntryId: entry.loreEntryId,
        lineId: line.lineId,
      });
      input.state.upsertLinked(linked);
    } catch {
      if (surface === "lore") {
        input.loreSharedLinkAction.failed(
          "이 별빛과 복선을 연결하지 못했습니다.",
        );
      } else {
        input.foreshadowSharedLinkAction.failed(
          "이 복선과 별빛을 연결하지 못했습니다.",
        );
      }
    } finally {
      if (surface === "lore") {
        input.loreSharedLinkAction.finished();
      } else {
        input.foreshadowSharedLinkAction.finished();
      }
    }
  }, [input]);

  const unlinkLoreForeshadow = useCallback(async (
    link: LoreForeshadowLinkProjection,
    surface: "lore" | "foreshadow",
  ) => {
    if (
      input.activeWorkId === null ||
      link.workId !== input.activeWorkId ||
      link.unlinkedAt !== null ||
      !canRunLoreForeshadowLink(
        input.loreActionState,
        input.foreshadowActionState,
      )
    ) return;
    if (surface === "lore") {
      input.loreSharedLinkAction.started("unlinking-foreshadow");
    } else {
      input.foreshadowSharedLinkAction.started("unlinking-lore");
    }
    try {
      const unlinked = await input.client.unlink({
        schemaVersion: 1,
        workId: input.activeWorkId,
        linkId: link.linkId,
        expectedRevision: link.revision,
      });
      input.state.replaceUnlinked(unlinked);
    } catch {
      if (surface === "lore") {
        input.loreSharedLinkAction.failed(
          "이 별빛과 복선의 연결을 해제하지 못했습니다.",
        );
      } else {
        input.foreshadowSharedLinkAction.failed(
          "이 복선과 별빛의 연결을 해제하지 못했습니다.",
        );
      }
    } finally {
      if (surface === "lore") {
        input.loreSharedLinkAction.finished();
      } else {
        input.foreshadowSharedLinkAction.finished();
      }
    }
  }, [input]);

  return {
    activeLinks,
    linkLoreForeshadow,
    unlinkLoreForeshadow,
  };
}
