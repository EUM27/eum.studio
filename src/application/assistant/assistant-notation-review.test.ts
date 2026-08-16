import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  createManuscriptPreflightBoundaryContext,
  diagnoseManuscriptPreflight,
  type ManuscriptPreflightSettings,
} from "../editor/manuscript-preflight";
import {
  createAssistantNotationFindings,
  parseAssistantNotationCandidate,
  parseRunAssistantNotationReviewCommand,
} from "./assistant-notation-review";

const settings: ManuscriptPreflightSettings = Object.freeze({
  trimTrailingWhitespace: true,
  tabReplacement: "spaces",
  tabWidth: 2,
  nonBreakingSpaceReplacement: "space",
  lineEnding: "preserve",
  limitBlankLines: true,
  maxConsecutiveBlankLines: 1,
  forbiddenTerms: Object.freeze(["금칙어"]),
  forbiddenCaseSensitive: true,
  regexPattern: "",
  regexCaseSensitive: true,
  regexMultiline: false,
});

describe("assistant notation review", () => {
  it("maps only the selected preflight matches back to exact document offsets", () => {
    const manuscript = "앞 문장\n\t금칙어 \n뒤 문장";
    const from = manuscript.indexOf("\t");
    const to = manuscript.indexOf("\n뒤");
    const sourceRange = {
      documentId: entityId<"Document">("document-a"),
      documentRevisionId: entityId<"DocumentRevision">("revision-a"),
      from,
      to,
    };
    const report = diagnoseManuscriptPreflight(
      manuscript.slice(from, to),
      settings,
      createManuscriptPreflightBoundaryContext(manuscript, sourceRange),
    );

    expect(createAssistantNotationFindings({ sourceRange, report })).toEqual([
      {
        kind: "trailing-whitespace",
        range: {
          documentId: "document-a",
          documentRevisionId: "revision-a",
          from: to - 1,
          to,
        },
        label: null,
      },
      {
        kind: "tab",
        range: {
          documentId: "document-a",
          documentRevisionId: "revision-a",
          from,
          to: from + 1,
        },
        label: null,
      },
      {
        kind: "forbidden-term",
        range: {
          documentId: "document-a",
          documentRevisionId: "revision-a",
          from: from + 1,
          to: from + 4,
        },
        label: "금칙어",
      },
    ]);
  });

  it("parses an exact-selection command and a persisted Candidate without manuscript text", () => {
    const command = parseRunAssistantNotationReviewCommand({
      schemaVersion: 1,
      requestId: "request-a",
      workId: "work-a",
      conversationId: "conversation-a",
      destinationId: "local-notation",
      sourceRange: {
        documentId: "document-a",
        documentRevisionId: "revision-a",
        from: 4,
        to: 8,
      },
    });
    const candidate = parseAssistantNotationCandidate({
      schemaVersion: 1,
      candidateId: "candidate-a",
      workId: command.workId,
      conversationId: command.conversationId,
      destinationId: command.destinationId,
      sourceRange: command.sourceRange,
      findings: [
        {
          kind: "forbidden-term",
          range: command.sourceRange,
          label: "표기",
        },
      ],
      regexError: null,
      receiptId: "receipt-a",
      createdAt: "2026-08-10T02:00:00.000Z",
    });

    expect(candidate.findings[0]?.range).toEqual(command.sourceRange);
    expect(candidate).not.toHaveProperty("sourceText");
  });
});
