import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { PublishingPartnerProjection } from "./publishing-partner-contract";
import {
  buildPublishingResearchCandidate,
  parseApprovePublishingResearchCommand,
  parsePreviewPublishingResearchCommand,
} from "./publishing-research-contract";

const partner: PublishingPartnerProjection = Object.freeze({
  schemaVersion: 1,
  partnerId: entityId<"PublishingPartner">("partner-a"),
  revision: 3,
  name: "모출판사",
  parentPartnerId: null,
  submissionMethod: "이메일",
  websiteUrl: "",
  email: "old@example.test",
  genres: ["판타지"],
  requiredLength: "",
  priority: "",
  note: "기존 메모",
  sourceIds: [],
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
});

describe("publishing research contract", () => {
  it("compares only user-entered proposal fields against the exact partner revision", () => {
    const command = parsePreviewPublishingResearchCommand({
      schemaVersion: 1,
      partnerId: partner.partnerId,
      source: {
        label: "공식 투고 안내",
        url: "https://publisher.example/submissions",
        observedOn: "2026-08-10",
        authority: "공식 홈페이지",
      },
      proposals: {
        websiteUrl: "https://publisher.example/submit",
        email: "new@example.test",
        genres: ["판타지", "로맨스"],
      },
    });

    expect(buildPublishingResearchCandidate(partner, command)).toMatchObject({
      partnerId: partner.partnerId,
      expectedRevision: 3,
      fields: [
        { field: "websiteUrl", current: "", conflict: false },
        { field: "email", current: "old@example.test", conflict: true },
        { field: "genres", current: ["판타지"], conflict: true },
      ],
    });
  });

  it("requires explicit selected proposal fields for approval", () => {
    expect(parseApprovePublishingResearchCommand({
      schemaVersion: 1,
      partnerId: partner.partnerId,
      expectedRevision: 3,
      source: {
        label: "공식 투고 안내",
        url: "https://publisher.example/submissions",
        observedOn: "2026-08-10",
        authority: "공식 홈페이지",
      },
      proposals: {
        websiteUrl: "https://publisher.example/submit",
        email: "new@example.test",
      },
      selectedFields: ["email"],
    })).toMatchObject({
      expectedRevision: 3,
      selectedFields: ["email"],
    });
  });
});
