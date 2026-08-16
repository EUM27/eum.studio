import { useMemo, useState } from "react";

import type { PublishingPartnerProjection } from "../../application/publishing/publishing-partner-contract";
import { parsePublishingPartnerCsvText } from "../../application/publishing/publishing-partner-csv-import";
import {
  PUBLISHING_SUBMISSION_CSV_FIELDS,
  buildPublishingSubmissionCsvImportPreview,
  type ApplyPublishingSubmissionCsvImportCommand,
  type PublishingSubmissionCsvField,
  type PublishingSubmissionCsvImportPreview,
  type PublishingSubmissionCsvMapping,
  type PublishingSubmissionCsvSelectionProjection,
} from "../../application/publishing/publishing-submission-csv-import";
import type { WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import type { PublishingPartnerDialogActionState } from "./PublishingPartnerDialog";

const FIELD_LABELS: Readonly<Record<PublishingSubmissionCsvField, string>> = Object.freeze({
  workLabel: "작품 이름",
  partnerLabel: "투고처 이름",
  title: "투고 제목",
  submittedOn: "투고일",
  respondedOn: "회신일",
  status: "상태",
  result: "결과",
  note: "메모",
  cardNote: "카드 메모",
});

const ISSUE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "missing-header": "헤더 없음",
  "duplicate-header": "중복 헤더",
  "unknown-mapped-header": "선택한 헤더 없음",
  "missing-work-label": "작품 이름 없음",
  "missing-partner-label": "투고처 이름 없음",
  "missing-work": "일치하는 작품 없음",
  "ambiguous-work": "같은 이름의 작품이 여러 개",
  "missing-partner": "일치하는 투고처 없음",
  "ambiguous-partner": "같은 이름의 투고처가 여러 개",
  "invalid-submitted-on": "투고일 형식 오류",
  "invalid-responded-on": "회신일 형식 오류",
});

export function PublishingSubmissionCsvImportPanel(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly works: WorkspaceCatalogProjection["works"];
  readonly partners: readonly PublishingPartnerProjection[];
  readonly onSelectFile: () => Promise<PublishingSubmissionCsvSelectionProjection | null>;
  readonly onApply: (
    command: Omit<ApplyPublishingSubmissionCsvImportCommand, "schemaVersion">,
  ) => Promise<boolean>;
}) {
  const [selection, setSelection] = useState<
    Extract<PublishingSubmissionCsvSelectionProjection, { status: "selected" }> | null
  >(null);
  const [mapping, setMapping] = useState<Partial<PublishingSubmissionCsvMapping>>({});
  const [preview, setPreview] = useState<PublishingSubmissionCsvImportPreview | null>(null);
  const [applied, setApplied] = useState(false);
  const busy = input.actionState !== "idle";
  const headers = useMemo(
    () => selection === null ? [] : parsePublishingPartnerCsvText(selection.csvText).headers,
    [selection],
  );
  const canPreview = mapping.workLabel !== undefined && mapping.partnerLabel !== undefined;

  return (
    <section aria-labelledby="publishing-submission-csv-title" className="publishing-import-panel">
      <header>
        <div>
          <p className="panel-kicker">CSV IMPORT</p>
          <h3 id="publishing-submission-csv-title">투고 이력 CSV 가져오기</h3>
          <p>작품과 투고처 열을 직접 연결하고 승인하면 현재 원고를 제출본으로 봉인합니다.</p>
        </div>
        <button
          disabled={busy}
          onClick={() => {
            void input.onSelectFile().then((selected) => {
              if (selected === null || selected.status !== "selected") return;
              setSelection(selected);
              setMapping({});
              setPreview(null);
              setApplied(false);
            });
          }}
          type="button"
        >
          {input.actionState === "selecting-submission-csv" ? "선택 중" : "투고 이력 CSV 선택"}
        </button>
      </header>

      {selection === null ? (
        <p className="publishing-partner-empty">선택한 투고 이력 CSV 파일이 없습니다.</p>
      ) : (
        <>
          <p className="publishing-import-file-name">{selection.fileName}</p>
          <fieldset>
            <legend>열 직접 연결</legend>
            <div className="publishing-import-mapping">
              {PUBLISHING_SUBMISSION_CSV_FIELDS.map((field) => (
                <label key={field}>
                  <span>
                    {FIELD_LABELS[field]}
                    {field === "workLabel" || field === "partnerLabel" ? " *" : ""}
                  </span>
                  <select
                    aria-label={`${FIELD_LABELS[field]} CSV 열`}
                    disabled={busy}
                    onChange={(event) => {
                      const header = event.target.value;
                      setMapping((current) => {
                        const next = { ...current };
                        if (header.length === 0) delete next[field];
                        else next[field] = header;
                        return next;
                      });
                      setPreview(null);
                      setApplied(false);
                    }}
                    value={mapping[field] ?? ""}
                  >
                    <option value="">연결 안 함</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            disabled={busy || !canPreview}
            onClick={() => {
              if (!canPreview) return;
              setPreview(buildPublishingSubmissionCsvImportPreview({
                fileName: selection.fileName,
                csvText: selection.csvText,
                mapping: mapping as PublishingSubmissionCsvMapping,
                works: input.works,
                partners: input.partners,
              }));
              setApplied(false);
            }}
            type="button"
          >
            투고 이력 미리보기
          </button>
        </>
      )}

      {preview !== null && (
        <section aria-label="투고 이력 CSV 미리보기" className="publishing-import-preview">
          <p>
            <strong>{preview.readyRows.length}</strong>개 반영 가능 ·{" "}
            <strong>{preview.rowIssues.length}</strong>개 확인 필요
          </p>
          {preview.fileIssues.length > 0 && (
            <ul>
              {preview.fileIssues.map((issue) => <li key={issue}>{ISSUE_LABELS[issue]}</li>)}
            </ul>
          )}
          {preview.rowIssues.length > 0 && (
            <details>
              <summary>확인 필요한 행</summary>
              <ul>
                {preview.rowIssues.map((issue) => (
                  <li key={issue.rowNumber}>
                    {issue.rowNumber}행: {issue.reasons.map((reason) => ISSUE_LABELS[reason]).join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p>승인 시 각 준비 행마다 현재 작품 전체 회차 revision을 불변 제출본으로 봉인합니다.</p>
          <button
            disabled={
              busy || applied || preview.fileIssues.length > 0 || preview.readyRows.length === 0
            }
            onClick={() => {
              void input.onApply({
                fileName: preview.fileName,
                csvText: selection?.csvText ?? "",
                mapping: preview.mapping,
              }).then((ok) => setApplied(ok));
            }}
            type="button"
          >
            {input.actionState === "applying-submission-csv"
              ? "반영 중"
              : applied
                ? "반영 완료"
                : `${preview.readyRows.length}개 승인 반영`}
          </button>
        </section>
      )}
    </section>
  );
}
