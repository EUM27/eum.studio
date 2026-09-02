import { entityId, type EntityId } from "../../domain/writing";

export const CANONICAL_MARKDOWN_ENTITY_KINDS = Object.freeze([
  "character",
  "character-relation",
  "lore-entry",
  "event-block",
  "plot-thread",
  "foreshadow-line",
  "scene",
  "continuity-thread",
  "character-knowledge",
] as const);

export type CanonicalMarkdownEntityKind =
  (typeof CANONICAL_MARKDOWN_ENTITY_KINDS)[number];
export type CanonicalMarkdownFieldValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];
export type CanonicalMarkdownField = Readonly<{
  label: string;
  value: CanonicalMarkdownFieldValue;
}>;
export type CanonicalMarkdownLink = Readonly<{
  label: string;
  targetKind: CanonicalMarkdownEntityKind;
  targetId: string;
}>;
export type CanonicalMarkdownEntitySource = Readonly<{
  kind: CanonicalMarkdownEntityKind;
  entityId: string;
  revision: number | null;
  title: string;
  aliases: readonly string[];
  status: string;
  updatedAt: string;
  fields: readonly CanonicalMarkdownField[];
  links: readonly CanonicalMarkdownLink[];
}>;
export type CanonicalMarkdownExportSource = Readonly<{
  schemaVersion: 1;
  workId: string;
  workTitle: string;
  documents: readonly Readonly<{
    documentId: string;
    title: string;
    documentRevisionId: string;
  }>[];
  entities: readonly CanonicalMarkdownEntitySource[];
}>;

export type ExportCanonicalMarkdownCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type CanonicalMarkdownEntityCounts = Readonly<
  Record<CanonicalMarkdownEntityKind, number>
>;

export type CanonicalMarkdownExportFile = Readonly<{
  relativePath: string;
  content: string;
  byteLength: number;
  sha256: string;
}>;

export type PreparedCanonicalMarkdownExport = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  workTitle: string;
  direction: "canonical-to-markdown";
  importSupported: false;
  suggestedDirectoryName: string;
  sourceManifestHash: string;
  bundleManifestHash: string;
  entityCounts: CanonicalMarkdownEntityCounts;
  files: readonly CanonicalMarkdownExportFile[];
}>;

export type ExportCanonicalMarkdownResult =
  | Readonly<{ schemaVersion: 1; status: "cancelled" }>
  | Readonly<{
      schemaVersion: 1;
      status: "completed";
      directoryName: string;
      fileCount: number;
      byteLength: number;
      sourceManifestHash: string;
      bundleManifestHash: string;
      entityCounts: CanonicalMarkdownEntityCounts;
    }>;

const FOLDER_BY_KIND: Readonly<Record<CanonicalMarkdownEntityKind, string>> =
  Object.freeze({
    character: "인물",
    "character-relation": "인물-관계",
    "lore-entry": "설정",
    "event-block": "사건",
    "plot-thread": "플롯",
    "foreshadow-line": "복선",
    scene: "장면",
    "continuity-thread": "연속성",
    "character-knowledge": "인물-지식",
  });

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmptyText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function hashText(value: string, label: string): string {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256`);
  }
  return value;
}

function createEmptyCounts(): Record<CanonicalMarkdownEntityKind, number> {
  return {
    character: 0,
    "character-relation": 0,
    "lore-entry": 0,
    "event-block": 0,
    "plot-thread": 0,
    "foreshadow-line": 0,
    scene: 0,
    "continuity-thread": 0,
    "character-knowledge": 0,
  };
}

function parseCounts(value: unknown, label: string): CanonicalMarkdownEntityCounts {
  const input = record(value, label);
  exact(input, CANONICAL_MARKDOWN_ENTITY_KINDS, label);
  const counts = createEmptyCounts();
  for (const kind of CANONICAL_MARKDOWN_ENTITY_KINDS) {
    counts[kind] = nonNegativeInteger(input[kind], `${label}.${kind}`);
  }
  return Object.freeze(counts);
}

export function parseExportCanonicalMarkdownCommand(
  value: unknown,
): ExportCanonicalMarkdownCommand {
  const label = "ExportCanonicalMarkdownCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  if (input.schemaVersion !== 1) throw new Error(`Unsupported ${label} schemaVersion`);
  return Object.freeze({
    schemaVersion: 1,
    workId: entityId<"Work">(nonEmptyText(input.workId, `${label}.workId`)),
  });
}

export function parseExportCanonicalMarkdownResult(
  value: unknown,
): ExportCanonicalMarkdownResult {
  const label = "ExportCanonicalMarkdownResult";
  const input = record(value, label);
  if (input.status === "cancelled") {
    exact(input, ["schemaVersion", "status"], label);
    if (input.schemaVersion !== 1) throw new Error(`Unsupported ${label} schemaVersion`);
    return Object.freeze({ schemaVersion: 1, status: "cancelled" });
  }
  exact(input, [
    "schemaVersion",
    "status",
    "directoryName",
    "fileCount",
    "byteLength",
    "sourceManifestHash",
    "bundleManifestHash",
    "entityCounts",
  ], label);
  if (input.schemaVersion !== 1 || input.status !== "completed") {
    throw new Error(`${label} is invalid`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "completed",
    directoryName: nonEmptyText(input.directoryName, `${label}.directoryName`),
    fileCount: nonNegativeInteger(input.fileCount, `${label}.fileCount`),
    byteLength: nonNegativeInteger(input.byteLength, `${label}.byteLength`),
    sourceManifestHash: hashText(
      nonEmptyText(input.sourceManifestHash, `${label}.sourceManifestHash`),
      `${label}.sourceManifestHash`,
    ),
    bundleManifestHash: hashText(
      nonEmptyText(input.bundleManifestHash, `${label}.bundleManifestHash`),
      `${label}.bundleManifestHash`,
    ),
    entityCounts: parseCounts(input.entityCounts, `${label}.entityCounts`),
  });
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function safeSegment(value: string, fallback: string): string {
  const withoutControlCharacters = [...value.trim()]
    .map((character) => character.codePointAt(0)! < 32 ? "-" : character)
    .join("");
  const replaced = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/gu, "-")
    .replace(/[. ]+$/gu, "")
    .replace(/\s+/gu, " ")
    .slice(0, 48);
  const candidate = replaced.length === 0 ? fallback : replaced;
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu.test(candidate)
    ? `_${candidate}`
    : candidate;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function markdownText(value: CanonicalMarkdownFieldValue): string {
  if (value === null) return "없음";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.length === 0 ? "없음" : value;
  return value.length === 0 ? "없음" : value.join("\n");
}

function quoteBody(value: CanonicalMarkdownFieldValue): string {
  return markdownText(value)
    .split(/\r?\n/u)
    .map((line) => `> ${line}`)
    .join("\n");
}

function normalizedSource(source: CanonicalMarkdownExportSource) {
  return {
    schemaVersion: 1,
    workId: source.workId,
    workTitle: source.workTitle,
    documents: [...source.documents]
      .map((document) => ({ ...document }))
      .sort((a, b) => compareText(a.documentId, b.documentId)),
    entities: [...source.entities]
      .map((entity) => ({
        ...entity,
        aliases: [...entity.aliases].sort(compareText),
        fields: [...entity.fields]
          .map((field) => ({ ...field, value: Array.isArray(field.value) ? [...field.value] : field.value }))
          .sort((a, b) => compareText(a.label, b.label)),
        links: [...entity.links]
          .map((link) => ({ ...link }))
          .sort((a, b) =>
            compareText(`${a.label}:${a.targetKind}:${a.targetId}`, `${b.label}:${b.targetKind}:${b.targetId}`)
          ),
      }))
      .sort((a, b) => compareText(`${a.kind}:${a.entityId}`, `${b.kind}:${b.entityId}`)),
  };
}

function createEntityPath(
  entity: CanonicalMarkdownEntitySource,
  createSha256: (value: string) => string,
): string {
  const title = safeSegment(entity.title, FOLDER_BY_KIND[entity.kind]);
  const identityHash = hashText(
    createSha256(`${entity.kind}:${entity.entityId}`),
    "entity path hash",
  );
  return `${FOLDER_BY_KIND[entity.kind]}/${title}--${identityHash}.md`;
}

function renderEntityNote(input: Readonly<{
  entity: CanonicalMarkdownEntitySource;
  pathByEntity: ReadonlyMap<string, string>;
  titleByEntity: ReadonlyMap<string, string>;
  sourceManifestHash: string;
  workId: string;
  workTitle: string;
}>): string {
  const { entity } = input;
  const aliases = entity.aliases.map(yamlString).join(", ");
  const frontmatter = [
    "---",
    "eum_export_schema: 1",
    'source: "eum-studio-canonical-ledger"',
    'export_direction: "canonical-to-markdown"',
    "read_only_copy: true",
    `work_id: ${yamlString(input.workId)}`,
    `work_title: ${yamlString(input.workTitle)}`,
    `entity_kind: ${yamlString(entity.kind)}`,
    `entity_id: ${yamlString(entity.entityId)}`,
    `entity_revision: ${entity.revision === null ? "null" : entity.revision}`,
    `entity_status: ${yamlString(entity.status)}`,
    `source_updated_at: ${yamlString(entity.updatedAt)}`,
    `source_manifest_sha256: ${yamlString(input.sourceManifestHash)}`,
    `aliases: [${aliases}]`,
    "---",
  ];
  const fields = entity.fields.flatMap((field) => [
    `## ${field.label.replace(/[#\r\n]/gu, " ").trim() || "값"}`,
    "",
    quoteBody(field.value),
    "",
  ]);
  const links = entity.links.map((link) => {
    const key = `${link.targetKind}:${link.targetId}`;
    const targetPath = input.pathByEntity.get(key);
    const targetTitle = input.titleByEntity.get(key) ?? link.targetId;
    return targetPath === undefined
      ? `- ${link.label}: ${link.targetKind}:${link.targetId}`
      : `- ${link.label}: [[${targetPath.replace(/\.md$/u, "")}|${targetTitle.replace(/[\]|]/gu, " ")}]]`;
  });
  return [
    ...frontmatter,
    "",
    "> 이 파일은 이음 스튜디오 별빛에서 만든 단방향 사본입니다. 이 파일의 편집 내용은 별빛으로 다시 가져오지 않습니다.",
    "",
    `# ${entity.title}`,
    "",
    ...fields,
    ...(links.length === 0 ? [] : ["## 연결", "", ...links, ""]),
  ].join("\n").replace(/\n*$/u, "\n");
}

function renderIndex(input: Readonly<{
  source: ReturnType<typeof normalizedSource>;
  sourceManifestHash: string;
  pathByEntity: ReadonlyMap<string, string>;
}>): string {
  const grouped = CANONICAL_MARKDOWN_ENTITY_KINDS.flatMap((kind) => {
    const entities = input.source.entities.filter((entity) => entity.kind === kind);
    if (entities.length === 0) return [];
    return [
      `## ${FOLDER_BY_KIND[kind]}`,
      "",
      ...entities.map((entity) => {
        const notePath = input.pathByEntity.get(`${entity.kind}:${entity.entityId}`)!;
        return `- [[${notePath.replace(/\.md$/u, "")}|${entity.title.replace(/[\]|]/gu, " ")}]] · revision ${entity.revision ?? "없음"} · ${entity.status}`;
      }),
      "",
    ];
  });
  return [
    "---",
    "eum_export_schema: 1",
    'source: "eum-studio-canonical-ledger"',
    'export_direction: "canonical-to-markdown"',
    "read_only_copy: true",
    `work_id: ${yamlString(input.source.workId)}`,
    `work_title: ${yamlString(input.source.workTitle)}`,
    `source_manifest_sha256: ${yamlString(input.sourceManifestHash)}`,
    "---",
    "",
    "> 이 폴더는 이음 스튜디오 별빛의 단방향 Markdown 사본입니다. Markdown 재가져오기와 양방향 동기화는 지원하지 않습니다.",
    "",
    `# ${input.source.workTitle} · 별빛 색인`,
    "",
    "## 회차 revision",
    "",
    ...(input.source.documents.length === 0
      ? ["- 없음"]
      : input.source.documents.map((document) =>
          `- ${document.title} · ${document.documentId} · ${document.documentRevisionId}`
        )),
    "",
    ...grouped,
  ].join("\n").replace(/\n*$/u, "\n");
}

export function createCanonicalMarkdownExportBundle(
  source: CanonicalMarkdownExportSource,
  createSha256: (value: string) => string,
): PreparedCanonicalMarkdownExport {
  if (source.schemaVersion !== 1) throw new Error("Unsupported canonical Markdown source schemaVersion");
  const workId = entityId<"Work">(nonEmptyText(source.workId, "CanonicalMarkdownExportSource.workId"));
  const workTitle = nonEmptyText(source.workTitle, "CanonicalMarkdownExportSource.workTitle");
  if (new Set(source.entities.map((entity) => `${entity.kind}:${entity.entityId}`)).size !== source.entities.length) {
    throw new Error("Canonical Markdown source contains duplicate entity identities");
  }
  const normalized = normalizedSource(source);
  const sourceManifestHash = hashText(
    createSha256(JSON.stringify(normalized)),
    "canonical Markdown source manifest hash",
  );
  const pathByEntity = new Map<string, string>();
  const titleByEntity = new Map<string, string>();
  for (const entity of normalized.entities) {
    const key = `${entity.kind}:${entity.entityId}`;
    pathByEntity.set(key, createEntityPath(entity, createSha256));
    titleByEntity.set(key, entity.title);
  }
  const rawFiles = [
    { relativePath: "00-별빛-색인.md", content: renderIndex({ source: normalized, sourceManifestHash, pathByEntity }) },
    ...normalized.entities.map((entity) => ({
      relativePath: pathByEntity.get(`${entity.kind}:${entity.entityId}`)!,
      content: renderEntityNote({
        entity,
        pathByEntity,
        titleByEntity,
        sourceManifestHash,
        workId,
        workTitle,
      }),
    })),
  ].sort((a, b) => compareText(a.relativePath, b.relativePath));
  if (new Set(rawFiles.map((file) => file.relativePath)).size !== rawFiles.length) {
    throw new Error("Canonical Markdown export contains colliding file paths");
  }
  const files = Object.freeze(rawFiles.map((file) => Object.freeze({
    ...file,
    byteLength: new TextEncoder().encode(file.content).byteLength,
    sha256: hashText(createSha256(file.content), `SHA-256 for ${file.relativePath}`),
  })));
  const bundleManifestHash = hashText(
    createSha256(JSON.stringify(files.map((file) => ({
      relativePath: file.relativePath,
      byteLength: file.byteLength,
      sha256: file.sha256,
    })))),
    "canonical Markdown bundle manifest hash",
  );
  const entityCounts = createEmptyCounts();
  for (const entity of normalized.entities) entityCounts[entity.kind] += 1;
  return Object.freeze({
    schemaVersion: 1,
    workId,
    workTitle,
    direction: "canonical-to-markdown",
    importSupported: false,
    suggestedDirectoryName: `${safeSegment(workTitle, "작품")}-이음-별빛-${sourceManifestHash.slice(0, 12)}`,
    sourceManifestHash,
    bundleManifestHash,
    entityCounts: Object.freeze(entityCounts),
    files,
  });
}
