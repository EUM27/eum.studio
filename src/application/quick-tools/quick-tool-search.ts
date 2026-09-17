export type QuickToolTarget = {
  readonly id: string;
  readonly kind: "command" | "work" | "document";
  readonly label: string;
  readonly detail: string;
  readonly workId: string | null;
  readonly documentId: string | null;
  readonly keywords?: readonly string[];
};

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

export function searchQuickToolTargets(input: {
  readonly targets: readonly QuickToolTarget[];
  readonly query: string;
  readonly activeWorkId: string | null;
  readonly activeDocumentId: string | null;
}): readonly QuickToolTarget[] {
  const query = normalize(input.query.trim());
  return Object.freeze(
    query.length === 0
      ? [...input.targets]
      : input.targets.filter((target) => {
          const searchable = normalize(`${target.label}\n${target.detail}\n${target.keywords?.join(" ") ?? ""}`);
          return query.split(/\s+/u).every((term) => searchable.includes(term));
        }),
  );
}
