import { useState, type FormEvent } from "react";
import { KeyRound, Plus, Trash2, X } from "lucide-react";

import type {
  AssistantConnectionProjection,
  AssistantCredentialChange,
} from "../../application/assistant/assistant-connection";
import type {
  AssistantConnectorManifestProfile,
} from "../../application/assistant/assistant-connector-manifest";

export type AssistantConnectionEditorInput = {
  readonly connection: AssistantConnectionProjection | null;
  readonly connectorKind: string;
  readonly label: string;
  readonly endpoint: string;
  readonly model: string;
  readonly credential: AssistantCredentialChange;
};

export function createAssistantCredentialChange(input: {
  readonly credentialValue: string;
  readonly removeCredential: boolean;
}): AssistantCredentialChange {
  if (input.removeCredential) return Object.freeze({ mode: "remove" });
  if (input.credentialValue.trim().length > 0) {
    return Object.freeze({ mode: "replace", value: input.credentialValue });
  }
  return Object.freeze({ mode: "keep" });
}

export type AssistantConnectionsDialogActionState =
  | "idle"
  | "loading"
  | "saving"
  | "deleting";

export function AssistantConnectionsDialog(input: {
  readonly actionState: AssistantConnectionsDialogActionState;
  readonly connections: readonly AssistantConnectionProjection[];
  readonly connectorProfile: AssistantConnectorManifestProfile | null;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onDelete: (connection: AssistantConnectionProjection) => void;
  readonly onSave: (draft: AssistantConnectionEditorInput) => void;
}) {
  const initial = input.connections[0] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(
    initial?.connectionId ?? null,
  );
  const [label, setLabel] = useState(initial?.label ?? "");
  const [connectorKind, setConnectorKind] = useState(
    initial?.connectorKind ?? "",
  );
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [credentialValue, setCredentialValue] = useState("");
  const [removeCredential, setRemoveCredential] = useState(false);
  const busy = input.actionState !== "idle";
  const selected = input.connections.find(
    (connection) => connection.connectionId === selectedId,
  ) ?? null;

  function selectConnection(connection: AssistantConnectionProjection): void {
    setSelectedId(connection.connectionId);
    setLabel(connection.label);
    setConnectorKind(connection.connectorKind ?? "");
    setEndpoint(connection.endpoint);
    setModel(connection.model);
    setCredentialValue("");
    setRemoveCredential(false);
  }

  function startNewConnection(): void {
    setSelectedId(null);
    setLabel("");
    setConnectorKind("");
    setEndpoint("");
    setModel("");
    setCredentialValue("");
    setRemoveCredential(false);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    input.onSave({
      connection: selected,
      connectorKind,
      label,
      endpoint,
      model,
      credential: createAssistantCredentialChange({
        credentialValue,
        removeCredential,
      }),
    });
  }

  return (
    <div className="dialog-backdrop assistant-connections-backdrop" role="presentation">
      <section
        aria-labelledby="assistant-connections-title"
        aria-modal="true"
        className="assistant-connections-dialog"
        role="dialog"
      >
        <header className="assistant-connections-header">
          <div>
            <span aria-hidden="true" className="assistant-connections-icon">
              <KeyRound size={18} />
            </span>
            <div>
              <p className="panel-kicker">ASSISTANT CONNECTIONS</p>
              <h2 id="assistant-connections-title">조수 연결</h2>
              <p>연결과 모델은 직접 입력하며 자동 기본값은 없습니다.</p>
            </div>
          </div>
          <button
            aria-label="조수 연결 닫기"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>

        <div className="assistant-connections-body">
          <aside aria-label="저장된 조수 연결" className="assistant-connections-list">
            <button
              className="assistant-connection-new"
              disabled={busy}
              onClick={startNewConnection}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              새 연결
            </button>
            {input.actionState === "loading" ? (
              <p>연결을 불러오는 중입니다.</p>
            ) : input.connections.length === 0 ? (
              <p>저장된 연결이 없습니다.</p>
            ) : (
              <ul>
                {input.connections.map((connection) => (
                  <li key={connection.connectionId}>
                    <button
                      aria-current={
                        selected?.connectionId === connection.connectionId
                          ? "true"
                          : undefined
                      }
                      disabled={busy}
                      onClick={() => selectConnection(connection)}
                      type="button"
                    >
                      <strong>{connection.label}</strong>
                      <span>{connection.model}</span>
                      <small>
                        자격 증명 {connection.credentialConfigured ? "저장됨" : "없음"}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <form className="assistant-connection-form" onSubmit={submit}>
            <div className="assistant-connection-form-title">
              <div>
                <h3>{selected === null ? "새 연결" : "연결 편집"}</h3>
                <p>입력한 자격 증명은 저장 뒤 화면으로 다시 반환되지 않습니다.</p>
              </div>
              {selected !== null && (
                <button
                  className="assistant-connection-delete"
                  disabled={busy}
                  onClick={() => {
                    startNewConnection();
                    input.onDelete(selected);
                  }}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                  삭제
                </button>
              )}
            </div>
            <label>
              <span>연결 종류</span>
              <select
                aria-label="연결 종류"
                disabled={busy}
                onChange={(event) => setConnectorKind(event.target.value)}
                required
                value={connectorKind}
              >
                <option value="">선택</option>
                {(input.connectorProfile?.connectors ?? []).map((connector) => (
                  <option
                    key={connector.connectorKind}
                    value={connector.connectorKind}
                  >
                    {connector.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>연결 이름</span>
              <input
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setLabel(event.target.value)}
                required
                value={label}
              />
            </label>
            <label>
              <span>Endpoint</span>
              <input
                autoCapitalize="off"
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setEndpoint(event.target.value)}
                required
                spellCheck={false}
                value={endpoint}
              />
            </label>
            <label>
              <span>Model</span>
              <input
                autoCapitalize="off"
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setModel(event.target.value)}
                required
                spellCheck={false}
                value={model}
              />
            </label>
            <label>
              <span>자격 증명</span>
              <input
                autoCapitalize="off"
                autoComplete="new-password"
                disabled={busy || removeCredential}
                onChange={(event) => {
                  setCredentialValue(event.target.value);
                  if (event.target.value.length > 0) setRemoveCredential(false);
                }}
                placeholder={
                  selected?.credentialConfigured === true
                    ? "새 값을 입력할 때만 교체"
                    : "필요한 경우 입력"
                }
                spellCheck={false}
                type="password"
                value={credentialValue}
              />
            </label>
            {selected?.credentialConfigured === true && (
              <label className="assistant-connection-remove-secret">
                <input
                  checked={removeCredential}
                  disabled={busy}
                  onChange={(event) => {
                    setRemoveCredential(event.target.checked);
                    if (event.target.checked) setCredentialValue("");
                  }}
                  type="checkbox"
                />
                <span>저장된 자격 증명 삭제</span>
              </label>
            )}
            {input.error !== null && (
              <p className="dialog-error" role="alert">{input.error}</p>
            )}
            <footer>
              <span>
                {selected === null
                  ? "연결은 저장 후에도 자동 선택되지 않습니다."
                  : `revision ${selected.revision.toLocaleString()}`}
              </span>
              <button disabled={busy} onClick={input.onClose} type="button">
                닫기
              </button>
              <button className="primary-button" disabled={busy} type="submit">
                {input.actionState === "saving" ? "저장 중…" : "저장"}
              </button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  );
}
