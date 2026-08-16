import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  closeDocumentTab,
  createDocumentTabSession,
  openDocumentTab,
  projectDocumentTabs,
  type DocumentTabSession,
} from "./document-tab-state";

function id(): string {
  return randomUUID();
}

describe("document tab state", () => {
  it("projects only current-Work tabs in canonical order and always includes the active Document", () => {
    const workId = id();
    const firstDocumentId = id();
    const activeDocumentId = id();
    const thirdDocumentId = id();
    const staleDocumentId = id();
    const session: DocumentTabSession = Object.freeze({
      [workId]: Object.freeze([
        staleDocumentId,
        thirdDocumentId,
        thirdDocumentId,
      ]),
    });

    expect(
      projectDocumentTabs({
        session,
        workId,
        orderedDocumentIds: [
          firstDocumentId,
          activeDocumentId,
          thirdDocumentId,
        ],
        activeDocumentId,
      }),
    ).toEqual([activeDocumentId, thirdDocumentId]);
  });

  it("keeps open tabs isolated per Work", () => {
    const firstWorkId = id();
    const secondWorkId = id();
    const firstDocumentId = id();
    const secondDocumentId = id();
    let session = createDocumentTabSession();

    session = openDocumentTab({
      session,
      workId: firstWorkId,
      orderedDocumentIds: [firstDocumentId],
      activeDocumentId: firstDocumentId,
      documentId: firstDocumentId,
    });
    session = openDocumentTab({
      session,
      workId: secondWorkId,
      orderedDocumentIds: [secondDocumentId],
      activeDocumentId: secondDocumentId,
      documentId: secondDocumentId,
    });

    expect(
      projectDocumentTabs({
        session,
        workId: firstWorkId,
        orderedDocumentIds: [firstDocumentId],
        activeDocumentId: firstDocumentId,
      }),
    ).toEqual([firstDocumentId]);
    expect(
      projectDocumentTabs({
        session,
        workId: secondWorkId,
        orderedDocumentIds: [secondDocumentId],
        activeDocumentId: secondDocumentId,
      }),
    ).toEqual([secondDocumentId]);
  });

  it("opens an owned Document in canonical order and rejects another Work's Document", () => {
    const workId = id();
    const firstDocumentId = id();
    const secondDocumentId = id();
    const thirdDocumentId = id();
    const foreignDocumentId = id();
    let session = createDocumentTabSession();

    session = openDocumentTab({
      session,
      workId,
      orderedDocumentIds: [
        firstDocumentId,
        secondDocumentId,
        thirdDocumentId,
      ],
      activeDocumentId: secondDocumentId,
      documentId: thirdDocumentId,
    });
    session = openDocumentTab({
      session,
      workId,
      orderedDocumentIds: [
        firstDocumentId,
        secondDocumentId,
        thirdDocumentId,
      ],
      activeDocumentId: secondDocumentId,
      documentId: firstDocumentId,
    });

    expect(
      projectDocumentTabs({
        session,
        workId,
        orderedDocumentIds: [
          firstDocumentId,
          secondDocumentId,
          thirdDocumentId,
        ],
        activeDocumentId: secondDocumentId,
      }),
    ).toEqual([
      firstDocumentId,
      secondDocumentId,
      thirdDocumentId,
    ]);
    expect(() =>
      openDocumentTab({
        session,
        workId,
        orderedDocumentIds: [
          firstDocumentId,
          secondDocumentId,
          thirdDocumentId,
        ],
        activeDocumentId: secondDocumentId,
        documentId: foreignDocumentId,
      }),
    ).toThrow("does not own Document");
  });

  it("closes inactive tabs and chooses the right then left neighbor for an active tab", () => {
    const workId = id();
    const firstDocumentId = id();
    const secondDocumentId = id();
    const thirdDocumentId = id();
    const orderedDocumentIds = [
      firstDocumentId,
      secondDocumentId,
      thirdDocumentId,
    ];
    let session = createDocumentTabSession();
    for (const documentId of orderedDocumentIds) {
      session = openDocumentTab({
        session,
        workId,
        orderedDocumentIds,
        activeDocumentId: secondDocumentId,
        documentId,
      });
    }

    const inactiveClose = closeDocumentTab({
      session,
      workId,
      orderedDocumentIds,
      activeDocumentId: secondDocumentId,
      documentId: firstDocumentId,
    });
    expect(inactiveClose).toMatchObject({
      closed: true,
      nextActiveDocumentId: secondDocumentId,
    });
    expect(
      projectDocumentTabs({
        session: inactiveClose.session,
        workId,
        orderedDocumentIds,
        activeDocumentId: secondDocumentId,
      }),
    ).toEqual([secondDocumentId, thirdDocumentId]);

    const rightNeighborClose = closeDocumentTab({
      session,
      workId,
      orderedDocumentIds,
      activeDocumentId: secondDocumentId,
      documentId: secondDocumentId,
    });
    expect(rightNeighborClose.nextActiveDocumentId).toBe(
      thirdDocumentId,
    );

    const leftNeighborClose = closeDocumentTab({
      session: rightNeighborClose.session,
      workId,
      orderedDocumentIds,
      activeDocumentId: thirdDocumentId,
      documentId: thirdDocumentId,
    });
    expect(leftNeighborClose.nextActiveDocumentId).toBe(
      firstDocumentId,
    );

    const lastTabClose = closeDocumentTab({
      session: leftNeighborClose.session,
      workId,
      orderedDocumentIds,
      activeDocumentId: firstDocumentId,
      documentId: firstDocumentId,
    });
    expect(lastTabClose).toEqual({
      session: leftNeighborClose.session,
      nextActiveDocumentId: firstDocumentId,
      closed: false,
    });
  });
});
