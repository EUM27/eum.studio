export type Poc3LedgerRecordMeta = {
  readonly id: string;
  readonly schemaVersion: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt?: string;
};

export type Poc3StudioRecord = {
  readonly kind: "studio";
  readonly id: string;
  readonly displayName?: string;
  readonly locale: string;
  readonly timezone: string;
  readonly settingsRevision: number;
  readonly createdAt: string;
};

export type Poc3WorkRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "work";
    readonly studioId: string;
    readonly title: string;
    readonly subtitle?: string;
    readonly kindRef?: string;
    readonly statusRef?: string;
    readonly orderKey: string;
    readonly resumeCheckpointId?:
      string;
    readonly settingsId: string;
    readonly customFieldsJson?:
      string;
  };

export type Poc3ActivityPolicyRecord =
  Poc3LedgerRecordMeta & {
    readonly kind:
      "activityPolicy";
    readonly workId: string;
    readonly idleTimeout: number;
    readonly navigationGrace:
      number;
    readonly hiddenWindowPolicy:
      string;
    readonly activityClassRulesJson:
      string;
    readonly autoStartEnabled:
      boolean;
    readonly autoResumeFromIdle:
      boolean;
    readonly recoveryPolicy:
      string;
  };

export type Poc3FocusPolicyRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "focusPolicy";
    readonly workId: string;
    readonly phaseDefinitionsJson:
      string;
    readonly backgroundPolicy:
      string;
    readonly musicStartPolicy:
      string;
    readonly completionPolicy:
      string;
    readonly visibility: string;
  };

export type Poc3WorkSettingsRecord = {
  readonly kind: "workSettings";
  readonly id: string;
  readonly workId: string;
  readonly sceneRuleSetId: string;
  readonly activityPolicyId:
    string;
  readonly focusPolicyId: string;
  readonly railPreferencesJson:
    string;
  readonly revision: number;
};

export type Poc3SceneRuleSetRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneRuleSet";
    readonly workId: string;
    readonly displayName: string;
    readonly boundaryRulesJson: string;
    readonly normalizationPolicy: string;
    readonly enabled: boolean;
  };

export type Poc3SceneRuleSetUpdateRecord = {
  readonly kind: "sceneRuleSetUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly displayName: string;
  readonly boundaryRulesJson: string;
  readonly normalizationPolicy: string;
  readonly enabled: boolean;
  readonly updatedAt: string;
};

export type Poc3DocumentFolderRecord =
  Poc3LedgerRecordMeta & {
    readonly kind:
      "documentFolder";
    readonly workId: string;
    readonly parentFolderId?:
      string;
    readonly title: string;
    readonly orderKey: string;
  };

export type Poc3DocumentRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "document";
    readonly workId: string;
    readonly folderId?: string;
    readonly documentKindRef?:
      string;
    readonly title: string;
    readonly orderKey: string;
    readonly manuscriptId: string;
    readonly sceneRuleSetId?:
      string;
    readonly archivedAt?: string;
  };

export type Poc3BlobManifestRecord = {
  readonly kind: "blobManifest";
  readonly blobRef: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly createdAt: string;
  readonly mediaType?: string;
  readonly originalName?: string;
};

export type Poc3DocumentRevisionRecord = {
  readonly kind:
    "documentRevision";
  readonly id: string;
  readonly workId: string;
  readonly documentId: string;
  readonly parentRevisionId?:
    string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly length: number;
  readonly changeSetRef?: string;
  readonly cause: string;
  readonly createdAt: string;
  readonly durableAt: string;
};

export type Poc3ManuscriptRecord = {
  readonly kind: "manuscript";
  readonly id: string;
  readonly workId: string;
  readonly documentId: string;
  readonly currentRevisionId:
    string;
  readonly durableRevisionId:
    string;
  readonly updatedAt: string;
};

export type Poc3AnchorRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "anchor";
    readonly workId: string;
    readonly documentId: string;
    readonly originRevisionId:
      string;
    readonly resolvedRevisionId:
      string;
    readonly startOffset: number;
    readonly endOffset: number;
    readonly exactQuote: string;
    readonly prefixContext:
      string;
    readonly suffixContext:
      string;
    readonly quoteHash: string;
    readonly contextHash: string;
    readonly lineageRef?: string;
    readonly status: string;
    readonly resolutionEvidenceJson:
      string;
  };

export type Poc3RangeGroupRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "rangeGroup";
    readonly workId: string;
    readonly orderedAnchorIds:
      readonly string[];
  };

export type Poc3SceneOverrideRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneOverride";
    readonly workId: string;
    readonly documentId: string;
    readonly operation: "add" | "ignore" | "merge" | "split";
    readonly anchorIds: readonly string[];
    readonly baseRuleSetRevision: number;
    readonly note?: string;
  };

export type Poc3SceneEventOverrideRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneEventOverride";
    readonly workId: string;
    readonly sceneKey: string;
    readonly eventBlockId: string;
    readonly operation: "include" | "exclude";
  };

export type Poc3SceneEventOverrideRetirementRecord = {
  readonly kind: "sceneEventOverrideRetirement";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly retiredAt: string;
};

export type Poc3EventBlockRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "eventBlock";
    readonly workId: string;
    readonly parentEventId?: string;
    readonly title: string;
    readonly note?: string;
    readonly stageRef?: string;
    readonly outlineOrderKey: string;
    readonly collapsed: boolean;
    readonly relationIdsJson?:
      string;
  };

export type Poc3EventSourceRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "eventSource";
    readonly workId: string;
    readonly eventBlockId: string;
    readonly rangeGroupId: string;
    readonly role: "primary" | "supporting";
    readonly replacesEventSourceId?: string;
    readonly expectedReplacedRevision?: number;
  };

export type Poc3EventSourceRetirementRecord = {
  readonly kind: "eventSourceRetirement";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly retiredAt: string;
};

export type Poc3FragmentRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "fragment";
    readonly workId: string;
    readonly sourceDocumentId: string;
    readonly sourceAnchorId: string;
    readonly kindId: string;
    readonly title: string;
    readonly pinned: boolean;
    readonly useCount: number;
  };

export type Poc3CharacterRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "character";
    readonly workId: string;
    readonly name: string;
    readonly aliases: readonly string[];
    readonly role: string;
    readonly summary: string;
    readonly appearance: string;
    readonly personality: string;
    readonly speech: string;
    readonly goal: string;
    readonly conflict: string;
    readonly note: string;
  };

export type Poc3CharacterUpdateRecord = {
  readonly kind: "characterUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly schemaVersion: number;
  readonly updatedAt: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly role: string;
  readonly summary: string;
  readonly appearance: string;
  readonly personality: string;
  readonly speech: string;
  readonly goal: string;
  readonly conflict: string;
  readonly note: string;
};

export type Poc3CharacterRetirementRecord = {
  readonly kind: "characterRetirement";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly retiredAt: string;
};

export type Poc3CharacterRelationRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "characterRelation";
    readonly workId: string;
    readonly fromCharacterId: string;
    readonly toCharacterId: string;
    readonly relationKind: string;
    readonly description: string;
    readonly retirementReason?: "user" | "character-retired";
  };

export type Poc3CharacterRelationUpdateRecord = {
  readonly kind: "characterRelationUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly updatedAt: string;
  readonly relationKind: string;
  readonly description: string;
};

export type Poc3CharacterRelationRetirementRecord = {
  readonly kind: "characterRelationRetirement";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly retiredAt: string;
  readonly retirementReason: "user" | "character-retired";
};

export type Poc3CharacterEvidenceRecord = {
  readonly kind: "characterEvidence";
  readonly id: string;
  readonly workId: string;
  readonly characterId: string;
  readonly sourceDocumentId: string;
  readonly sourceAnchorId: string;
  readonly createdAt: string;
};

export type Poc3CharacterExtractionCandidateDecisionRecord = {
  readonly kind: "characterExtractionCandidateDecision";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly status: "ready" | "completed";
  readonly items: readonly unknown[];
  readonly updatedAt: string;
};

export type Poc3CharacterGenerationCandidateDecisionRecord = {
  readonly kind: "characterGenerationCandidateDecision";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly status: "ready" | "completed";
  readonly items: readonly unknown[];
  readonly updatedAt: string;
};

export type Poc3SceneExtractionCandidateDecisionRecord = {
  readonly kind: "sceneExtractionCandidateDecision";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly status: "ready" | "completed";
  readonly boundaries: readonly unknown[];
  readonly updatedAt: string;
};

export type Poc3SceneAnnotationRecord = Poc3LedgerRecordMeta & {
  readonly kind: "sceneAnnotation";
  readonly workId: string;
  readonly sceneKey: string;
  readonly documentId: string;
  readonly documentRevisionId: string;
  readonly sourceCandidateId: string;
  readonly sourceSceneItemId: string;
  readonly title: string;
  readonly summary: string;
  readonly povCharacterId?: string;
  readonly location: string;
  readonly time: string;
  readonly characterIds: readonly string[];
  readonly goal: string;
  readonly conflict: string;
  readonly outcome: string;
};

export type Poc3SceneAnnotationUpdateRecord = {
  readonly kind: "sceneAnnotationUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly updatedAt: string;
  readonly documentId: string;
  readonly documentRevisionId: string;
  readonly sourceCandidateId: string;
  readonly sourceSceneItemId: string;
  readonly title: string;
  readonly summary: string;
  readonly povCharacterId?: string;
  readonly location: string;
  readonly time: string;
  readonly characterIds: readonly string[];
  readonly goal: string;
  readonly conflict: string;
  readonly outcome: string;
};

export type Poc3SceneExtractionAnnotationCandidateDecisionRecord = {
  readonly kind: "sceneExtractionAnnotationCandidateDecision";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly status: "ready" | "completed";
  readonly scenes: readonly unknown[];
  readonly updatedAt: string;
};

export type Poc3LoreEntryRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "loreEntry";
    readonly workId: string;
    readonly title: string;
    readonly content: string;
    readonly category: string;
    readonly aliases: readonly string[];
    readonly enabled: boolean;
  };

export type Poc3LoreEntryEvidenceRecord = {
  readonly kind: "loreEntryEvidence";
  readonly id: string;
  readonly workId: string;
  readonly loreEntryId: string;
  readonly sourceDocumentId: string;
  readonly sourceAnchorId: string;
  readonly createdAt: string;
};

export type Poc3LoreEntryHistoryRecord = {
  readonly kind: "loreEntryHistory";
  readonly id: string;
  readonly schemaVersion: number;
  readonly workId: string;
  readonly loreEntryId: string;
  readonly entryRevision: number;
  readonly changeKind: "created" | "updated" | "evidence-added" | "retired";
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly evidenceAnchorIds: readonly string[];
  readonly changedAt: string;
};

export type Poc3LoreForeshadowLinkRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "loreForeshadowLink";
    readonly workId: string;
    readonly loreEntryId: string;
    readonly lineId: string;
    readonly linkedAt: string;
    readonly unlinkedAt: string | null;
    readonly unlinkReason:
      | "user"
      | "lore-retired"
      | "foreshadow-retired"
      | null;
  };

export type Poc3LoreCandidateRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "loreCandidate";
    readonly workId: string;
    readonly sourceDocumentId: string;
    readonly sourceDocumentRevisionId: string;
    readonly sourceAnchorId: string;
    readonly exactText: string;
    readonly source: "user" | "assistant";
    readonly certainty: "explicit" | "inferred";
    readonly proposalJson: string;
    readonly reason: string;
    readonly status: "pending" | "approved" | "rejected";
    readonly approvedLoreEntryId: string | null;
    readonly reviewedAt: string | null;
  };

export type Poc3PublishingPartnerRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "publishingPartner";
    readonly name: string;
    readonly parentPartnerId: string | null;
    readonly submissionMethod: string;
    readonly websiteUrl: string;
    readonly email: string;
    readonly genres: readonly string[];
    readonly requiredLength: string;
    readonly priority: string;
    readonly note: string;
    readonly sourceIds: readonly string[];
  };

export type Poc3PlotThreadRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "plotThread";
    readonly workId: string;
    readonly title: string;
    readonly stage: string;
    readonly summary: string;
    readonly note: string;
  };

export type Poc3PlotBoardRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "plotBoard";
    readonly workId: string;
    readonly title: string;
    readonly mode: "sequence" | "time-map";
  };

export type Poc3PlotLaneRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "plotLane";
    readonly workId: string;
    readonly plotBoardId: string;
    readonly title: string;
    readonly laneKind:
      | "default"
      | "main"
      | "subplot"
      | "stage"
      | "custom";
    readonly orderKey: string;
  };

export type Poc3PlotPlacementRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "plotPlacement";
    readonly workId: string;
    readonly plotBoardId: string;
    readonly plotLaneId: string;
    readonly plotThreadId: string;
    readonly orderKey: string;
    readonly storyTime?: number;
    readonly storyTimeEnd?: number;
  };

export type Poc3PlotBoardTouchRecord = {
  readonly kind: "plotBoardTouch";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly updatedAt: string;
};

export type Poc3PlotPlacementMoveRecord = {
  readonly kind: "plotPlacementMove";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly plotBoardId: string;
  readonly plotLaneId: string;
  readonly orderKey: string;
  readonly expectedBoardRevision: number;
  readonly updatedAt: string;
};

export type Poc3PlotPlacementStoryTimeRecord = {
  readonly kind: "plotPlacementStoryTime";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly plotBoardId: string;
  readonly storyTime: number;
  readonly storyTimeEnd: number | null;
  readonly expectedBoardRevision: number;
  readonly updatedAt: string;
};

export type Poc3PlotPlacementRebalanceRecord = {
  readonly kind: "plotPlacementRebalance";
  readonly workId: string;
  readonly plotBoardId: string;
  readonly expectedBoardRevision: number;
  readonly updatedAt: string;
  readonly placements: readonly {
    readonly id: string;
    readonly expectedRevision: number;
    readonly plotLaneId: string;
    readonly orderKey: string;
  }[];
};

export type Poc3PlotEventLinkRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "plotEventLink";
    readonly workId: string;
    readonly plotThreadId: string;
    readonly eventBlockId: string;
    readonly role: "primary" | "supporting";
    readonly createdFrom:
      | "event-to-plot"
      | "plot-to-event"
      | "manual-link";
  };

export type Poc3PlotEventLinkRetirementRecord = {
  readonly kind: "plotEventLinkRetirement";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly retiredAt: string;
};

export type Poc3PlotThreadSourceRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "plotThreadSource";
    readonly workId: string;
    readonly plotThreadId: string;
    readonly expectedSourceId: string | null;
    readonly sourceDocumentId: string;
    readonly sourceAnchorId: string;
  };

export type Poc3ForeshadowLineRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "foreshadowLine";
    readonly workId: string;
    readonly title: string;
    readonly note: string;
  };

export type Poc3ForeshadowPointRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "foreshadowPoint";
    readonly workId: string;
    readonly lineId: string;
    readonly sourceDocumentId: string;
    readonly sourceAnchorId: string;
    readonly roleId: string;
    readonly note: string;
  };

export type Poc3ResumeCheckpointRecord =
  Poc3LedgerRecordMeta & {
    readonly kind:
      "resumeCheckpoint";
    readonly workId: string;
    readonly documentId: string;
    readonly documentRevisionId:
      string;
    readonly cursorAnchorId:
      string;
    readonly selectionAnchorId?:
      string;
    readonly workspaceMode: string;
    readonly contextRefsJson?:
      string;
    readonly focusCheckpointId?:
      string;
    readonly musicCheckpointId?:
      string;
    readonly capturedAt: string;
  };

export type Poc3WritingSessionRecord =
  Poc3LedgerRecordMeta & {
    readonly kind:
      "writingSession";
    readonly workId: string;
    readonly documentId?: string;
    readonly policyId: string;
    readonly state: string;
    readonly modeRef?: string;
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly lastDurableHeartbeatAt:
      string;
    readonly startRevisionId?:
      string;
    readonly endRevisionId?:
      string;
    readonly note?: string;
    readonly recoveryEvidenceJson?:
      string;
  };

export type Poc3ActivityIntervalRecord = {
  readonly kind:
    "activityInterval";
  readonly id: string;
  readonly workId: string;
  readonly sessionId: string;
  readonly activityClass: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly documentId?: string;
  readonly eventBlockIds:
    readonly string[];
  readonly evidenceCount: number;
  readonly source: string;
};

export type Poc3FocusCycleRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "focusCycle";
    readonly workId: string;
    readonly sessionId?: string;
    readonly policyId: string;
    readonly phaseRef: string;
    readonly state: string;
    readonly pauseReason?: string;
    readonly targetDuration:
      number;
    readonly startedAt?: string;
    readonly deadlineAt?: string;
    readonly remainingAtPause?:
      number;
    readonly completedAt?: string;
    readonly note?: string;
    readonly musicQueueId?: string;
  };

export type Poc3WorkSnapshotRecord = {
  readonly kind: "workSnapshot";
  readonly id: string;
  readonly workId: string;
  readonly documentRevisions:
    readonly {
      readonly documentId: string;
      readonly documentRevisionId:
        string;
    }[];
  readonly structureRevisionRefsJson:
    string;
  readonly dictionaryRevisionRefsJson?:
    string;
  readonly manifestHash: string;
  readonly label?: string;
  readonly cause: string;
  readonly createdAt: string;
};

export type Poc3MigrationReceiptRecord = {
  readonly kind:
    "migrationReceipt";
  readonly id: string;
  readonly migrationId: string;
  readonly fromSchemaVersion:
    number;
  readonly toSchemaVersion: number;
  readonly migrationChecksumIdentity:
    string;
  readonly migrationChecksumValue:
    string;
  readonly beforeChecksumValue:
    string;
  readonly afterChecksumValue:
    string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly progressReceiptJson?:
    string;
};

export type Poc3RawPreservedItemRecord = {
  readonly kind: "rawPreservedItem";
  readonly id: string;
  readonly batchId: string;
  readonly sourceSnapshotId: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly sourceOccurrence: number;
  readonly serializationIdentity: string;
  readonly rawBytes: Uint8Array;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly mapperVersion: string;
  readonly createdAt: string;
};

export type Poc3SubmissionPackageRecord = {
  readonly kind: "submissionPackage";
  readonly id: string;
  readonly workId: string;
  readonly partnerId: string;
  readonly workSnapshotId: string;
  readonly workTitleSnapshot: string;
  readonly partnerNameSnapshot: string;
  readonly manifestHash: string;
  readonly sealedAt: string;
};

export type Poc3PublishingSubmissionRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "publishingSubmission";
    readonly workId: string;
    readonly partnerId: string;
    readonly submissionPackageId: string;
    readonly title: string;
    readonly status: string;
    readonly submittedOn: string | null;
    readonly respondedOn: string | null;
    readonly result: string;
    readonly note: string;
    readonly cardNote: string;
    readonly sourceIds: readonly string[];
  };

export type Poc3PublishingContractRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "publishingContract";
    readonly workId: string;
    readonly partnerId: string;
    readonly submissionId: string | null;
    readonly title: string;
    readonly workTitleSnapshot: string;
    readonly partnerNameSnapshot: string;
    readonly status: string;
    readonly signedOn: string | null;
    readonly startsOn: string | null;
    readonly endsOn: string | null;
    readonly rightsScope: string;
    readonly advanceAmount: number | null;
    readonly currencyCode: string;
    readonly revenueShareNote: string;
    readonly note: string;
    readonly sourceIds: readonly string[];
  };

export type Poc3PublishingPublicationRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "publishingPublication";
    readonly workId: string;
    readonly contractId: string | null;
    readonly channelPartnerId: string | null;
    readonly title: string;
    readonly workTitleSnapshot: string;
    readonly channelNameSnapshot: string;
    readonly status: string;
    readonly format: string;
    readonly scheduledOn: string | null;
    readonly startsOn: string | null;
    readonly endsOn: string | null;
    readonly publishedUnitCount: number | null;
    readonly plannedUnitCount: number | null;
    readonly scheduleNote: string;
    readonly note: string;
    readonly sourceIds: readonly string[];
  };

export type Poc3PublishingSettlementLineItem = {
  readonly settlementLineItemId: string;
  readonly label: string;
  readonly amount: number;
  readonly note: string;
};

export type Poc3PublishingSettlementRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "publishingSettlement";
    readonly workId: string;
    readonly publicationId: string;
    readonly title: string;
    readonly workTitleSnapshot: string;
    readonly publicationTitleSnapshot: string;
    readonly periodStartsOn: string | null;
    readonly periodEndsOn: string | null;
    readonly issuedOn: string | null;
    readonly reviewStatus: string;
    readonly currencyCode: string;
    readonly reportedAmount: number | null;
    readonly items: readonly Poc3PublishingSettlementLineItem[];
    readonly note: string;
    readonly sourceIds: readonly string[];
  };

export type Poc3PublishingPaymentRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "publishingPayment";
    readonly workId: string;
    readonly settlementId: string | null;
    readonly workTitleSnapshot: string;
    readonly settlementTitleSnapshot: string;
    readonly receivedOn: string | null;
    readonly confirmedOn: string | null;
    readonly amount: number;
    readonly currencyCode: string;
    readonly matchStatus: string;
    readonly payerLabel: string;
    readonly reference: string;
    readonly note: string;
    readonly sourceIds: readonly string[];
  };

export type Poc3PublishingSourceRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "publishingSource";
    readonly sourceKind: string;
    readonly label: string;
    readonly url: string | null;
    readonly observedAt: string | null;
    readonly authority: string;
    readonly importedFields: Readonly<Record<string, string>>;
  };

export type Poc3PublishingMailCandidateRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "publishingMailCandidate";
    readonly sourceId: string;
    readonly sourceAccountId: string;
    readonly messageId: string;
    readonly threadId: string;
    readonly from: string;
    readonly subject: string;
    readonly receivedAt: string;
    readonly snippet: string;
    readonly bodyFingerprint: string;
    readonly submissionId: string | null;
    readonly matchReason: string;
    readonly proposedStatus: string;
    readonly proposedResult: string;
    readonly proposedRespondedOn: string | null;
    readonly proposedNote: string;
    readonly classificationConnectionId: string | null;
    readonly classificationModel: string;
    readonly reviewStatus: string;
  };

export type Poc3MigrationDecisionRecord = {
  readonly kind: "migrationDecision";
  readonly id: string;
  readonly batchId: string;
  readonly sourceSnapshotId: string;
  readonly sourceCollection: string;
  readonly sourceIdentity: string;
  readonly commandKind: string;
  readonly decisionPayloadJson: string;
  readonly decidedAt: string;
  readonly actorRef: string;
};

export type Poc3LedgerRecord =
  | Poc3StudioRecord
  | Poc3WorkRecord
  | Poc3ActivityPolicyRecord
  | Poc3FocusPolicyRecord
  | Poc3WorkSettingsRecord
  | Poc3SceneRuleSetRecord
  | Poc3SceneRuleSetUpdateRecord
  | Poc3DocumentFolderRecord
  | Poc3DocumentRecord
  | Poc3BlobManifestRecord
  | Poc3DocumentRevisionRecord
  | Poc3ManuscriptRecord
  | Poc3AnchorRecord
  | Poc3RangeGroupRecord
  | Poc3SceneOverrideRecord
  | Poc3SceneEventOverrideRecord
  | Poc3SceneEventOverrideRetirementRecord
  | Poc3EventBlockRecord
  | Poc3EventSourceRecord
  | Poc3EventSourceRetirementRecord
  | Poc3FragmentRecord
  | Poc3CharacterRecord
  | Poc3CharacterUpdateRecord
  | Poc3CharacterRetirementRecord
  | Poc3CharacterRelationRecord
  | Poc3CharacterRelationUpdateRecord
  | Poc3CharacterRelationRetirementRecord
  | Poc3CharacterEvidenceRecord
  | Poc3CharacterExtractionCandidateDecisionRecord
  | Poc3CharacterGenerationCandidateDecisionRecord
  | Poc3SceneExtractionCandidateDecisionRecord
  | Poc3SceneAnnotationRecord
  | Poc3SceneAnnotationUpdateRecord
  | Poc3SceneExtractionAnnotationCandidateDecisionRecord
  | Poc3LoreEntryRecord
  | Poc3LoreEntryEvidenceRecord
  | Poc3LoreEntryHistoryRecord
  | Poc3LoreForeshadowLinkRecord
  | Poc3LoreCandidateRecord
  | Poc3PublishingPartnerRecord
  | Poc3PlotThreadRecord
  | Poc3PlotBoardRecord
  | Poc3PlotLaneRecord
  | Poc3PlotPlacementRecord
  | Poc3PlotBoardTouchRecord
  | Poc3PlotPlacementMoveRecord
  | Poc3PlotPlacementStoryTimeRecord
  | Poc3PlotPlacementRebalanceRecord
  | Poc3PlotEventLinkRecord
  | Poc3PlotEventLinkRetirementRecord
  | Poc3PlotThreadSourceRecord
  | Poc3ForeshadowLineRecord
  | Poc3ForeshadowPointRecord
  | Poc3ResumeCheckpointRecord
  | Poc3WritingSessionRecord
  | Poc3ActivityIntervalRecord
  | Poc3FocusCycleRecord
  | Poc3WorkSnapshotRecord
  | Poc3SubmissionPackageRecord
  | Poc3PublishingSubmissionRecord
  | Poc3PublishingContractRecord
  | Poc3PublishingPublicationRecord
  | Poc3PublishingSettlementRecord
  | Poc3PublishingPaymentRecord
  | Poc3PublishingSourceRecord
  | Poc3PublishingMailCandidateRecord
  | Poc3RawPreservedItemRecord
  | Poc3MigrationDecisionRecord
  | Poc3MigrationReceiptRecord;
