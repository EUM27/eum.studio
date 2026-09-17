import type {
  CharacterKnowledgeProjection,
  CharacterKnowledgeStance,
  KnowledgeTruthStatus,
} from "../../../application/continuity/character-knowledge-contract";

export type CharacterKnowledgeViewFilter = Readonly<{
  status: "all" | "current" | "history";
  characterId: string | null;
  stance: "all" | CharacterKnowledgeStance;
  truthStatus: "all" | KnowledgeTruthStatus;
  query: string;
}>;

export const DEFAULT_CHARACTER_KNOWLEDGE_FILTER: CharacterKnowledgeViewFilter =
  Object.freeze({
    status: "current",
    characterId: null,
    stance: "all",
    truthStatus: "all",
    query: "",
  });

export function filterCharacterKnowledge(
  entries: readonly CharacterKnowledgeProjection[],
  filter: CharacterKnowledgeViewFilter,
): readonly CharacterKnowledgeProjection[] {
  const query = filter.query.trim().toLocaleLowerCase("ko-KR");
  return Object.freeze(entries.filter((entry) =>
    (filter.status === "all" ||
      (filter.status === "current" ? entry.status === "active" : entry.status !== "active")) &&
    (filter.characterId === null || entry.characterId === filter.characterId) &&
    (filter.stance === "all" || entry.stance === filter.stance) &&
    (filter.truthStatus === "all" || entry.truthStatus === filter.truthStatus) &&
    (query.length === 0 || entry.statement.toLocaleLowerCase("ko-KR").includes(query))
  ));
}
