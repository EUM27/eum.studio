import { useSyncExternalStore } from "react";

import type { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";

export function CreateEventBlockButton(input: {
  readonly telemetryStore: ManuscriptTelemetryStore;
  readonly busy: boolean;
  readonly onClick: () => void;
}) {
  const hasSelection = useSyncExternalStore(
    input.telemetryStore.subscribeSelection,
    input.telemetryStore.getSelectionSnapshot,
  );
  return (
    <button
      className="create-event-button"
      disabled={input.busy || !hasSelection}
      onClick={input.onClick}
      type="button"
    >
      사건으로 등록
    </button>
  );
}
