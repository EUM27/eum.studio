import { ResolveAnchor } from "../../application/anchors/resolve-anchor";
import type { RevisionStore } from "../../application/revisions/revision-store";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../platform/storage/node-sqlite-ledger";
import { createLocalCanonService } from "../canon/local-canon-runtime";
import { createLocalCharacterKnowledgeService } from "../continuity/local-character-knowledge-runtime";
import { createLocalContextPlanner } from "../continuity/local-context-planner";
import { createLocalContinuityService } from "../continuity/local-continuity-runtime";
import { createLocalNarrativeDigestService } from "../continuity/local-narrative-digest-runtime";
import type { LocalWorkspaceRuntimeOptions } from "./contracts";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "./repositories/workspace";
import type { NodeSqliteDatabase } from "./storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "./storage-profiles";

import type { AssistantService } from "./services/assistant";
import type { WorkspaceRuntimeState } from "./state";

export function createWorkspaceReviewServices(input: {
 readonly database: NodeSqliteDatabase;
 readonly ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>;
 readonly revisionStore: RevisionStore;
 readonly state: WorkspaceRuntimeState;
 readonly options: Pick<LocalWorkspaceRuntimeOptions, "defaults" | "canonReview" | "continuityReview" | "narrativeDigest">;
 readonly authorizeContext: AssistantService["authorizeAssistantContextAccessSerially"];
}) {
const canonService = createLocalCanonService({
      database: input.database,
      ledger: input.ledger,
      schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
      anchorPolicy: input.options.defaults.anchorPolicy,
      describeAnchorEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        input.options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
      getDocument: (documentId) => {
        const target = input.state.documentTargets.get(documentId);
        return target === undefined
          ? undefined
          : Object.freeze({
              workId: target.workId,
              documentId: target.documentId,
              currentRevisionId: target.currentRevisionId,
              text: target.text,
            });
      },
      authorizeContext: (request) =>
        input.authorizeContext(request),
      ...(input.options.canonReview === undefined
        ? {}
        : { connector: input.options.canonReview }),
    });
const continuityService = createLocalContinuityService({
      database: input.database,
      ledger: input.ledger,
      schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
      anchorPolicy: input.options.defaults.anchorPolicy,
      describeAnchorEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        input.options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
      getDocument: (documentId) => {
        const target = input.state.documentTargets.get(documentId);
        return target === undefined
          ? undefined
          : Object.freeze({
              workId: target.workId,
              documentId: target.documentId,
              currentRevisionId: target.currentRevisionId,
              text: target.text,
            });
      },
      authorizeContext: (request) =>
        input.authorizeContext(request),
      resolveEvidenceAnchor: async (request) => {
        const target = input.state.documentTargets.get(request.documentId);
        if (target === undefined) {
          return Object.freeze({
            documentRevisionId: request.sourceDocumentRevisionId,
            integrity: "broken" as const,
            range: null,
          });
        }
        if (target.workId !== request.workId) {
          throw new Error(
            `Continuity Anchor document is outside Work: ${request.anchorId}`,
          );
        }
        const resolver = new ResolveAnchor({
          catalog: createCatalogFromStoredRows(
            readStoredDocumentRows(input.database),
          ),
          revisionStore: input.revisionStore,
          reader: input.ledger,
          describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
            input.options.defaults.anchorEvidenceChecksumAlgorithm,
          ),
        });
        const resolution = await resolver.execute({
          workId: request.workId,
          anchorId: request.anchorId,
          targetRevisionId: target.currentRevisionId,
        });
        return Object.freeze({
          documentRevisionId: target.currentRevisionId,
          integrity: resolution.status === "resolved"
            ? "resolved" as const
            : resolution.status === "needsReview"
              ? "needsReview" as const
              : "broken" as const,
          range: resolution.status === "resolved"
            ? Object.freeze({
                from: resolution.range.startOffset,
                to: resolution.range.endOffset,
              })
            : null,
        });
      },
      ...(input.options.continuityReview === undefined
        ? {}
        : { connector: input.options.continuityReview }),
    });
const characterKnowledgeService = createLocalCharacterKnowledgeService({
      database: input.database,
      ledger: input.ledger,
      schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
      anchorPolicy: input.options.defaults.anchorPolicy,
      describeAnchorEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        input.options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
      getDocument: (documentId) => {
        const target = input.state.documentTargets.get(documentId);
        return target === undefined
          ? undefined
          : Object.freeze({
              workId: target.workId,
              documentId: target.documentId,
              currentRevisionId: target.currentRevisionId,
              text: target.text,
            });
      },
      resolveEvidenceAnchor: async (request) => {
        const target = input.state.documentTargets.get(request.documentId);
        if (target === undefined) {
          return Object.freeze({
            documentRevisionId: request.sourceDocumentRevisionId,
            integrity: "broken" as const,
            range: null,
          });
        }
        if (target.workId !== request.workId) {
          throw new Error(
            `CharacterKnowledge Anchor document is outside Work: ${request.anchorId}`,
          );
        }
        const resolver = new ResolveAnchor({
          catalog: createCatalogFromStoredRows(
            readStoredDocumentRows(input.database),
          ),
          revisionStore: input.revisionStore,
          reader: input.ledger,
          describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
            input.options.defaults.anchorEvidenceChecksumAlgorithm,
          ),
        });
        const resolution = await resolver.execute({
          workId: request.workId,
          anchorId: request.anchorId,
          targetRevisionId: target.currentRevisionId,
        });
        return Object.freeze({
          documentRevisionId: target.currentRevisionId,
          integrity: resolution.status === "resolved"
            ? "resolved" as const
            : resolution.status === "needsReview"
              ? "needsReview" as const
              : "broken" as const,
          range: resolution.status === "resolved"
            ? Object.freeze({
                from: resolution.range.startOffset,
                to: resolution.range.endOffset,
              })
            : null,
        });
      },
    });
const contextPlanner = createLocalContextPlanner({
      database: input.database,
      ledger: input.ledger,
    });
const narrativeDigestService = createLocalNarrativeDigestService({
      database: input.database,
      ledger: input.ledger,
      contextPlanner: contextPlanner,
      getDocument: (documentId) => {
        const target = input.state.documentTargets.get(documentId);
        return target === undefined
          ? undefined
          : Object.freeze({
              workId: target.workId,
              documentId: target.documentId,
              currentRevisionId: target.currentRevisionId,
              text: target.text,
            });
      },
      authorizeContext: (request) =>
        input.authorizeContext(request),
      ...(input.options.narrativeDigest === undefined
        ? {}
        : { connector: input.options.narrativeDigest }),
    });
return { canonService, continuityService, characterKnowledgeService, contextPlanner, narrativeDigestService };
}

