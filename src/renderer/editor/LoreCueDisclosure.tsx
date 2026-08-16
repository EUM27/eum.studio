import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import type {
  LoreCue,
} from "../../application/lore/lore-cue-projection";
import type { LoreCueInteraction } from "./lore-cue-extension";

function entriesForCue(
  cue: LoreCue,
  entries: readonly LoreEntryProjection[],
): readonly LoreEntryProjection[] {
  const ids = new Set(cue.loreEntryIds);
  return entries.filter(
    (entry) =>
      ids.has(entry.loreEntryId) &&
      entry.enabled &&
      entry.retiredAt === null &&
      entry.workId === cue.workId,
  );
}

export function LoreCueTooltip(input: {
  readonly interaction: LoreCueInteraction;
  readonly entries: readonly LoreEntryProjection[];
}) {
  const entries = entriesForCue(input.interaction.cue, input.entries);
  if (entries.length === 0) return null;
  return (
    <aside
      aria-label="별빛 미리보기"
      className="lore-cue-tooltip"
      role="tooltip"
      style={{
        left: input.interaction.anchor.right + 8,
        top: input.interaction.anchor.top,
      }}
    >
      <span>별빛 · {input.interaction.cue.lineNumber}행</span>
      {entries.map((entry) => (
        <div key={entry.loreEntryId}>
          <strong>{entry.title}</strong>
          {entry.category.length > 0 && <small>{entry.category}</small>}
          {entry.content.length > 0 && <p>{entry.content}</p>}
        </div>
      ))}
    </aside>
  );
}

export function LoreCueInspector(input: {
  readonly cue: LoreCue;
  readonly entries: readonly LoreEntryProjection[];
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onSelectOccurrence: (
    occurrence: LoreCue["occurrences"][number],
  ) => void;
}) {
  const entries = entriesForCue(input.cue, input.entries);
  if (entries.length === 0) return null;
  return (
    <section aria-label="별빛 검사기" className="lore-cue-inspector">
      <header>
        <div>
          <span>현재 줄</span>
          <h4>별빛 · {input.cue.lineNumber}행</h4>
        </div>
        <button aria-label="별빛 검사기 닫기" onClick={input.onClose} type="button">
          닫기
        </button>
      </header>
      <ul>
        {entries.map((entry) => {
          const occurrences = input.cue.occurrences.filter(
            (occurrence) => occurrence.loreEntryId === entry.loreEntryId,
          );
          return (
            <li key={entry.loreEntryId}>
              <div>
                <strong>{entry.title}</strong>
                {entry.category.length > 0 && <span>{entry.category}</span>}
              </div>
              {entry.aliases.length > 0 && (
                <p>별칭 {entry.aliases.join(" · ")}</p>
              )}
              {entry.content.length > 0 && <p>{entry.content}</p>}
              <div className="lore-cue-occurrences">
                {occurrences.map((occurrence) => (
                  <button
                    key={`${occurrence.loreEntryId}:${occurrence.from}:${occurrence.to}`}
                    onClick={() => input.onSelectOccurrence(occurrence)}
                    type="button"
                  >
                    “{occurrence.matchedText}” 원고에서 보기
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {input.error !== null && <p className="event-action-error" role="alert">{input.error}</p>}
    </section>
  );
}
