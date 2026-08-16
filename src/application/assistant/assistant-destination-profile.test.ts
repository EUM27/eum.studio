import { describe, expect, it } from "vitest";

import { parseAssistantDestinationProfile } from "./assistant-destination-profile";

describe("assistant destination profile", () => {
  it("loads a runtime-owned provider-neutral local vocabulary destination", () => {
    expect(parseAssistantDestinationProfile({
      schemaVersion: 1,
      destinations: [
        {
          destinationId: "runtime-local-search",
          label: "작품 어휘 검색",
          kind: "local-exact-vocabulary-search",
          capabilities: ["vocabulary-lookup"],
          requiredLocalScope: "work",
          requiredExternalScope: "none",
        },
      ],
    })).toEqual({
      schemaVersion: 1,
      destinations: [
        {
          destinationId: "runtime-local-search",
          label: "작품 어휘 검색",
          kind: "local-exact-vocabulary-search",
          capabilities: ["vocabulary-lookup"],
          requiredLocalScope: "work",
          requiredExternalScope: "none",
        },
      ],
    });
  });

  it("loads a Work-local exact setting review destination without external transmission", () => {
    expect(parseAssistantDestinationProfile({
      schemaVersion: 1,
      destinations: [{
        destinationId: "runtime-setting-review",
        label: "설정 중복 검토",
        kind: "local-exact-setting-review",
        capabilities: ["lore-review"],
        requiredLocalScope: "work",
        requiredExternalScope: "none",
      }],
    })).toEqual({
      schemaVersion: 1,
      destinations: [{
        destinationId: "runtime-setting-review",
        label: "설정 중복 검토",
        kind: "local-exact-setting-review",
        capabilities: ["lore-review"],
        requiredLocalScope: "work",
        requiredExternalScope: "none",
      }],
    });
  });

  it("loads an exact-selection notation destination without external transmission", () => {
    expect(parseAssistantDestinationProfile({
      schemaVersion: 1,
      destinations: [{
        destinationId: "runtime-notation-review",
        label: "선택 범위 표기 점검",
        kind: "local-selected-notation-review",
        capabilities: ["vocabulary-lookup"],
        requiredLocalScope: "selection",
        requiredExternalScope: "none",
      }],
    })).toEqual({
      schemaVersion: 1,
      destinations: [{
        destinationId: "runtime-notation-review",
        label: "선택 범위 표기 점검",
        kind: "local-selected-notation-review",
        capabilities: ["vocabulary-lookup"],
        requiredLocalScope: "selection",
        requiredExternalScope: "none",
      }],
    });
  });
});
