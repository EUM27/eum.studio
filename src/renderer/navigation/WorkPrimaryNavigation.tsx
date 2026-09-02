import type { WorkSection } from "./studio-location";

const WORK_SECTION_LABELS: Readonly<Record<WorkSection, string>> = Object.freeze({
  write: "쓰기",
  structure: "구조",
  canon: "별빛",
  review: "검토",
  operations: "운영",
});

const WORK_SECTIONS = Object.freeze(
  Object.keys(WORK_SECTION_LABELS) as WorkSection[],
);

export function WorkPrimaryNavigation(input: {
  readonly activeSection: WorkSection;
  readonly disabled?: boolean;
  readonly onChange: (section: WorkSection) => void;
}) {
  return (
    <nav aria-label="작품 작업면" className="work-primary-navigation">
      {WORK_SECTIONS.map((section) => (
        <button
          aria-current={input.activeSection === section ? "page" : undefined}
          className={input.activeSection === section ? "is-active" : undefined}
          disabled={input.disabled}
          key={section}
          onClick={() => input.onChange(section)}
          type="button"
        >
          {WORK_SECTION_LABELS[section]}
        </button>
      ))}
    </nav>
  );
}
