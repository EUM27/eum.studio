import { useMemo, useState } from "react";

import type { PublishingPartnerProjection } from "../../application/publishing/publishing-partner-contract";
import {
  PUBLISHING_PARTNER_CSV_FIELDS,
  buildPublishingPartnerCsvImportPreview,
  parsePublishingPartnerCsvText,
  type ApplyPublishingPartnerCsvImportCommand,
  type PublishingPartnerCsvField,
  type PublishingPartnerCsvImportPreview,
  type PublishingPartnerCsvMapping,
  type PublishingPartnerCsvSelectionProjection,
} from "../../application/publishing/publishing-partner-csv-import";
import type { PublishingPartnerDialogActionState } from "./PublishingPartnerDialog";

const FIELD_LABELS: Readonly<Record<PublishingPartnerCsvField, string>> = Object.freeze({
  name: "투고처 이름",
  parentPartnerName: "모 출판사",
  submissionMethod: "투고 방식",
  websiteUrl: "투고 링크",
  email: "이메일",
  genres: "장르",
  requiredLength: "투고 분량",
  priority: "우선순위",
  note: "메모",
});

const ISSUE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "missing-header": "헤더 없음",
  "duplicate-header": "중복 헤더",
  "unknown-mapped-header": "선택한 헤더 없음",
  "missing-name": "투고처 이름 없음",
  "duplicate-import-name": "CSV 안 이름 중복",
  "ambiguous-existing-partner": "기존 투고처 이름 중복",
  "missing-parent": "모 출판사 없음",
  "ambiguous-parent": "모 출판사 이름 중복",
  "self-parent": "자기 자신을 모 출판사로 선택",
});

export function PublishingPartnerCsvImportPanel(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly partners: readonly PublishingPartnerProjection[];
  readonly onSelectFile: () => Promise<PublishingPartnerCsvSelectionProjection | null>;
  readonly onApply: (
    command: Omit<ApplyPublishingPartnerCsvImportCommand, "schemaVersion">,
  ) => Promise<boolean>;
}) {
  const [selection, setSelection] = useState<
    Extract<PublishingPartnerCsvSelectionProjection, { status: "selected" }> | null
  >(null);
  const [mapping, setMapping] = useState<Partial<PublishingPartnerCsvMapping>>({});
  const [preview, setPreview] = useState<PublishingPartnerCsvImportPreview | null>(null);
  const [applied, setApplied] = useState(false);
  const busy = input.actionState !== "idle";
  const headers = useMemo(
    () => selection === null ? [] : parsePublishingPartnerCsvText(selection.csvText).headers,
    [selection],
  );
  const nameHeader = mapping.name;

  return (
    <section aria-labelledby="publishing-partner-csv-title" className="publishing-import-panel">
      <header>
        <div>
          <p className="panel-kicker">CSV IMPORT</p>
          <h3 id="publishing-partner-csv-title">투고처 CSV 가져오기</h3>
          <p>열을 직접 연결하고 미리보기를 승인한 뒤에만 원장에 반영합니다.</p>
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
          {input.actionState === "selecting-partner-csv" ? "선택 중" : "CSV 파일 선택"}
        </button>
      </header>

      {selection === null ? (
        <p className="publishing-partner-empty">선택한 CSV 파일이 없습니다.</p>
      ) : (
        <>
          <p className="publishing-import-file-name">{selection.fileName}</p>
          <fieldset>
            <legend>열 직접 연결</legend>
            <div className="publishing-import-mapping">
              {PUBLISHING_PARTNER_CSV_FIELDS.map((field) => (
                <label key={field}>
                  <span>{FIELD_LABELS[field]}{field === "name" ? " *" : ""}</span>
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
            disabled={busy || nameHeader === undefined}
            onClick={() => {
              if (nameHeader === undefined) return;
              setPreview(buildPublishingPartnerCsvImportPreview({
                fileName: selection.fileName,
                csvText: selection.csvText,
                mapping: mapping as PublishingPartnerCsvMapping,
                partners: input.partners,
              }));
              setApplied(false);
            }}
            type="button"
          >
            미리보기 만들기
          </button>
        </>
      )}

      {preview !== null && (
        <section aria-label="투고처 CSV 미리보기" className="publishing-import-preview">
          <p>
            <strong>{preview.readyRows.length}</strong>개 반영 가능 ·{" "}
            <strong>{preview.rowIssues.length}</strong>개 확인 필요
          </p>
          {preview.fileIssues.length > 0 && (
            <ul>
              {preview.fileIssues.map((issue) => (
                <li key={issue}>{ISSUE_LABELS[issue]}</li>
              ))}
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
          <button
            disabled={
              busy || applied || preview.fileIssues.length > 0 ||
              preview.readyRows.length === 0
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
            {input.actionState === "applying-partner-csv"
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
