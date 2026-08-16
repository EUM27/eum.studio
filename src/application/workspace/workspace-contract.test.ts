import {
  randomUUID,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentFolderCommand,
  parseCreateDocumentCommand,
  parseCreateDocumentResult,
  parseCreateFirstWorkCommand,
  parseCreateFirstWorkResult,
  parseCreateWorkCommand,
  parseMoveDocumentCommand,
  parsePlaceDocumentInFolderCommand,
  parseRenameDocumentFolderCommand,
  parseRenameDocumentCommand,
  parseRenameWorkCommand,
  parseRetireDocumentCommand,
  parseRetireDocumentFolderCommand,
  parseRetireWorkCommand,
  parseWorkspaceCatalogProjection,
} from "./workspace-contract";

describe("workspace contract", () => {
  it("uses the exact untitled label for blank first and additional Document titles", () => {
    const workId = randomUUID();
    const workTitle = randomUUID();

    expect(
      parseCreateWorkCommand({
        schemaVersion: 1,
        title: workTitle,
        firstDocumentTitle: "  ",
      }),
    ).toEqual({
      schemaVersion: 1,
      title: workTitle,
      firstDocumentTitle: "제목없음",
    });
    expect(
      parseCreateDocumentCommand({
        schemaVersion: 1,
        workId,
        title: "",
      }),
    ).toEqual({
      schemaVersion: 1,
      workId,
      title: "제목없음",
    });
  });

  it("normalizes exact Work and Document rename ownership", () => {
    const workId = randomUUID();
    const documentId = randomUUID();
    const workTitle = randomUUID();
    const documentTitle = randomUUID();

    expect(
      parseRenameWorkCommand({
        schemaVersion: 1,
        workId,
        title: `  ${workTitle}  `,
      }),
    ).toEqual({ schemaVersion: 1, workId, title: workTitle });
    expect(
      parseRenameDocumentCommand({
        schemaVersion: 1,
        workId,
        documentId,
        title: `  ${documentTitle}  `,
      }),
    ).toEqual({
      schemaVersion: 1,
      workId,
      documentId,
      title: documentTitle,
    });
  });

  it("preserves the exact Work identity for soft retirement", () => {
    const workId = randomUUID();

    expect(
      parseRetireWorkCommand({
        schemaVersion: 1,
        workId,
      }),
    ).toEqual({ schemaVersion: 1, workId });
    expect(() =>
      parseRetireWorkCommand({
        schemaVersion: 1,
        workId,
        deleteChildren: true,
      }),
    ).toThrow("Unsupported RetireWorkCommand field: deleteChildren");
  });

  it("preserves exact ownership for Document retirement", () => {
    const workId = randomUUID();
    const documentId = randomUUID();

    expect(
      parseRetireDocumentCommand({
        schemaVersion: 1,
        workId,
        documentId,
      }),
    ).toEqual({ schemaVersion: 1, workId, documentId });
  });

  it("accepts only an exact owned adjacent Document move", () => {
    const workId = randomUUID();
    const documentId = randomUUID();

    expect(
      parseMoveDocumentCommand({
        schemaVersion: 1,
        workId,
        documentId,
        direction: "earlier",
      }),
    ).toEqual({
      schemaVersion: 1,
      workId,
      documentId,
      direction: "earlier",
    });
    expect(() =>
      parseMoveDocumentCommand({
        schemaVersion: 1,
        workId,
        documentId,
        direction: "first",
      }),
    ).toThrow("direction must be earlier or later");
  });

  it("preserves exact Work ownership for folder commands", () => {
    const workId = randomUUID();
    const folderId = randomUUID();
    const documentId = randomUUID();
    const title = randomUUID();

    expect(
      parseCreateDocumentFolderCommand({
        schemaVersion: 1,
        workId,
        title: ` ${title} `,
        parentFolderId: null,
      }),
    ).toEqual({ schemaVersion: 1, workId, title, parentFolderId: null });
    expect(
      parseRenameDocumentFolderCommand({
        schemaVersion: 1,
        workId,
        folderId,
        title,
      }),
    ).toEqual({ schemaVersion: 1, workId, folderId, title });
    expect(
      parsePlaceDocumentInFolderCommand({
        schemaVersion: 1,
        workId,
        documentId,
        folderId,
      }),
    ).toEqual({ schemaVersion: 1, workId, documentId, folderId });
    expect(
      parseRetireDocumentFolderCommand({
        schemaVersion: 1,
        workId,
        folderId,
      }),
    ).toEqual({ schemaVersion: 1, workId, folderId });
  });

  it("projects a registered Work with no active Documents", () => {
    const workId = randomUUID();
    const title = randomUUID();
    const updatedAt = new Date().toISOString();

    expect(
      parseWorkspaceCatalogProjection({
        schemaVersion: 1,
        works: [{ workId, title, updatedAt, folders: [], documents: [] }],
        activeWorkId: workId,
        activeDocumentId: null,
        canCreateFirstWork: false,
      }),
    ).toEqual({
      schemaVersion: 1,
      works: [{ workId, title, updatedAt, folders: [], documents: [] }],
      activeWorkId: workId,
      activeDocumentId: null,
      canCreateFirstWork: false,
    });
  });

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
            folders: [],
            documents: [
              {
                documentId,
                title: firstDocumentTitle,
                currentRevisionId: revisionId,
                folderId: null,
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
          folders: [],
          documents: [
            {
              documentId,
              title: firstDocumentTitle,
              currentRevisionId: revisionId,
              folderId: null,
            },
          ],
        },
      ],
      activeWorkId: workId,
      activeDocumentId: documentId,
      canCreateFirstWork: false,
    });
  });

  it("projects one owned acyclic folder tree and exact Document placements", () => {
    const workId = randomUUID();
    const rootFolderId = randomUUID();
    const childFolderId = randomUUID();
    const documentId = randomUUID();
    const revisionId = randomUUID();
    const updatedAt = new Date().toISOString();
    const projection = {
      schemaVersion: 1,
      works: [{
        workId,
        title: randomUUID(),
        updatedAt,
        folders: [
          { folderId: rootFolderId, title: "1부", parentFolderId: null },
          { folderId: childFolderId, title: "초반", parentFolderId: rootFolderId },
        ],
        documents: [{
          documentId,
          title: "1화",
          currentRevisionId: revisionId,
          folderId: childFolderId,
        }],
      }],
      activeWorkId: workId,
      activeDocumentId: documentId,
      canCreateFirstWork: false,
    } as const;

    expect(parseWorkspaceCatalogProjection(projection)).toEqual(projection);
    expect(() =>
      parseWorkspaceCatalogProjection({
        ...projection,
        works: [{
          ...projection.works[0],
          folders: [
            { folderId: rootFolderId, title: "1부", parentFolderId: childFolderId },
            { folderId: childFolderId, title: "초반", parentFolderId: rootFolderId },
          ],
        }],
      }),
    ).toThrow("Workspace folder cycle");
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
