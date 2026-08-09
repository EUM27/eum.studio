import {
  randomUUID,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentCommand,
  parseCreateDocumentResult,
  parseCreateFirstWorkCommand,
  parseCreateFirstWorkResult,
  parseCreateWorkCommand,
  parseWorkspaceCatalogProjection,
} from "./workspace-contract";

describe("workspace contract", () => {
  it("projects one exact Work and its first Document across the typed boundary", () => {
    const workId = randomUUID();
    const documentId = randomUUID();
    const revisionId = randomUUID();
    const title = randomUUID();
    const firstDocumentTitle = randomUUID();
    const updatedAt = new Date().toISOString();

    expect(
      parseCreateFirstWorkCommand({
        schemaVersion: 1,
        title,
        firstDocumentTitle,
      }),
    ).toEqual({
      schemaVersion: 1,
      title,
      firstDocumentTitle,
    });
    expect(
      parseCreateFirstWorkResult({
        schemaVersion: 1,
        workId,
        documentId,
        revisionId,
      }),
    ).toEqual({
      schemaVersion: 1,
      workId,
      documentId,
      revisionId,
    });
    expect(
      parseWorkspaceCatalogProjection({
        schemaVersion: 1,
        works: [
          {
            workId,
            title,
            updatedAt,
            documents: [
              {
                documentId,
                title: firstDocumentTitle,
                currentRevisionId: revisionId,
              },
            ],
          },
        ],
        activeWorkId: workId,
        activeDocumentId: documentId,
        canCreateFirstWork: false,
      }),
    ).toEqual({
      schemaVersion: 1,
      works: [
        {
          workId,
          title,
          updatedAt,
          documents: [
            {
              documentId,
              title: firstDocumentTitle,
              currentRevisionId: revisionId,
            },
          ],
        },
      ],
      activeWorkId: workId,
      activeDocumentId: documentId,
      canCreateFirstWork: false,
    });
  });

  it("preserves exact ownership for additional Works, Documents, activation, and resume capture", () => {
    const workId = randomUUID();
    const documentId = randomUUID();
    const revisionId = randomUUID();
    const title = randomUUID();
    const firstDocumentTitle = randomUUID();
    const documentTitle = randomUUID();
    const selection = {
      anchor: title.length,
      head: 0,
    } as const;

    expect(
      parseCreateWorkCommand({
        schemaVersion: 1,
        title,
        firstDocumentTitle,
      }),
    ).toEqual({ schemaVersion: 1, title, firstDocumentTitle });
    expect(
      parseCreateDocumentCommand({
        schemaVersion: 1,
        workId,
        title: documentTitle,
      }),
    ).toEqual({ schemaVersion: 1, workId, title: documentTitle });
    expect(
      parseCreateDocumentResult({
        schemaVersion: 1,
        workId,
        documentId,
        revisionId,
      }),
    ).toEqual({ schemaVersion: 1, workId, documentId, revisionId });
    expect(
      parseActivateWorkspaceLocationCommand({
        schemaVersion: 1,
        workId,
        documentId,
      }),
    ).toEqual({ schemaVersion: 1, workId, documentId });
    expect(
      parseCaptureWorkspaceResumeCommand({
        schemaVersion: 1,
        workId,
        documentId,
        selection,
        workspaceMode: "writing",
      }),
    ).toEqual({
      schemaVersion: 1,
      workId,
      documentId,
      selection,
      workspaceMode: "writing",
    });
  });
});
