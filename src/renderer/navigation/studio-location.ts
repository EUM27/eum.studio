import type { EntityId } from "../../domain/writing";

export type StudioSection =
  | "today"
  | "works"
  | "operations"
  | "resources"
  | "settings";

export type WorkSection =
  | "write"
  | "structure"
  | "canon"
  | "review"
  | "operations";

export type CanonTab = "canonical" | "review" | "continuity" | "knowledge" | "digest" | "context";

export type StructureTab =
  | "overview"
  | "plots"
  | "events"
  | "scenes"
  | "characters"
  | "foreshadow"
  | "lore";

export type ReviewTab =
  | "records"
  | "manuscript"
  | "candidates"
  | "versions";

export type StudioLocation =
  | {
      readonly scope: "studio";
      readonly section: StudioSection;
    }
  | {
      readonly scope: "work";
      readonly workId: EntityId<"Work">;
      readonly section: WorkSection;
      readonly tab?: StructureTab | CanonTab | ReviewTab;
      readonly documentId?: EntityId<"Document">;
      readonly entityId?: string;
      readonly returnTo?: StudioLocation;
    };

export const DEFAULT_WORK_SECTION: WorkSection = "write";
export const DEFAULT_CANON_TAB: CanonTab = "canonical";
export const DEFAULT_STRUCTURE_TAB: StructureTab = "overview";
export const DEFAULT_REVIEW_TAB: ReviewTab = "records";
