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

export type Poc3EventBlockRecord =
  Poc3LedgerRecordMeta & {
    readonly kind: "eventBlock";
    readonly workId: string;
    readonly rangeGroupId: string;
    readonly parentEventId?: string;
    readonly title: string;
    readonly note?: string;
    readonly stageRef?: string;
    readonly orderKey: string;
    readonly collapsed: boolean;
    readonly relationIdsJson?:
      string;
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

export type Poc3LedgerRecord =
  | Poc3StudioRecord
  | Poc3WorkRecord
  | Poc3ActivityPolicyRecord
  | Poc3FocusPolicyRecord
  | Poc3WorkSettingsRecord
  | Poc3DocumentFolderRecord
  | Poc3DocumentRecord
  | Poc3BlobManifestRecord
  | Poc3DocumentRevisionRecord
  | Poc3ManuscriptRecord
  | Poc3AnchorRecord
  | Poc3RangeGroupRecord
  | Poc3EventBlockRecord
  | Poc3ResumeCheckpointRecord
  | Poc3WritingSessionRecord
  | Poc3ActivityIntervalRecord
  | Poc3FocusCycleRecord
  | Poc3WorkSnapshotRecord
  | Poc3MigrationReceiptRecord;
