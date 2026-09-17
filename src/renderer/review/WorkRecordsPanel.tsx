import type { ReactNode } from "react";

export function WorkRecordsPanel(input: { readonly children: ReactNode }) {
  return <section aria-label="집필 기록" className="review-panel work-records-panel">{input.children}</section>;
}
