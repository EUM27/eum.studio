import type { EntityId } from "../../domain/writing";

export type StudioSection =
  | "today"
  | "works"
  | "operations"
  | "resources"
  | "settings";

export type WorkSection = "write" | "structure" | "review" | "operations";

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
      readonly tab?: StructureTab | ReviewTab;
      readonly documentId?: EntityId<"Document">;
      readonly entityId?: string;
      readonly returnTo?: StudioLocation;
    };

export const DEFAULT_WORK_SECTION: WorkSection = "write";
export const DEFAULT_STRUCTURE_TAB: StructureTab = "overview";
export const DEFAULT_REVIEW_TAB: ReviewTab = "records";
