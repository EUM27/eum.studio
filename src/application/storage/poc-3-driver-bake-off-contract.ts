type SqlValue =
  | string
  | number
  | boolean
  | null;

export type Poc3SqlRow = Readonly<
  Record<string, SqlValue>
>;

export type Poc3SqlStatement = {
  readonly sql: string;
  readonly parameters:
    readonly SqlValue[];
};

export type Poc3QueryExpectation =
  Poc3SqlStatement & {
    readonly expectedRows:
      readonly Poc3SqlRow[];
  };

export type Poc3DriverCandidate = {
  readonly id: string;
  readonly moduleSpecifier: string;
  readonly versionSource: string;
  readonly expectedPackageVersion?:
    string;
  readonly officialEvidenceRefs:
    readonly string[];
};

export type Poc3OfficialEvidence = {
  readonly id: string;
  readonly url: string;
  readonly claim: string;
};

export type Poc3DriverBakeOffManifest = {
  readonly schemaVersion: number;
  readonly checksumAlgorithm: string;
  readonly candidates:
    readonly Poc3DriverCandidate[];
  readonly officialEvidence:
    readonly Poc3OfficialEvidence[];
  readonly databaseFiles: {
    readonly primaryFileName: string;
    readonly backupFileName: string;
  };
  readonly artifactFiles: {
    readonly packageLoadFileName:
      string;
    readonly measurementFileName:
      string;
  };
  readonly provenanceFiles: {
    readonly packageManifestPath:
      string;
    readonly packageLockPath: string;
  };
  readonly fixtureGeneration: {
    readonly workCount: number;
    readonly documentsPerWork:
      number;
    readonly revisionsPerDocument:
      number;
    readonly revisionSequenceStart:
      number;
    readonly displayNameMaterials:
      readonly string[];
  };
  readonly pragmaSteps:
    readonly {
      readonly id: string;
      readonly applySql: string;
      readonly verifySql: string;
      readonly expectedRows:
        readonly Poc3SqlRow[];
    }[];
  readonly schemaStatements:
    readonly string[];
  readonly writeTransaction: {
    readonly beginSql: string;
    readonly insertWorkSql: string;
    readonly insertDocumentSql:
      string;
    readonly insertRevisionSql:
      string;
    readonly commitSql: string;
  };
  readonly rollbackTransaction: {
    readonly beginSql: string;
    readonly insertWorkSql: string;
    readonly rollbackSql: string;
    readonly verificationSql:
      string;
  };
  readonly foreignKeyRejection: {
    readonly beginSql: string;
    readonly insertDocumentSql:
      string;
    readonly rollbackSql: string;
    readonly verificationSql:
      string;
  };
  readonly ledgerVerificationSql:
    string;
  readonly sqliteVersionQuery: {
    readonly sql: string;
    readonly column: string;
  };
  readonly integrityVerification:
    Poc3QueryExpectation;
  readonly measurement: {
    readonly independentRunCount:
      number;
    readonly repetitionsPerRun:
      number;
    readonly summaryPercentile:
      number;
    readonly timeoutMs: number;
  };
  readonly packageProbe: {
    readonly electronRuntimeDirectoryPath:
      string;
    readonly applicationResourcesRelativePath:
      string;
    readonly electronExecutableRelativePath:
      string;
    readonly applicationManifestRelativePath:
      string;
    readonly applicationMainRelativePath:
      string;
    readonly compiledApplicationRelativePath:
      string;
    readonly compiledPlatformRelativePath:
      string;
    readonly compiledApplicationTargetRelativePath:
      string;
    readonly compiledPlatformTargetRelativePath:
      string;
    readonly compiledContractEntryFileName:
      string;
    readonly compiledPlatformEntryFileName:
      string;
    readonly betterSqlitePackagePath:
      string;
    readonly betterSqlitePackageTargetRelativePath:
      string;
  };
};

export type Poc3GeneratedDriverFixture = {
  readonly works:
    readonly {
      readonly workId: string;
      readonly displayName: string;
    }[];
  readonly documents:
    readonly {
      readonly workId: string;
      readonly documentId: string;
      readonly displayName: string;
    }[];
  readonly revisions:
    readonly {
      readonly workId: string;
      readonly documentId: string;
      readonly revisionId: string;
      readonly sequence: number;
      readonly contentChecksum:
        string;
    }[];
  readonly rollbackWork: {
    readonly workId: string;
    readonly displayName: string;
  };
  readonly foreignKeyDocument: {
    readonly missingWorkId: string;
    readonly documentId: string;
    readonly displayName: string;
  };
  readonly ledgerExpectedRows:
    readonly Poc3SqlRow[];
};

function readRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} must be an object`,
    );
  }
  return value as Record<
    string,
    unknown
  >;
}

function assertFields(
  input: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  label: string,
): void {
  const allowedFields = new Set(allowed);
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      throw new Error(
        `Unsupported ${label} field: ${field}`,
      );
    }
  }
  for (const field of required) {
    if (!(field in input)) {
      throw new Error(
        `${label} is missing ${field}`,
      );
    }
  }
}

function readString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${label}.${field} must be a non-empty string`,
    );
  }
  return value;
}

function readPositiveInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${label}.${field} must be a positive safe integer`,
    );
  }
  return value;
}

function readStringArray(
  value: unknown,
  label: string,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new Error(
      `${label} must be a non-empty array`,
    );
  }
  return value.map(
    (entry, index) => {
      if (
        typeof entry !== "string" ||
        entry.length === 0
      ) {
        throw new Error(
          `${label}[${index}] must be a non-empty string`,
        );
      }
      return entry;
    },
  );
}

function readRows(
  value: unknown,
  label: string,
): readonly Poc3SqlRow[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${label} must be an array`,
    );
  }
  return value.map(
    (entry, index) => {
      const row = readRecord(
        entry,
        `${label}[${index}]`,
      );
      for (
        const [column, cell]
        of Object.entries(row)
      ) {
        if (
          column.length === 0 ||
          !(
            cell === null ||
            typeof cell === "string" ||
            typeof cell ===
              "boolean" ||
            (
              typeof cell === "number" &&
              Number.isSafeInteger(cell)
            )
          )
        ) {
          throw new Error(
            `${label}[${index}] has an invalid SQL cell`,
          );
        }
      }
      return row as Poc3SqlRow;
    },
  );
}

function readSqlGroup<
  TFields extends readonly string[],
>(
  value: unknown,
  fields: TFields,
  label: string,
): Readonly<
  Record<TFields[number], string>
> {
  const input = readRecord(value, label);
  assertFields(
    input,
    fields,
    fields,
    label,
  );
  return Object.fromEntries(
    fields.map((field) => [
      field,
      readString(
        input,
        field,
        label,
      ),
    ]),
  ) as Readonly<
    Record<TFields[number], string>
  >;
}

function deepFreeze<T>(value: T): T {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.isFrozen(value)
  ) {
    return value;
  }
  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function parseCandidates(
  value: unknown,
  label: string,
): readonly Poc3DriverCandidate[] {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new Error(
      `${label} must be a non-empty array`,
    );
  }
  const parsed = value.map(
    (entry, index) => {
      const itemLabel =
        `${label}[${index}]`;
      const input = readRecord(
        entry,
        itemLabel,
      );
      assertFields(
        input,
        [
          "id",
          "moduleSpecifier",
          "versionSource",
          "expectedPackageVersion",
          "officialEvidenceRefs",
        ],
        [
          "id",
          "moduleSpecifier",
          "versionSource",
          "officialEvidenceRefs",
        ],
        itemLabel,
      );
      const expected =
        input.expectedPackageVersion;
      if (
        expected !== undefined &&
        (
          typeof expected !==
            "string" ||
          expected.length === 0
        )
      ) {
        throw new Error(
          `${itemLabel}.expectedPackageVersion must be a non-empty string`,
        );
      }
      return {
        id: readString(
          input,
          "id",
          itemLabel,
        ),
        moduleSpecifier: readString(
          input,
          "moduleSpecifier",
          itemLabel,
        ),
        versionSource: readString(
          input,
          "versionSource",
          itemLabel,
        ),
        ...(expected === undefined
          ? {}
          : {
              expectedPackageVersion:
                expected,
            }),
        officialEvidenceRefs:
          readStringArray(
            input.officialEvidenceRefs,
            `${itemLabel}.officialEvidenceRefs`,
          ),
      };
    },
  );
  if (
    new Set(
      parsed.map(
        (candidate) => candidate.id,
      ),
    ).size !== parsed.length
  ) {
    throw new Error(
      `${label} has duplicate IDs`,
    );
  }
  return parsed;
}

function parseEvidence(
  value: unknown,
  label: string,
): readonly Poc3OfficialEvidence[] {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new Error(
      `${label} must be a non-empty array`,
    );
  }
  const parsed = value.map(
    (entry, index) => {
      const itemLabel =
        `${label}[${index}]`;
      const input = readRecord(
        entry,
        itemLabel,
      );
      assertFields(
        input,
        ["id", "url", "claim"],
        ["id", "url", "claim"],
        itemLabel,
      );
      return {
        id: readString(
          input,
          "id",
          itemLabel,
        ),
        url: readString(
          input,
          "url",
          itemLabel,
        ),
        claim: readString(
          input,
          "claim",
          itemLabel,
        ),
      };
    },
  );
  if (
    new Set(
      parsed.map(
        (evidence) => evidence.id,
      ),
    ).size !== parsed.length
  ) {
    throw new Error(
      `${label} has duplicate IDs`,
    );
  }
  return parsed;
}

export function parsePoc3DriverBakeOffManifest(
  value: unknown,
): Poc3DriverBakeOffManifest {
  const label =
    "POC-3 driver bake-off manifest";
  const input = readRecord(
    value,
    label,
  );
  const rootFields = [
    "schemaVersion",
    "checksumAlgorithm",
    "candidates",
    "officialEvidence",
    "databaseFiles",
    "artifactFiles",
    "provenanceFiles",
    "fixtureGeneration",
    "pragmaSteps",
    "schemaStatements",
    "writeTransaction",
    "rollbackTransaction",
    "foreignKeyRejection",
    "ledgerVerificationSql",
    "sqliteVersionQuery",
    "integrityVerification",
    "measurement",
    "packageProbe",
  ] as const;
  assertFields(
    input,
    rootFields,
    rootFields,
    label,
  );

  const candidates = parseCandidates(
    input.candidates,
    `${label}.candidates`,
  );
  const officialEvidence =
    parseEvidence(
      input.officialEvidence,
      `${label}.officialEvidence`,
    );
  const evidenceIds = new Set(
    officialEvidence.map(
      (evidence) => evidence.id,
    ),
  );
  if (
    candidates.some(
      (candidate) =>
        candidate.officialEvidenceRefs
          .some(
            (reference) =>
              !evidenceIds.has(
                reference,
              ),
          ),
    )
  ) {
    throw new Error(
      `${label} has invalid official evidence references`,
    );
  }

  const databaseFiles =
    readSqlGroup(
      input.databaseFiles,
      [
        "primaryFileName",
        "backupFileName",
      ] as const,
      `${label}.databaseFiles`,
    );
  const artifactFiles =
    readSqlGroup(
      input.artifactFiles,
      [
        "packageLoadFileName",
        "measurementFileName",
      ] as const,
      `${label}.artifactFiles`,
    );
  const provenanceFiles =
    readSqlGroup(
      input.provenanceFiles,
      [
        "packageManifestPath",
        "packageLockPath",
      ] as const,
      `${label}.provenanceFiles`,
    );
  const fixtureInput = readRecord(
    input.fixtureGeneration,
    `${label}.fixtureGeneration`,
  );
  const fixtureFields = [
    "workCount",
    "documentsPerWork",
    "revisionsPerDocument",
    "revisionSequenceStart",
    "displayNameMaterials",
  ] as const;
  assertFields(
    fixtureInput,
    fixtureFields,
    fixtureFields,
    `${label}.fixtureGeneration`,
  );

  if (
    !Array.isArray(input.pragmaSteps) ||
    input.pragmaSteps.length === 0
  ) {
    throw new Error(
      `${label}.pragmaSteps must be a non-empty array`,
    );
  }
  const pragmaSteps =
    input.pragmaSteps.map(
      (entry, index) => {
        const itemLabel =
          `${label}.pragmaSteps[${index}]`;
        const pragma = readRecord(
          entry,
          itemLabel,
        );
        assertFields(
          pragma,
          [
            "id",
            "applySql",
            "verifySql",
            "expectedRows",
          ],
          [
            "id",
            "applySql",
            "verifySql",
            "expectedRows",
          ],
          itemLabel,
        );
        return {
          id: readString(
            pragma,
            "id",
            itemLabel,
          ),
          applySql: readString(
            pragma,
            "applySql",
            itemLabel,
          ),
          verifySql: readString(
            pragma,
            "verifySql",
            itemLabel,
          ),
          expectedRows: readRows(
            pragma.expectedRows,
            `${itemLabel}.expectedRows`,
          ),
        };
      },
    );

  const versionInput = readRecord(
    input.sqliteVersionQuery,
    `${label}.sqliteVersionQuery`,
  );
  assertFields(
    versionInput,
    ["sql", "column"],
    ["sql", "column"],
    `${label}.sqliteVersionQuery`,
  );
  const integrityInput = readRecord(
    input.integrityVerification,
    `${label}.integrityVerification`,
  );
  assertFields(
    integrityInput,
    [
      "sql",
      "parameters",
      "expectedRows",
    ],
    [
      "sql",
      "parameters",
      "expectedRows",
    ],
    `${label}.integrityVerification`,
  );
  if (
    !Array.isArray(
      integrityInput.parameters,
    ) ||
    integrityInput.parameters.length !==
      0
  ) {
    throw new Error(
      `${label}.integrityVerification.parameters must be an empty array`,
    );
  }

  const measurementInput = readRecord(
    input.measurement,
    `${label}.measurement`,
  );
  const measurementFields = [
    "independentRunCount",
    "repetitionsPerRun",
    "summaryPercentile",
    "timeoutMs",
  ] as const;
  assertFields(
    measurementInput,
    measurementFields,
    measurementFields,
    `${label}.measurement`,
  );
  const summaryPercentile =
    readPositiveInteger(
      measurementInput,
      "summaryPercentile",
      `${label}.measurement`,
    );
  if (summaryPercentile > 100) {
    throw new Error(
      `${label}.measurement.summaryPercentile must not exceed 100`,
    );
  }

  const packageFields = [
    "electronRuntimeDirectoryPath",
    "applicationResourcesRelativePath",
    "electronExecutableRelativePath",
    "applicationManifestRelativePath",
    "applicationMainRelativePath",
    "compiledApplicationRelativePath",
    "compiledPlatformRelativePath",
    "compiledApplicationTargetRelativePath",
    "compiledPlatformTargetRelativePath",
    "compiledContractEntryFileName",
    "compiledPlatformEntryFileName",
    "betterSqlitePackagePath",
    "betterSqlitePackageTargetRelativePath",
  ] as const;
  const packageInput = readRecord(
    input.packageProbe,
    `${label}.packageProbe`,
  );
  assertFields(
    packageInput,
    packageFields,
    packageFields,
    `${label}.packageProbe`,
  );
  const packageProbe =
    Object.fromEntries(
      packageFields.map(
        (field) => [
          field,
          readString(
            packageInput,
            field,
            `${label}.packageProbe`,
          ),
        ],
      ),
    ) as Poc3DriverBakeOffManifest[
      "packageProbe"
    ];

  const parsed:
    Poc3DriverBakeOffManifest = {
      schemaVersion:
        readPositiveInteger(
          input,
          "schemaVersion",
          label,
        ),
      checksumAlgorithm:
        readString(
          input,
          "checksumAlgorithm",
          label,
        ),
      candidates,
      officialEvidence,
      databaseFiles,
      artifactFiles,
      provenanceFiles,
      fixtureGeneration: {
        workCount:
          readPositiveInteger(
            fixtureInput,
            "workCount",
            `${label}.fixtureGeneration`,
          ),
        documentsPerWork:
          readPositiveInteger(
            fixtureInput,
            "documentsPerWork",
            `${label}.fixtureGeneration`,
          ),
        revisionsPerDocument:
          readPositiveInteger(
            fixtureInput,
            "revisionsPerDocument",
            `${label}.fixtureGeneration`,
          ),
        revisionSequenceStart:
          readPositiveInteger(
            fixtureInput,
            "revisionSequenceStart",
            `${label}.fixtureGeneration`,
          ),
        displayNameMaterials:
          readStringArray(
            fixtureInput
              .displayNameMaterials,
            `${label}.fixtureGeneration.displayNameMaterials`,
          ),
      },
      pragmaSteps,
      schemaStatements:
        readStringArray(
          input.schemaStatements,
          `${label}.schemaStatements`,
        ),
      writeTransaction:
        readSqlGroup(
          input.writeTransaction,
          [
            "beginSql",
            "insertWorkSql",
            "insertDocumentSql",
            "insertRevisionSql",
            "commitSql",
          ] as const,
          `${label}.writeTransaction`,
        ),
      rollbackTransaction:
        readSqlGroup(
          input.rollbackTransaction,
          [
            "beginSql",
            "insertWorkSql",
            "rollbackSql",
            "verificationSql",
          ] as const,
          `${label}.rollbackTransaction`,
        ),
      foreignKeyRejection:
        readSqlGroup(
          input.foreignKeyRejection,
          [
            "beginSql",
            "insertDocumentSql",
            "rollbackSql",
            "verificationSql",
          ] as const,
          `${label}.foreignKeyRejection`,
        ),
      ledgerVerificationSql:
        readString(
          input,
          "ledgerVerificationSql",
          label,
        ),
      sqliteVersionQuery: {
        sql: readString(
          versionInput,
          "sql",
          `${label}.sqliteVersionQuery`,
        ),
        column: readString(
          versionInput,
          "column",
          `${label}.sqliteVersionQuery`,
        ),
      },
      integrityVerification: {
        sql: readString(
          integrityInput,
          "sql",
          `${label}.integrityVerification`,
        ),
        parameters: [],
        expectedRows: readRows(
          integrityInput.expectedRows,
          `${label}.integrityVerification.expectedRows`,
        ),
      },
      measurement: {
        independentRunCount:
          readPositiveInteger(
            measurementInput,
            "independentRunCount",
            `${label}.measurement`,
          ),
        repetitionsPerRun:
          readPositiveInteger(
            measurementInput,
            "repetitionsPerRun",
            `${label}.measurement`,
          ),
        summaryPercentile,
        timeoutMs:
          readPositiveInteger(
            measurementInput,
            "timeoutMs",
            `${label}.measurement`,
          ),
      },
      packageProbe,
    };
  return deepFreeze(parsed);
}

function sortLedgerRows(
  rows: Poc3SqlRow[],
): readonly Poc3SqlRow[] {
  return rows.sort((left, right) => {
    const leftKey = JSON.stringify([
      left.work_id,
      left.document_id,
      left.sequence,
    ]);
    const rightKey = JSON.stringify([
      right.work_id,
      right.document_id,
      right.sequence,
    ]);
    return leftKey < rightKey
      ? -1
      : leftKey > rightKey
        ? 1
        : 0;
  });
}

export function generatePoc3DriverFixture(
  manifest:
    Poc3DriverBakeOffManifest,
  createId: () => string,
  createChecksum:
    (value: string) => string,
): Poc3GeneratedDriverFixture {
  const usedIds = new Set<string>();
  const nextId = (): string => {
    const id = createId();
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      usedIds.has(id)
    ) {
      throw new Error(
        "POC-3 runtime fixture generator requires unique non-empty IDs",
      );
    }
    usedIds.add(id);
    return id;
  };
  const material =
    manifest.fixtureGeneration
      .displayNameMaterials.join("");
  const makeDisplayName =
    (id: string): string =>
      `${material}-${id}`;

  const works: {
    workId: string;
    displayName: string;
  }[] = [];
  const documents: {
    workId: string;
    documentId: string;
    displayName: string;
  }[] = [];
  const revisions: {
    workId: string;
    documentId: string;
    revisionId: string;
    sequence: number;
    contentChecksum: string;
  }[] = [];
  for (
    let workIndex = 0;
    workIndex <
      manifest.fixtureGeneration
        .workCount;
    workIndex += 1
  ) {
    const workId = nextId();
    works.push({
      workId,
      displayName:
        makeDisplayName(workId),
    });
    for (
      let documentIndex = 0;
      documentIndex <
        manifest.fixtureGeneration
          .documentsPerWork;
      documentIndex += 1
    ) {
      const documentId = nextId();
      documents.push({
        workId,
        documentId,
        displayName:
          makeDisplayName(
            documentId,
          ),
      });
      for (
        let revisionIndex = 0;
        revisionIndex <
          manifest.fixtureGeneration
            .revisionsPerDocument;
        revisionIndex += 1
      ) {
        const revisionId = nextId();
        const contentChecksum =
          createChecksum(
            revisionId,
          );
        if (
          typeof contentChecksum !==
            "string" ||
          contentChecksum.length === 0
        ) {
          throw new Error(
            "POC-3 runtime fixture generator requires non-empty checksums",
          );
        }
        revisions.push({
          workId,
          documentId,
          revisionId,
          sequence:
            manifest
              .fixtureGeneration
              .revisionSequenceStart +
            revisionIndex,
          contentChecksum,
        });
      }
    }
  }
  const rollbackWorkId = nextId();
  const missingWorkId = nextId();
  const rejectedDocumentId =
    nextId();
  const ledgerExpectedRows =
    sortLedgerRows(
      revisions.map((revision) => ({
        work_id: revision.workId,
        document_id:
          revision.documentId,
        revision_id:
          revision.revisionId,
        sequence: revision.sequence,
        content_checksum:
          revision.contentChecksum,
      })),
    );
  return deepFreeze({
    works,
    documents,
    revisions,
    rollbackWork: {
      workId: rollbackWorkId,
      displayName:
        makeDisplayName(
          rollbackWorkId,
        ),
    },
    foreignKeyDocument: {
      missingWorkId,
      documentId:
        rejectedDocumentId,
      displayName:
        makeDisplayName(
          rejectedDocumentId,
        ),
    },
    ledgerExpectedRows,
  });
}
