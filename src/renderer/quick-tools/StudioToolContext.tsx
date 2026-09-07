import { createContext, useContext, useId, useLayoutEffect } from "react";

import { StudioToolRegistry, type StudioTool } from "./studio-tool-registry";

export const StudioToolContext = createContext<StudioToolRegistry | null>(null);

export function usePublishStudioTools(tools: readonly StudioTool[]): void {
  const registry = useContext(StudioToolContext);
  const owner = useId();
  useLayoutEffect(() => {
    registry?.publish(owner, tools);
  });
  useLayoutEffect(() => () => registry?.remove(owner), [owner, registry]);
}
