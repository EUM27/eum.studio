import { useMemo, useState } from "react";

import {
  buildManuscriptPreflightPreview,
  createManuscriptPreflightBoundaryContext,
  diagnoseManuscriptPreflight,
  type ExportManuscriptTextResult,
  type ManuscriptPreflightFindingKind,
  type ManuscriptPreflightPreview,
  type ManuscriptPreflightProfile,
  type ManuscriptPreflightRange,
  type ManuscriptPreflightSettings,
  type ManuscriptPreflightSettingsProjection,
} from "../../application/editor/manuscript-preflight";

const FINDING_LABELS: Readonly<Record<ManuscriptPreflightFindingKind, string>> =
  Object.freeze({
    "trailing-whitespace": "줄 끝 공백",
    tab: "탭 문자",
    "non-breaking-space": "줄바꿈 방지 공백",
    "mixed-line-ending": "혼합 줄바꿈",
    "excess-blank-line": "연속 빈 줄",
    "forbidden-term": "금칙어",
    "regex-match": "정규식 일치",
  });

type PreflightScope = "episode" | "selection";
type DialogAction = "idle" | "saving" | "applying" | "exporting";

export type ManuscriptPreflightApplyInput = Readonly<{
  range: ManuscriptPreflightRange;
  expectedSource: string;
  result: string;
}>;

export function ManuscriptPreflightDialog(input: {
  readonly documentLabel: string;
  readonly manuscript: string;
  readonly selection: ManuscriptPreflightRange | null;
  readonly profile: ManuscriptPreflightProfile;
  readonly settingsProjection: ManuscriptPreflightSettingsProjection;
  readonly onApply: (value: ManuscriptPreflightApplyInput) => boolean;
  readonly onClose: () => void;
  readonly onExport: (text: string) => Promise<ExportManuscriptTextResult>;
  readonly onSaveSettings: (
    settings: ManuscriptPreflightSettings,
  ) => Promise<ManuscriptPreflightSettingsProjection>;
}) {
  const [scope, setScope] = useState<PreflightScope>(
    input.selection === null ? "episode" : "selection",
  );
  const [settings, setSettings] = useState(
    input.settingsProjection.settings,
  );
  const [forbiddenTermsText, setForbiddenTermsText] = useState(
    input.settingsProjection.settings.forbiddenTerms.join("\n"),
  );
  const [preview, setPreview] = useState<ManuscriptPreflightPreview | null>(
    null,
  );
  const [ensureBlankLineBetweenParagraphs, setEnsureBlankLineBetweenParagraphs] =
    useState(false);
  const [action, setAction] = useState<DialogAction>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const selectionRange = input.selection;
  const targetRange = useMemo<ManuscriptPreflightRange>(
    () =>
      scope === "selection" && selectionRange !== null
        ? selectionRange
        : Object.freeze({ from: 0, to: input.manuscript.length }),
    [input.manuscript.length, scope, selectionRange],
  );
  const targetSource = input.manuscript.slice(
    targetRange.from,
    targetRange.to,
  );
  const boundary = useMemo(
    () =>
      createManuscriptPreflightBoundaryContext(
        input.manuscript,
        targetRange,
      ),
    [input.manuscript, targetRange],
  );
  const report = useMemo(
    () => diagnoseManuscriptPreflight(targetSource, settings, boundary),
    [boundary, settings, targetSource],
  );
  const busy = action !== "idle";

  const changeSettings = (
    update: Partial<ManuscriptPreflightSettings>,
  ) => {
    setSettings((current) => Object.freeze({ ...current, ...update }));
    setPreview(null);
    setMessage(null);
  };
  const changeScope = (nextScope: PreflightScope) => {
    setScope(nextScope);
    setPreview(null);
    setMessage(null);
  };
  const createPreview = () => {
    setPreview(
      buildManuscriptPreflightPreview(targetSource, settings, boundary, {
        ensureBlankLineBetweenParagraphs,
      }),
    );
    setMessage("미리보기를 만들었습니다. 아직 원고는 바뀌지 않았습니다.");
  };
  const saveSettings = async () => {
    setAction("saving");
    setMessage(null);
    try {
      const saved = await input.onSaveSettings(settings);
      setSettings(saved.settings);
      setForbiddenTermsText(saved.settings.forbiddenTerms.join("\n"));
      setMessage("이 작품의 점검 설정을 저장했습니다.");
    } catch {
      setMessage("점검 설정을 저장하지 못했습니다.");
    } finally {
      setAction("idle");
    }
  };
  const applyPreview = () => {
    if (preview === null) {
      return;
    }
    setAction("applying");
    setMessage(null);
    const applied = input.onApply({
      range: targetRange,
      expectedSource: preview.source,
      result: preview.result,
    });
    if (!applied) {
      setMessage(
        "미리보기 뒤 원고가 달라졌습니다. 현재 원고로 다시 점검하세요.",
      );
      setAction("idle");
    }
  };
  const exportPreview = async () => {
    if (preview === null) {
      return;
    }
    setAction("exporting");
    setMessage(null);
    try {
      const result = await input.onExport(preview.result);
      setMessage(
        result.status === "completed"
          ? `TXT 내보내기를 완료했습니다. ${result.byteLength}바이트`
          : "TXT 내보내기를 취소했습니다.",
      );
    } catch {
      setMessage("TXT 내보내기를 완료하지 못했습니다.");
    } finally {
      setAction("idle");
    }
  };

  return (
    <div className="dialog-backdrop manuscript-preflight-backdrop" role="presentation">
      <section
        aria-labelledby="manuscript-preflight-heading"
        aria-modal="true"
        className="manuscript-preflight-dialog"
        data-range-from={targetRange.from}
        data-range-to={targetRange.to}
        role="dialog"
      >
        <header className="manuscript-preflight-header">
          <div>
            <p className="panel-kicker">MANUSCRIPT PREFLIGHT</p>
            <h2 id="manuscript-preflight-heading">원고 점검</h2>
            <p>{input.documentLabel}</p>
          </div>
          <button
            aria-label="원고 점검 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="manuscript-preflight-layout">
          <section className="preflight-settings-panel">
            <fieldset className="preflight-scope-fieldset">
              <legend>점검 범위</legend>
              <label>
                <input
                  checked={scope === "episode"}
                  disabled={busy}
                  name="preflight-scope"
                  onChange={() => changeScope("episode")}
                  type="radio"
                />
                현재 회차 전체
              </label>
              <label>
                <input
                  checked={scope === "selection"}
                  disabled={busy || selectionRange === null}
                  name="preflight-scope"
                  onChange={() => changeScope("selection")}
                  type="radio"
                />
                선택 범위
              </label>
            </fieldset>

            <div className="preflight-settings-grid">
              <label className="preflight-check-row">
                <input
                  checked={settings.trimTrailingWhitespace}
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({ trimTrailingWhitespace: event.target.checked })
                  }
                  type="checkbox"
                />
                줄 끝 공백 제거
              </label>
              <label>
                <span>탭 문자</span>
                <select
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({
                      tabReplacement: event.target.value as ManuscriptPreflightSettings["tabReplacement"],
                    })
                  }
                  value={settings.tabReplacement}
                >
                  <option value="preserve">유지</option>
                  <option value="spaces">공백으로 변경</option>
                </select>
              </label>
              <label>
                <span>탭 공백 수</span>
                <input
                  disabled={busy || settings.tabReplacement === "preserve"}
                  max={input.profile.limits.tabWidth.max}
                  min={input.profile.limits.tabWidth.min}
                  onChange={(event) =>
                    changeSettings({
                      tabWidth: Math.min(
                        input.profile.limits.tabWidth.max,
                        Math.max(
                          input.profile.limits.tabWidth.min,
                          Math.trunc(Number(event.target.value)),
                        ),
                      ),
                    })
                  }
                  type="number"
                  value={settings.tabWidth}
                />
              </label>
              <label>
                <span>줄바꿈 방지 공백</span>
                <select
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({
                      nonBreakingSpaceReplacement: event.target.value as ManuscriptPreflightSettings["nonBreakingSpaceReplacement"],
                    })
                  }
                  value={settings.nonBreakingSpaceReplacement}
                >
                  <option value="preserve">유지</option>
                  <option value="space">일반 공백으로 변경</option>
                </select>
              </label>
              <label>
                <span>줄바꿈</span>
                <select
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({
                      lineEnding: event.target.value as ManuscriptPreflightSettings["lineEnding"],
                    })
                  }
                  value={settings.lineEnding}
                >
                  <option value="preserve">유지</option>
                  <option value="lf">LF</option>
                  <option value="crlf">CRLF</option>
                </select>
              </label>
              <label className="preflight-check-row">
                <input
                  checked={settings.limitBlankLines}
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({ limitBlankLines: event.target.checked })
                  }
                  type="checkbox"
                />
                연속 빈 줄 제한
              </label>
              <label className="preflight-check-row">
                <input
                  checked={ensureBlankLineBetweenParagraphs}
                  disabled={busy}
                  onChange={(event) => {
                    setEnsureBlankLineBetweenParagraphs(event.target.checked);
                    setPreview(null);
                    setMessage(null);
                  }}
                  type="checkbox"
                />
                모든 문단 사이에 빈 줄 한 줄 추가
              </label>
              <label>
                <span>허용할 연속 빈 줄</span>
                <input
                  disabled={busy || !settings.limitBlankLines}
                  max={input.profile.limits.maxConsecutiveBlankLines.max}
                  min={input.profile.limits.maxConsecutiveBlankLines.min}
                  onChange={(event) =>
                    changeSettings({
                      maxConsecutiveBlankLines: Math.min(
                        input.profile.limits.maxConsecutiveBlankLines.max,
                        Math.max(
                          input.profile.limits.maxConsecutiveBlankLines.min,
                          Math.trunc(Number(event.target.value)),
                        ),
                      ),
                    })
                  }
                  type="number"
                  value={settings.maxConsecutiveBlankLines}
                />
              </label>
              <label className="preflight-wide-field">
                <span>금칙어 · 한 줄에 하나</span>
                <textarea
                  disabled={busy}
                  onChange={(event) => {
                    const nextText = event.target.value;
                    setForbiddenTermsText(nextText);
                    changeSettings({
                      forbiddenTerms: [
                        ...new Set(
                          nextText
                            .split(/\r?\n/u)
                            .map((term) => term.trim())
                            .filter((term) => term.length > 0),
                        ),
                      ],
                    });
                  }}
                  value={forbiddenTermsText}
                />
              </label>
              <label className="preflight-check-row">
                <input
                  checked={settings.forbiddenCaseSensitive}
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({ forbiddenCaseSensitive: event.target.checked })
                  }
                  type="checkbox"
                />
                금칙어 대소문자 구분
              </label>
              <label className="preflight-wide-field">
                <span>찾을 정규식</span>
                <input
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({ regexPattern: event.target.value })
                  }
                  value={settings.regexPattern}
                />
              </label>
              <label className="preflight-check-row">
                <input
                  checked={settings.regexCaseSensitive}
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({ regexCaseSensitive: event.target.checked })
                  }
                  type="checkbox"
                />
                정규식 대소문자 구분
              </label>
              <label className="preflight-check-row">
                <input
                  checked={settings.regexMultiline}
                  disabled={busy}
                  onChange={(event) =>
                    changeSettings({ regexMultiline: event.target.checked })
                  }
                  type="checkbox"
                />
                정규식 여러 줄 모드
              </label>
            </div>
            <button
              className="secondary-button preflight-save-settings"
              disabled={busy}
              onClick={() => void saveSettings()}
              type="button"
            >
              {action === "saving" ? "설정 저장 중" : "이 작품에 설정 저장"}
            </button>
          </section>

          <section className="preflight-result-panel">
            <header>
              <div>
                <h3>진단</h3>
                <p>
                  {report.statistics.characters}자 · {report.statistics.lines}줄 · {report.statistics.utf8Bytes}바이트
                </p>
              </div>
              <span>{targetRange.from}–{targetRange.to}</span>
            </header>
            {report.findings.length === 0 ? (
              <p className="preflight-empty-findings">발견된 항목이 없습니다.</p>
            ) : (
              <ul className="preflight-findings">
                {report.findings.map((finding) => (
                  <li key={finding.kind}>
                    <span>{FINDING_LABELS[finding.kind]}</span>
                    <strong>{finding.count}</strong>
                  </li>
                ))}
              </ul>
            )}
            {report.regexError !== null && (
              <p className="dialog-error" role="alert">
                정규식 오류: {report.regexError}
              </p>
            )}

            <button
              className="primary-button preflight-preview-button"
              disabled={busy || report.regexError !== null}
              onClick={createPreview}
              type="button"
            >
              미리보기 만들기
            </button>

            {preview !== null && (
              <section className="preflight-preview" aria-label="점검 결과 미리보기">
                <header>
                  <h3>미리보기</h3>
                  <p>
                    {preview.changedLineCount}줄 변경 · {preview.characterDelta >= 0 ? "+" : ""}{preview.characterDelta}자
                  </p>
                </header>
                <textarea aria-label="점검 결과" readOnly value={preview.result} />
              </section>
            )}
          </section>
        </div>

        {message !== null && (
          <p aria-live="polite" className="preflight-message">
            {message}
          </p>
        )}
        <footer className="dialog-actions manuscript-preflight-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            닫기
          </button>
          <button
            className="secondary-button"
            disabled={busy || preview === null}
            onClick={() => void exportPreview()}
            type="button"
          >
            {action === "exporting" ? "내보내는 중" : "TXT 내보내기"}
          </button>
          <button
            className="primary-button"
            disabled={busy || preview === null || !preview.changed}
            onClick={applyPreview}
            type="button"
          >
            {action === "applying" ? "적용 중" : "이 변경 적용"}
          </button>
        </footer>
      </section>
    </div>
  );
}
