import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { loadApplicationProfiles } from "./load-application-profiles";
import { createConfiguredApplicationRuntime } from "./create-configured-application-runtime";

it("keeps implicit local mode distinct from explicitly configured profiles", () => {
  const onYouTubePlayerReferer = vi.fn();
  const profiles = loadApplicationProfiles({ environment: {}, getAppPath: () => process.cwd(), onYouTubePlayerReferer });
  expect(profiles.hasConfiguredManuscriptRuntime).toBe(false);
  expect(profiles.documentProfile).toEqual(profiles.ephemeralDocumentProfile);
  expect(onYouTubePlayerReferer).toHaveBeenCalledExactlyOnceWith(profiles.youtubeMusicProfile.playerReferer);
  expect(() => loadApplicationProfiles({ environment: {
    EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: "{}",
    EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE_PATH: randomUUID(),
  }, getAppPath: () => process.cwd(), onYouTubePlayerReferer })).toThrow();
});

it("constructs and navigates the actual configured runtime using the exact supplied document identities", async () => {
  const workId = randomUUID();
  const documents = Array.from({ length: 2 }, () => ({
    workId, documentId: randomUUID(), documentRevisionId: randomUUID(), label: randomUUID(), initialText: randomUUID(),
  }));
  const profile = { schemaVersion: 1, initialDocumentId: documents[0]!.documentId, documents };
  const profiles = loadApplicationProfiles({
    environment: { EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(profile) },
    getAppPath: () => process.cwd(), onYouTubePlayerReferer: vi.fn(),
  });
  expect(profiles.hasConfiguredManuscriptRuntime).toBe(true);
  const runtime = await createConfiguredApplicationRuntime({
    ...profiles, youtubeMusicConnectionStore: { getStatus: vi.fn(), save: vi.fn() },
  });
  expect(runtime.manuscript.getManuscriptDocumentProfile()).toEqual(profile);
  expect(runtime.getWorkspaceCatalog()).toMatchObject({ activeWorkId: workId, activeDocumentId: documents[0]!.documentId });
  await runtime.activateWorkspaceLocation({ schemaVersion: 1, workId, documentId: documents[1]!.documentId });
  expect(runtime.getWorkspaceCatalog()).toMatchObject({ activeWorkId: workId, activeDocumentId: documents[1]!.documentId });
  expect(runtime.manuscript.getManuscriptDocumentProfile().documents).toEqual(documents);
  await runtime.close();
});
