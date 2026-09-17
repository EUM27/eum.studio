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
    readonly operation: "add" | "delete" | "ignore" | "merge" | "split";
    readonly anchorIds: readonly string[];
    readonly baseRuleSetRevision: number;
    readonly note?: string;
  };

export type Poc3SceneOverrideRetirementRecord = {
  readonly kind: "sceneOverrideRetirement";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly retiredAt: string;
};

export type Poc3SceneIdentityRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneIdentity";
    readonly workId: string;
  };

export type Poc3SceneEpisodeSegmentRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneEpisodeSegment";
    readonly workId: string;
    readonly sceneId: string;
    readonly documentId: string;
    readonly anchorId: string;
  };

export type Poc3SceneEpisodeSegmentRetirementRecord = {
  readonly kind: "sceneEpisodeSegmentRetirement";
  readonly id: string;
  readonly workId: string;
  readonly retiredAt: string;
};

export type Poc3SceneIdentityRetirementRecord = {
  readonly kind: "sceneIdentityRetirement";
  readonly id: string;
  readonly workId: string;
  readonly retiredAt: string;
};

export type Poc3SceneLineageOperationRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneLineageOperation";
    readonly workId: string;
    readonly operation: "split" | "merge" | "move" | "delete" | "restore";
    readonly commandRef: string;
  };

export type Poc3SceneLineageMemberRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneLineageMember";
    readonly workId: string;
    readonly lineageOperationId: string;
    readonly sceneId: string;
    readonly role: "parent" | "child";
    readonly ordinal: number;
  };

export type Poc3SceneMetadataBindingRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneMetadataBinding";
    readonly workId: string;
    readonly metadataKind: "annotation" | "event-override" | "music-queue";
    readonly metadataId: string;
    readonly sourceSceneKey: string;
    readonly sceneId?: string;
    readonly status: "current" | "needs-review" | "detached";
    readonly proposedSceneId?: string;
    readonly lineageOperationId?: string;
  };

export type Poc3SceneMetadataBindingUpdateRecord = {
  readonly kind: "sceneMetadataBindingUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly updatedAt: string;
  readonly sceneId: string | null;
  readonly status: "current" | "needs-review" | "detached";
  readonly proposedSceneId: string | null;
  readonly lineageOperationId: string | null;
};

export type Poc3SceneMetadataBindingRetirementRecord = {
  readonly kind: "sceneMetadataBindingRetirement";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly retiredAt: string;
};

export type Poc3SceneMusicQueueCandidateRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "sceneMusicQueueCandidate";
    readonly requestId: string;
    readonly workId: string;
    readonly sceneKey: string;
    readonly sceneAnnotationId: string;
    readonly sceneAnnotationRevision: number;
    readonly providerId: string;
    readonly query: string;
    readonly status: "ready" | "selected" | "superseded";
    readonly optionsJson: string;
    readonly selectedOptionId?: string;
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

export type Poc3EventBlockOutlineMoveRecord = {
  readonly kind: "eventBlockOutlineMove";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly outlineOrderKey: string;
  readonly updatedAt: string;
};

export type Poc3EventBlockOutlineRebalanceRecord = {
  readonly kind: "eventBlockOutlineRebalance";
  readonly workId: string;
  readonly updatedAt: string;
  readonly events: readonly {
    readonly id: string;
    readonly expectedRevision: number;
    readonly outlineOrderKey: string;
  }[];
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

export type Poc3ManuscriptAnnotationRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "manuscriptAnnotation";
    readonly workId: string;
    readonly sourceDocumentId: string;
    readonly sourceAnchorId: string;
    readonly body: string;
    readonly tags: readonly string[];
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
  readonly fromCharacterId?: string;
  readonly toCharacterId?: string;
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

export type Poc3LoreEntryUpdateRecord = {
  readonly kind: "loreEntryUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly schemaVersion: number;
  readonly updatedAt: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
};

export type Poc3CanonReviewFieldValue =
  | string
  | boolean
  | readonly string[];

export type Poc3CanonReviewFieldChangeData = {
  readonly field: string;
  readonly before: Poc3CanonReviewFieldValue | null;
  readonly after: Poc3CanonReviewFieldValue;
  readonly selected: boolean;
  readonly orderIndex: number;
};

export type Poc3CanonReviewEvidenceData = {
  readonly id: string;
  readonly sourceDocumentId: string;
  readonly sourceDocumentRevisionId: string;
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly exactText: string;
  readonly orderIndex: number;
};

export type Poc3CanonReviewItemData = {
  readonly id: string;
  readonly targetKind: string;
  readonly operation: string;
  readonly targetHint: string;
  readonly targetId: string | null;
  readonly matchingTargetIds: readonly string[];
  readonly expectedTargetRevision: number | null;
  readonly assertionBasis: string;
  readonly reason: string;
  readonly status: string;
  readonly appliedTargetId: string | null;
  readonly fieldChanges: readonly Poc3CanonReviewFieldChangeData[];
  readonly evidence: readonly Poc3CanonReviewEvidenceData[];
};

export type Poc3CanonReviewCandidateRecord = Poc3LedgerRecordMeta & {
  readonly kind: "canonReviewCandidate";
  readonly requestId: string;
  readonly workId: string;
  readonly sourceDocumentId: string;
  readonly sourceDocumentRevisionId: string;
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly status: string;
  readonly contextReceiptId: string;
  readonly items: readonly Poc3CanonReviewItemData[];
};

export type Poc3CanonReviewCandidateUpdateRecord = {
  readonly kind: "canonReviewCandidateUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly itemId: string;
  readonly targetKind: string;
  readonly operation: string;
  readonly targetId: string | null;
  readonly matchingTargetIds: readonly string[];
  readonly expectedTargetRevision: number | null;
  readonly fieldChanges: readonly Poc3CanonReviewFieldChangeData[];
  readonly updatedAt: string;
};

export type Poc3CanonReviewEvidenceRecord = {
  readonly kind: "canonReviewEvidence";
  readonly id: string;
  readonly workId: string;
  readonly candidateId: string;
  readonly itemId: string;
  readonly anchorId: string;
};

export type Poc3CanonReviewDecisionReceiptData = {
  readonly id: string;
  readonly schemaVersion: number;
  readonly decision: string;
  readonly outcome: string;
  readonly targetKind: string | null;
  readonly targetId: string | null;
  readonly targetRevisionBefore: number | null;
  readonly targetRevisionAfter: number | null;
  readonly selectedFields: readonly string[];
  readonly sourceDocumentRevisionId: string;
  readonly createdAt: string;
};

export type Poc3CanonReviewItemDecisionRecord = {
  readonly kind: "canonReviewItemDecision";
  readonly id: string;
  readonly workId: string;
  readonly itemId: string;
  readonly expectedRevision: number;
  readonly candidateStatus: string;
  readonly itemStatus: string;
  readonly appliedTargetId: string | null;
  readonly updatedAt: string;
  readonly receipt: Poc3CanonReviewDecisionReceiptData;
};

export type Poc3ContinuitySubjectRefData = {
  readonly entityKind: string;
  readonly entityId: string;
  readonly orderIndex: number;
};

export type Poc3ContinuityThreadRecord = Poc3LedgerRecordMeta & {
  readonly kind: "continuityThread";
  readonly workId: string;
  readonly threadKind: string;
  readonly title: string;
  readonly note: string;
  readonly status: string;
  readonly openedAt: string;
  readonly resolvedAt: string | null;
  readonly subjectRefs: readonly Poc3ContinuitySubjectRefData[];
};

export type Poc3ContinuityThreadUpdateRecord = {
  readonly kind: "continuityThreadUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly threadKind: string;
  readonly title: string;
  readonly note: string;
  readonly status: string;
  readonly resolvedAt: string | null;
  readonly subjectRefs: readonly Poc3ContinuitySubjectRefData[];
  readonly updatedAt: string;
};

export type Poc3ContinuityEvidenceRecord = {
  readonly kind: "continuityEvidence";
  readonly id: string;
  readonly schemaVersion: number;
  readonly workId: string;
  readonly threadId: string;
  readonly phase: "opened" | "resolution";
  readonly sourceDocumentId: string;
  readonly sourceDocumentRevisionId: string;
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly exactText: string;
  readonly anchorId: string;
  readonly orderIndex: number;
  readonly createdAt: string;
};

export type Poc3ContinuityTransitionRecord = {
  readonly kind: "continuityTransition";
  readonly id: string;
  readonly schemaVersion: number;
  readonly workId: string;
  readonly threadId: string;
  readonly transitionKind: string;
  readonly revisionBefore: number | null;
  readonly revisionAfter: number;
  readonly resolutionMode: string | null;
  readonly reason: string;
  readonly evidenceAnchorIds: readonly string[];
  readonly createdAt: string;
};

export type Poc3ContinuityReviewEvidenceData = {
  readonly id: string;
  readonly sourceDocumentId: string;
  readonly sourceDocumentRevisionId: string;
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly exactText: string;
  readonly orderIndex: number;
};

export type Poc3ContinuityReviewItemData = {
  readonly id: string;
  readonly assertionBasis: string;
  readonly threadKind: string;
  readonly title: string;
  readonly note: string;
  readonly subjectRefs: readonly Poc3ContinuitySubjectRefData[];
  readonly reason: string;
  readonly potentialDuplicateThreadIds: readonly string[];
  readonly status: string;
  readonly appliedThreadId: string | null;
  readonly evidence: readonly Poc3ContinuityReviewEvidenceData[];
};

export type Poc3ContinuityReviewCandidateRecord = Poc3LedgerRecordMeta & {
  readonly kind: "continuityReviewCandidate";
  readonly requestId: string;
  readonly workId: string;
  readonly sourceDocumentId: string;
  readonly sourceDocumentRevisionId: string;
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly status: string;
  readonly contextReceiptId: string;
  readonly items: readonly Poc3ContinuityReviewItemData[];
};

export type Poc3ContinuityReviewCandidateUpdateRecord = {
  readonly kind: "continuityReviewCandidateUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly itemId: string;
  readonly threadKind: string;
  readonly title: string;
  readonly note: string;
  readonly subjectRefs: readonly Poc3ContinuitySubjectRefData[];
  readonly potentialDuplicateThreadIds?: readonly string[];
  readonly updatedAt: string;
};

export type Poc3ContinuityReviewCandidateStatusRecord = {
  readonly kind: "continuityReviewCandidateStatus";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly status: string;
  readonly updatedAt: string;
};

export type Poc3ContinuityReviewEvidenceRecord = {
  readonly kind: "continuityReviewEvidence";
  readonly id: string;
  readonly workId: string;
  readonly candidateId: string;
  readonly itemId: string;
  readonly anchorId: string;
};

export type Poc3ContinuityReviewDecisionReceiptData = {
  readonly id: string;
  readonly schemaVersion: number;
  readonly decision: string;
  readonly outcome: string;
  readonly threadId: string | null;
  readonly threadRevisionAfter: number | null;
  readonly sourceDocumentRevisionId: string;
  readonly createdAt: string;
};

export type Poc3ContinuityReviewItemDecisionRecord = {
  readonly kind: "continuityReviewItemDecision";
  readonly id: string;
  readonly workId: string;
  readonly itemId: string;
  readonly expectedRevision: number;
  readonly candidateStatus: string;
  readonly itemStatus: string;
  readonly appliedThreadId: string | null;
  readonly updatedAt: string;
  readonly receipt: Poc3ContinuityReviewDecisionReceiptData;
};

export type Poc3CharacterKnowledgeRefData = {
  readonly entityKind: string;
  readonly entityId: string;
  readonly orderIndex: number;
};

export type Poc3CharacterKnowledgeRecord = Poc3LedgerRecordMeta & {
  readonly kind: "characterKnowledge";
  readonly workId: string;
  readonly characterId: string;
  readonly statement: string;
  readonly stance: string;
  readonly truthStatus: string;
  readonly status: string;
  readonly supersedesKnowledgeId: string | null;
  readonly supersededByKnowledgeId: string | null;
  readonly retiredReason: string | null;
  readonly aboutRefs: readonly Poc3CharacterKnowledgeRefData[];
};

export type Poc3CharacterKnowledgeUpdateRecord = {
  readonly kind: "characterKnowledgeUpdate";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly statement: string;
  readonly aboutRefs: readonly Poc3CharacterKnowledgeRefData[];
  readonly updatedAt: string;
};

export type Poc3CharacterKnowledgeStatusRecord = {
  readonly kind: "characterKnowledgeStatus";
  readonly id: string;
  readonly workId: string;
  readonly expectedRevision: number;
  readonly status: "superseded" | "retired";
  readonly supersededByKnowledgeId: string | null;
  readonly retiredReason: string | null;
  readonly updatedAt: string;
};

export type Poc3CharacterKnowledgeEvidenceRecord = {
  readonly kind: "characterKnowledgeEvidence";
  readonly id: string;
  readonly schemaVersion: number;
  readonly workId: string;
  readonly knowledgeId: string;
  readonly sourceDocumentId: string;
  readonly sourceDocumentRevisionId: string;
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly exactText: string;
  readonly anchorId: string;
  readonly orderIndex: number;
  readonly createdAt: string;
};

export type Poc3CharacterKnowledgeTransitionRecord = {
  readonly kind: "characterKnowledgeTransition";
  readonly id: string;
  readonly schemaVersion: number;
  readonly workId: string;
  readonly knowledgeId: string;
  readonly transitionKind: "created" | "updated" | "superseded" | "retired";
  readonly revisionBefore: number | null;
  readonly revisionAfter: number;
  readonly successorKnowledgeId: string | null;
  readonly reason: string;
  readonly evidenceAnchorIds: readonly string[];
  readonly createdAt: string;
};

export type Poc3AssistantContextPolicyRecord = Poc3LedgerRecordMeta & {
  readonly kind: "assistantContextPolicy";
  readonly workId: string;
  readonly entityKind: string;
  readonly entityId: string;
  readonly mode: string;
};

export type Poc3AssistantContextPolicyUpdateRecord = {
  readonly kind: "assistantContextPolicyUpdate";
  readonly workId: string;
  readonly entityKind: string;
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly mode: string;
  readonly updatedAt: string;
};

export type Poc3AssistantContextManifestRecord = {
  readonly kind: "assistantContextManifest";
  readonly id: string;
  readonly schemaVersion: number;
  readonly workId: string;
  readonly receiptId: string;
  readonly entries: readonly unknown[];
  readonly excluded: readonly unknown[];
  readonly estimatedTokenCount: number;
  readonly createdAt: string;
};

export type Poc3AssistantContextActivityRecord = {
  readonly kind: "assistantContextActivity";
  readonly id: string;
  readonly schemaVersion: number;
  readonly workId: string;
  readonly receiptId: string;
  readonly manifestId: string;
  readonly capability: string;
  readonly destinationId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly planDurationMs: number;
  readonly authorizeDurationMs: number;
  readonly connectorDurationMs: number;
  readonly persistDurationMs: number;
  readonly readRanges: readonly unknown[];
  readonly transmittedRanges: readonly unknown[];
  readonly readCharacterCount: number;
  readonly transmittedCharacterCount: number;
  readonly candidateCount: number;
};

export type Poc3NarrativeDigestRecord = {
  readonly kind: "narrativeDigest";
  readonly id: string;
  readonly schemaVersion: number;
  readonly workId: string;
  readonly scopeKind: "work" | "document" | "scene" | "character" | "relationship";
  readonly scopeDocumentId: string | null;
  readonly scopeSceneId?: string | null;
  readonly scopeFirstCharacterId: string | null;
  readonly scopeSecondCharacterId: string | null;
  readonly sourceManifest: unknown;
  readonly sourceManifestHash: string;
  readonly text: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly contextReceiptId: string;
  readonly createdAt: string;
  readonly documents: readonly Readonly<{
    documentId: string;
    documentRevisionId: string;
    orderIndex: number;
  }>[];
  readonly sceneSource?: Readonly<{
    sceneId: string;
    documentId: string;
    documentRevisionId: string;
    from: number;
    to: number;
    textHash: string;
    sourceFingerprint: string;
    trigger: "scene-transition" | "scene-split" | "episode-transition" | "manual";
  }> | null;
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
  | Poc3SceneOverrideRetirementRecord
  | Poc3SceneIdentityRecord
  | Poc3SceneEpisodeSegmentRecord
  | Poc3SceneEpisodeSegmentRetirementRecord
  | Poc3SceneIdentityRetirementRecord
  | Poc3SceneLineageOperationRecord
  | Poc3SceneLineageMemberRecord
  | Poc3SceneMetadataBindingRecord
  | Poc3SceneMetadataBindingUpdateRecord
  | Poc3SceneMetadataBindingRetirementRecord
  | Poc3SceneMusicQueueCandidateRecord
  | Poc3SceneEventOverrideRecord
  | Poc3SceneEventOverrideRetirementRecord
  | Poc3EventBlockRecord
  | Poc3EventBlockOutlineMoveRecord
  | Poc3EventBlockOutlineRebalanceRecord
  | Poc3EventSourceRecord
  | Poc3EventSourceRetirementRecord
  | Poc3FragmentRecord
  | Poc3ManuscriptAnnotationRecord
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
  | Poc3LoreEntryUpdateRecord
  | Poc3LoreEntryEvidenceRecord
  | Poc3LoreEntryHistoryRecord
  | Poc3CanonReviewCandidateRecord
  | Poc3CanonReviewCandidateUpdateRecord
  | Poc3CanonReviewEvidenceRecord
  | Poc3CanonReviewItemDecisionRecord
  | Poc3ContinuityThreadRecord
  | Poc3ContinuityThreadUpdateRecord
  | Poc3ContinuityEvidenceRecord
  | Poc3ContinuityTransitionRecord
  | Poc3ContinuityReviewCandidateRecord
  | Poc3ContinuityReviewCandidateUpdateRecord
  | Poc3ContinuityReviewCandidateStatusRecord
  | Poc3ContinuityReviewEvidenceRecord
  | Poc3ContinuityReviewItemDecisionRecord
  | Poc3CharacterKnowledgeRecord
  | Poc3CharacterKnowledgeUpdateRecord
  | Poc3CharacterKnowledgeStatusRecord
  | Poc3CharacterKnowledgeEvidenceRecord
  | Poc3CharacterKnowledgeTransitionRecord
  | Poc3AssistantContextPolicyRecord
  | Poc3AssistantContextPolicyUpdateRecord
  | Poc3AssistantContextManifestRecord
  | Poc3AssistantContextActivityRecord
  | Poc3NarrativeDigestRecord
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
