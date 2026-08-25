import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";
import { CreateEventBlockButton } from "./CreateEventBlockButton";

const { useSyncExternalStoreMock } = vi.hoisted(() => ({
  useSyncExternalStoreMock: vi.fn(
    (
      _subscribe: (onStoreChange: () => void) => () => void,
      getSnapshot: () => boolean,
    ) => getSnapshot(),
  ),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useSyncExternalStore: useSyncExternalStoreMock,
  };
});

function createTelemetryStore(hasSelection: boolean): ManuscriptTelemetryStore {
  const telemetryStore = new ManuscriptTelemetryStore();
  telemetryStore.publish(
    {
      characterCount: 0,
      characterCountWithoutWhitespace: 0,
    },
    hasSelection,
  );
  return telemetryStore;
}

describe("CreateEventBlockButton", () => {
  beforeEach(() => {
    useSyncExternalStoreMock.mockClear();
  });

  it("keeps the unselected button disabled and subscribed to selection telemetry", () => {
    const telemetryStore = createTelemetryStore(false);
    const markup = renderToStaticMarkup(createElement(
      CreateEventBlockButton,
      {
        busy: false,
        onClick: vi.fn(),
        telemetryStore,
      },
    ));

    expect(useSyncExternalStoreMock).toHaveBeenCalledWith(
      telemetryStore.subscribeSelection,
      telemetryStore.getSelectionSnapshot,
    );
    expect(markup).toBe(
      '<button class="create-event-button" disabled="" type="button">사건으로 등록</button>',
    );
  });

  it("keeps the selected button enabled and forwards its click callback", () => {
    const onClick = vi.fn();
    const button = CreateEventBlockButton({
      busy: false,
      onClick,
      telemetryStore: createTelemetryStore(true),
    });

    expect(renderToStaticMarkup(button)).toBe(
      '<button class="create-event-button" type="button">사건으로 등록</button>',
    );
    expect(button.props.onClick).toBe(onClick);
    button.props.onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps the selected button disabled while busy", () => {
    const markup = renderToStaticMarkup(createElement(
      CreateEventBlockButton,
      {
        busy: true,
        onClick: vi.fn(),
        telemetryStore: createTelemetryStore(true),
      },
    ));

    expect(markup).toContain(
      'class="create-event-button" disabled="" type="button"',
    );
    expect(markup).toContain("사건으로 등록");
  });
});
