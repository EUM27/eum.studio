import { useState } from "react";

import type { PublishingPartnerProjection } from "../../application/publishing/publishing-partner-contract";
import type {
  ApprovePublishingResearchCommand,
  PreviewPublishingResearchCommand,
  PublishingResearchCandidateProjection,
  PublishingResearchField,
  PublishingResearchValue,
} from "../../application/publishing/publishing-research-contract";
import type { PublishingPartnerDialogActionState } from "./PublishingPartnerDialog";

const FIELD_LABELS: Readonly<Record<PublishingResearchField, string>> = Object.freeze({
  websiteUrl: "홈페이지",
  email: "이메일",
  genres: "장르",
  note: "메모",
});

function parseLines(value: string): readonly string[] {
  return Object.freeze(value
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0));
}

function displayValue(value: PublishingResearchValue): string {
  return typeof value === "string" ? value : value.join(", ");
}

export function PublishingResearchPanel(input: {
  readonly actionState: PublishingPartnerDialogActionState;
  readonly partners: readonly PublishingPartnerProjection[];
  readonly selectedPartnerId: string | null;
  readonly onPreview?: ((
    command: Omit<PreviewPublishingResearchCommand, "schemaVersion">,
  ) => Promise<PublishingResearchCandidateProjection | null>) | undefined;
  readonly onApprove?: ((
    command: Omit<ApprovePublishingResearchCommand, "schemaVersion">,
  ) => Promise<boolean>) | undefined;
}) {
  const [partnerId, setPartnerId] = useState(input.selectedPartnerId ?? "");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [observedOn, setObservedOn] = useState("");
  const [authority, setAuthority] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [genres, setGenres] = useState("");
  const [note, setNote] = useState("");
  const [candidate, setCandidate] = useState<PublishingResearchCandidateProjection | null>(null);
  const [selectedFields, setSelectedFields] = useState<readonly PublishingResearchField[]>([]);
  const busy = input.actionState !== "idle";
  const proposals = Object.freeze({
    ...(websiteUrl.trim().length > 0 ? { websiteUrl: websiteUrl.trim() } : {}),
    ...(email.trim().length > 0 ? { email: email.trim() } : {}),
    ...(parseLines(genres).length > 0 ? { genres: parseLines(genres) } : {}),
    ...(note.trim().length > 0 ? { note: note.trim() } : {}),
  });
  const canPreview =
    partnerId.length > 0 &&
    label.trim().length > 0 &&
    url.trim().length > 0 &&
    observedOn.length > 0 &&
    authority.trim().length > 0 &&
    Object.keys(proposals).length > 0;

  const clearCandidate = () => {
    setCandidate(null);
    setSelectedFields([]);
  };

  return (
    <div className="publishing-research-body">
      <section className="publishing-research-intro">
        <p className="panel-kicker">WEB RESEARCH</p>
        <h3>웹 자료 검토</h3>
        <p>사용자가 확인한 자료만 비교합니다. URL 내용을 자동으로 가져오거나 검색하지 않습니다.</p>
      </section>

      <form
        className="publishing-research-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canPreview || input.onPreview === undefined) return;
          void input.onPreview({
            partnerId: partnerId as PublishingPartnerProjection["partnerId"],
            source: {
              label: label.trim(),
              url: url.trim(),
              observedOn,
              authority: authority.trim(),
            },
            proposals,
          }).then((next) => {
            setCandidate(next);
            setSelectedFields([]);
          });
        }}
      >
        <label>
          <span>투고처</span>
          <select
            aria-label="웹 자료 비교 투고처"
            disabled={busy}
            onChange={(event) => {
              setPartnerId(event.target.value);
              clearCandidate();
            }}
            value={partnerId}
          >
            <option value="">투고처 선택</option>
            {input.partners.map((partner) => (
              <option key={partner.partnerId} value={partner.partnerId}>{partner.name}</option>
            ))}
          </select>
        </label>
        <div className="publishing-research-source-grid">
          <label>
            <span>자료 표시명</span>
            <input disabled={busy} onChange={(event) => { setLabel(event.target.value); clearCandidate(); }} value={label} />
          </label>
          <label>
            <span>자료 URL</span>
            <input disabled={busy} onChange={(event) => { setUrl(event.target.value); clearCandidate(); }} type="url" value={url} />
          </label>
          <label>
            <span>확인한 날짜</span>
            <input disabled={busy} onChange={(event) => { setObservedOn(event.target.value); clearCandidate(); }} type="date" value={observedOn} />
          </label>
          <label>
            <span>자료 권위</span>
            <input disabled={busy} onChange={(event) => { setAuthority(event.target.value); clearCandidate(); }} placeholder="직접 입력" value={authority} />
          </label>
        </div>
        <fieldset className="publishing-research-proposals">
          <legend>자료에서 확인한 값</legend>
          <label>
            <span>홈페이지</span>
            <input disabled={busy} onChange={(event) => { setWebsiteUrl(event.target.value); clearCandidate(); }} value={websiteUrl} />
          </label>
          <label>
            <span>이메일</span>
            <input disabled={busy} onChange={(event) => { setEmail(event.target.value); clearCandidate(); }} value={email} />
          </label>
          <label>
            <span>장르 (한 줄에 하나)</span>
            <textarea disabled={busy} onChange={(event) => { setGenres(event.target.value); clearCandidate(); }} rows={3} value={genres} />
          </label>
          <label>
            <span>메모</span>
            <textarea disabled={busy} onChange={(event) => { setNote(event.target.value); clearCandidate(); }} rows={3} value={note} />
          </label>
        </fieldset>
        <button className="primary-button" disabled={busy || !canPreview} type="submit">
          {input.actionState === "previewing-research" ? "비교 중" : "현재 값과 비교"}
        </button>
      </form>

      {candidate !== null && (
        <section aria-label="웹 자료 비교 결과" className="publishing-research-candidate">
          <h3>선택 반영</h3>
          <p>반영할 필드만 선택하세요. 선택하지 않은 값은 바뀌지 않습니다.</p>
          <ul>
            {candidate.fields.map((item) => {
              const checked = selectedFields.includes(item.field);
              return (
                <li className={item.conflict ? "is-conflict" : undefined} key={item.field}>
                  <label>
                    <input
                      aria-label={`${FIELD_LABELS[item.field]} 반영`}
                      checked={checked}
                      disabled={busy}
                      onChange={() => setSelectedFields((current) => checked
                        ? Object.freeze(current.filter((field) => field !== item.field))
                        : Object.freeze([...current, item.field]))}
                      type="checkbox"
                    />
                    <strong>{FIELD_LABELS[item.field]}</strong>
                  </label>
                  <div><span>현재</span><p>{displayValue(item.current) || "비어 있음"}</p></div>
                  <div><span>제안</span><p>{displayValue(item.proposed) || "비어 있음"}</p></div>
                  {item.conflict && <small>기존 값과 다릅니다.</small>}
                </li>
              );
            })}
          </ul>
          <button
            className="primary-button"
            disabled={busy || selectedFields.length === 0}
            onClick={() => {
              if (input.onApprove === undefined) return;
              void input.onApprove({
                partnerId: candidate.partnerId,
                expectedRevision: candidate.expectedRevision,
                source: candidate.source,
                proposals: candidate.proposals,
                selectedFields,
              }).then((approved) => {
                if (approved) {
                  setCandidate(null);
                  setSelectedFields([]);
                }
              });
            }}
            type="button"
          >
            {input.actionState === "approving-research" ? "반영 중" : "선택 필드 반영"}
          </button>
        </section>
      )}
    </div>
  );
}
